// End-to-end test in a real Firefox with the extension installed as a
// temporary add-on. It drives the same path a user takes:
//
//   toolbar button -> popup -> activeTab + scripting -> YouTube page
//   -> clipboard
//
// The toolbar button is clicked from Firefox's privileged (chrome) context.
// That is a genuine user action for the extension: it grants activeTab, and
// the clipboard is read back afterwards.
//
// Requirements: network access to youtube.com, Firefox 140+ and geckodriver
// 0.36+ (Selenium Manager downloads both when FIREFOX_BIN / GECKODRIVER are
// unset). Run `npm run build` first.
//
//   npm run build && npm run test:e2e
//   HEADED=1 npm run test:e2e            # watch it run
//   E2E_ONLY=supplied-closed,long npm run test:e2e
//
// YouTube changes, A/B tests and sometimes refuses transcripts to anonymous
// automated sessions, so this suite is run locally, not in CI.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Builder } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(await readFile(`${root}extension/manifest.json`, "utf8"));
const ADDON_ID = manifest.browser_specific_settings.gecko.id;
const WIDGET_ID = `${ADDON_ID.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}-browser-action`;
const PACKAGE = `${root}dist/copy-youtube-transcript-${manifest.version}.zip`;
const SENTINEL = "clipboard-sentinel-not-a-transcript";

// Test videos. Only short excerpts of spoken (non-music) videos are printed.
const VIDEOS = {
  supplied: "0UPvLfZ6X3Q", // English, auto-generated, 13:29, chapters
  manual: "av3zdxYvCp8", // TED-Ed, manual English captions, several languages
  spanish: "8yJyKGOwCW4", // Spanish, auto-generated, 1:27:53
  long: "DrM1rex7ooc", // English, auto-generated, 3:00:00
  missing: "1VMI7nffU-Q", // silent screensaver video, no transcript
};

// ------------------------------------------------------------------ helpers

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startFirefox() {
  const options = new firefox.Options();
  if (process.env.HEADED !== "1") options.addArguments("-headless");
  if (process.env.FIREFOX_BIN) options.setBinary(process.env.FIREFOX_BIN);
  options.setPreference("intl.accept_languages", "en-US, en");
  options.setPreference("media.autoplay.default", 5); // block autoplay
  const service = (process.env.GECKODRIVER
    ? new firefox.ServiceBuilder(process.env.GECKODRIVER)
    : new firefox.ServiceBuilder()
  ).addArguments("--allow-system-access");
  const driver = await new Builder()
    .forBrowser("firefox")
    .setFirefoxOptions(options)
    .setFirefoxService(service)
    .build();
  await driver.manage().window().setRect({ width: 1400, height: 1000 });
  return driver;
}

async function inChrome(driver, fn) {
  await driver.setContext(firefox.Context.CHROME);
  try {
    return await fn();
  } finally {
    await driver.setContext(firefox.Context.CONTENT);
  }
}

const clipboardWrite = (driver, text) =>
  inChrome(driver, () =>
    driver.executeAsyncScript(
      "const [t, done] = arguments; navigator.clipboard.writeText(t).then(() => done(true), (e) => done(String(e)));",
      text
    )
  );

const clipboardRead = (driver) =>
  inChrome(driver, () =>
    driver.executeAsyncScript(
      "const done = arguments[0]; navigator.clipboard.readText().then(done, (e) => done('ERR ' + e));"
    )
  );

/** Click the extension's toolbar button, as a user would. */
async function clickToolbarButton(driver) {
  await inChrome(driver, () =>
    driver.executeScript(
      `const id = arguments[0];
       for (const p of document.querySelectorAll("panel")) if (p.state === "open") p.hidePopup();
       CustomizableUI.addWidgetToArea(id, CustomizableUI.AREA_NAVBAR);
       const node = CustomizableUI.getWidget(id).forWindow(window).node;
       const button = node.querySelector(".unified-extensions-item-action-button, toolbarbutton") || node;
       button.click();`,
      WIDGET_ID
    )
  );
}

async function closePopups(driver) {
  await inChrome(driver, () =>
    driver.executeScript(
      `for (const p of document.querySelectorAll("panel")) if (p.state === "open") p.hidePopup();`
    )
  );
}

/** Copy via the toolbar and wait for the clipboard to change. */
async function copyViaToolbar(driver, timeoutMs = 35000) {
  await clipboardWrite(driver, SENTINEL);
  await clickToolbarButton(driver);
  const started = Date.now();
  let text = SENTINEL;
  while (Date.now() - started < timeoutMs) {
    await sleep(500);
    text = await clipboardRead(driver);
    if (text !== SENTINEL) break;
  }
  await closePopups(driver);
  return { text, changed: text !== SENTINEL, ms: Date.now() - started };
}

/** Set the "Include timestamps" preference through the popup's own checkbox. */
async function setTimestampsPreference(driver, wanted) {
  const host = await inChrome(driver, () =>
    driver.executeScript("return WebExtensionPolicy.getByID(arguments[0]).mozExtensionHostname", ADDON_ID)
  );
  const original = await driver.getWindowHandle();
  await driver.switchTo().newWindow("tab");
  await driver.get(`moz-extension://${host}/popup/popup.html`);
  await sleep(500);
  const checked = await driver.executeScript("return document.getElementById('timestamps').checked");
  if (checked !== wanted) await driver.executeScript("document.getElementById('timestamps').click()");
  await sleep(300);
  await driver.close();
  await driver.switchTo().window(original);
}

async function openVideo(driver, videoId) {
  await driver.get(`https://www.youtube.com/watch?v=${videoId}`);
  await sleep(3000);
  const url = await driver.getCurrentUrl();
  if (url.includes("consent.")) {
    // Fresh test profile: decline YouTube's cookie banner.
    await driver.executeScript(
      "[...document.querySelectorAll('button')].find(b => /reject all/i.test(b.innerText))?.click()"
    );
    await sleep(4000);
  }
  for (let i = 0; i < 30; i++) {
    const ready = await driver.executeScript(
      "return document.querySelector('ytd-watch-flexy')?.getAttribute('video-id') === arguments[0]",
      videoId
    );
    if (ready) break;
    await sleep(500);
  }
  await sleep(1500);
}

/** What the page's open transcript panel shows, read independently. */
const pagePanel = (driver) =>
  driver.executeScript(`
    const panel = [...document.querySelectorAll('ytd-engagement-panel-section-list-renderer')]
      .find(p => p.getAttribute('visibility') === 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED'
             && p.querySelector('transcript-segment-view-model, ytd-transcript-segment-renderer'));
    if (!panel) return { open: false, count: 0 };
    const segs = [...panel.querySelectorAll('transcript-segment-view-model, ytd-transcript-segment-renderer')];
    const ts = (s) => (s.querySelector('.ytwTranscriptSegmentViewModelTimestamp, .segment-timestamp')?.textContent || '').trim();
    const tx = (s) => (s.querySelector('.ytAttributedStringHost, [role=text], .segment-text')?.textContent || '').replace(/\\s+/g, ' ').trim();
    return { open: true, count: segs.length, firstTs: ts(segs[0]), lastTs: ts(segs.at(-1)), firstText: tx(segs[0]), lastText: tx(segs.at(-1)) };`);

/** Open the transcript panel with YouTube's own button and wait. */
async function openPanelManually(driver) {
  await driver.executeScript(
    "document.querySelector('ytd-video-description-transcript-section-renderer button')?.click()"
  );
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    if ((await pagePanel(driver)).count > 0) return true;
  }
  return false;
}

/** Run the extension's content scripts directly in the page to read an error code. */
async function runContentScriptsInPage(driver) {
  const dir = `${root}extension/content/`;
  const order = ["timestamps.js", "format.js", "segments.js", "detect.js", "run.js"];
  const sources = await Promise.all(order.map((f) => readFile(dir + f, "utf8")));
  return driver.executeAsyncScript(
    `const done = arguments[arguments.length - 1];
     for (const src of arguments[0]) (0, eval)(src);
     globalThis.CopyYouTubeTranscript.copyTranscript({})
       .then(r => done({ ok: r.ok, code: r.code, segmentCount: r.segmentCount }), e => done({ error: String(e) }));`,
    sources
  );
}

// -------------------------------------------------------------- assertions

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, ok: !!condition, detail });
  console.log(`  ${condition ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const lines = (text) => text.split("\n");
const excerpt = (s) => (s.length > 60 ? `${s.slice(0, 60)}…` : s);
// "1:081 minute, 8 seconds" style duplication, or a raw timestamp glued to text.
const DUPLICATED_LABEL = /^\d+:\d\d\s*\d+\s*(second|minute|hour)s?\b/;

function checkTextOnly(name, text, panel) {
  const ls = lines(text);
  check(`${name}: one line per displayed segment`, ls.length === panel.count, `${ls.length} lines / ${panel.count} segments`);
  check(`${name}: first line matches the panel`, ls[0] === panel.firstText, excerpt(ls[0]));
  check(`${name}: last line matches the panel`, ls.at(-1) === panel.lastText);
  check(`${name}: no timestamps or accessibility labels`, !ls.some((l) => /^\[?\d+:\d\d/.test(l) || DUPLICATED_LABEL.test(l)));
}

function checkTimestamped(name, text, panel, hours) {
  const ls = lines(text);
  const pattern = hours ? /^\[\d\d:\d\d:\d\d\] \S/ : /^\[\d\d:\d\d\] \S/;
  check(`${name}: one line per displayed segment`, ls.length === panel.count, `${ls.length} lines / ${panel.count} segments`);
  check(`${name}: every line starts with ${hours ? "[HH:MM:SS]" : "[MM:SS]"}`, ls.every((l) => pattern.test(l)), excerpt(ls[0]));
  check(`${name}: no duplicated accessibility labels`, !ls.some((l) => /\] \d+\s*(second|minute|hour)s?\b/.test(l)));
  check(`${name}: text after the timestamp matches the panel`, ls[0].replace(/^\[[\d:]+\] /, "") === panel.firstText);
}

// ---------------------------------------------------------------- scenarios

const SCENARIOS = {
  async "supplied-closed"(d) {
    await setTimestampsPreference(d, false);
    await openVideo(d, VIDEOS.supplied);
    const before = await pagePanel(d);
    check("supplied-closed: transcript panel starts closed", !before.open);
    const r = await copyViaToolbar(d);
    check("supplied-closed: clipboard written", r.changed, `${r.ms} ms`);
    const panel = await pagePanel(d);
    check("supplied-closed: extension opened YouTube's panel", panel.open);
    check("supplied-closed: about 104 segments, up to 13:29", panel.count >= 100 && panel.lastTs === "13:29", `${panel.count} segments, last ${panel.lastTs}`);
    if (r.changed) checkTextOnly("supplied-closed", r.text, panel);
    // Optional: confirm the text reached the operating system's clipboard,
    // read by another program while Firefox is still running, e.g.
    //   E2E_OS_CLIPBOARD_CMD="xclip -o -selection clipboard"
    //   E2E_OS_CLIPBOARD_CMD="powershell.exe -NoProfile -Command Get-Clipboard -Raw"   (WSL)
    if (r.changed && process.env.E2E_OS_CLIPBOARD_CMD) {
      const { execSync } = await import("node:child_process");
      let os = "";
      // Clipboard bridges (WSLg, remote desktops) sync asynchronously.
      for (let i = 0; i < 10 && os !== r.text; i++) {
        await sleep(1000);
        os = execSync(process.env.E2E_OS_CLIPBOARD_CMD, { encoding: "utf8" }).replace(/\r\n/g, "\n").replace(/\n+$/, "");
      }
      check("supplied-closed: same text in the OS clipboard (read outside Firefox)", os === r.text, `${os ? lines(os).length : 0} lines`);
    }
  },

  async "supplied-open-timestamps"(d) {
    await setTimestampsPreference(d, true);
    await openVideo(d, VIDEOS.supplied);
    check("supplied-open: panel opened by hand first", await openPanelManually(d));
    const r = await copyViaToolbar(d);
    check("supplied-open: clipboard written", r.changed, `${r.ms} ms`);
    const panel = await pagePanel(d);
    if (r.changed) {
      checkTimestamped("supplied-open", r.text, panel, false);
      check("supplied-open: starts at [00:00] and ends at [13:29]", lines(r.text)[0].startsWith("[00:00] ") && lines(r.text).at(-1).startsWith("[13:29] "));
      check("supplied-open: 1:08 line is clean", lines(r.text).some((l) => /^\[01:08\] [^\d]/.test(l)), excerpt(lines(r.text).find((l) => l.startsWith("[01:08]")) || ""));
    }
  },

  async "manual-captions"(d) {
    await setTimestampsPreference(d, false);
    await openVideo(d, VIDEOS.manual);
    const r = await copyViaToolbar(d);
    check("manual-captions: clipboard written", r.changed, `${r.ms} ms`);
    if (r.changed) checkTextOnly("manual-captions", r.text, await pagePanel(d));
  },

  async "spanish-auto"(d) {
    await setTimestampsPreference(d, true);
    await openVideo(d, VIDEOS.spanish);
    const r = await copyViaToolbar(d);
    check("spanish-auto: clipboard written", r.changed, `${r.ms} ms`);
    if (r.changed) {
      const panel = await pagePanel(d);
      checkTimestamped("spanish-auto", r.text, panel, true);
      const words = r.text.toLowerCase().match(/\p{L}+/gu) || [];
      const spanish = words.filter((w) => ["que", "de", "la", "el", "y", "en", "no", "es", "lo", "se"].includes(w)).length;
      const english = words.filter((w) => ["the", "and", "is", "of", "to", "you", "that", "it"].includes(w)).length;
      check("spanish-auto: copied in Spanish (not translated)", spanish > english * 5, `${spanish} common Spanish vs ${english} common English words`);
    }
  },

  async long(d) {
    await setTimestampsPreference(d, false);
    await openVideo(d, VIDEOS.long);
    const r = await copyViaToolbar(d, 60000);
    check("long: clipboard written", r.changed, `${r.ms} ms`);
    if (r.changed) {
      const panel = await pagePanel(d);
      checkTextOnly("long", r.text, panel);
      check("long: covers the full 3 hours", /^2:5\d:\d\d$/.test(panel.lastTs), `${panel.count} segments, last ${panel.lastTs}, ${r.text.length} characters`);
    }
  },

  async missing(d) {
    await openVideo(d, VIDEOS.missing);
    const r = await copyViaToolbar(d, 30000);
    check("missing: clipboard left untouched", !r.changed);
    const direct = await runContentScriptsInPage(d);
    check("missing: reports NO_TRANSCRIPT", direct.code === "NO_TRANSCRIPT", JSON.stringify(direct));
  },

  async "spa-navigation"(d) {
    await setTimestampsPreference(d, false);
    await openVideo(d, VIDEOS.supplied);
    const first = await copyViaToolbar(d);
    check("spa: first video copied", first.changed);
    // Navigate inside YouTube (no page load) and copy immediately.
    const target = await d.executeScript(`
      const a = [...document.querySelectorAll('#secondary a[href*="/watch?v="]')].find(a => !a.href.includes(arguments[0]));
      a.click(); return new URL(a.href).searchParams.get('v');`, VIDEOS.supplied);
    await sleep(200);
    const second = await copyViaToolbar(d);
    const stale = second.changed && second.text === first.text;
    check("spa: never copies the previous video's transcript", !stale, `navigated to ${target}; ${second.changed ? "copied new transcript" : "copied nothing (transcript unavailable or still loading)"}`);
    if (second.changed) {
      const panel = await pagePanel(d);
      check("spa: copy matches the new video's panel", lines(second.text)[0] === panel.firstText);
    }
  },

  async "spa-to-known-video"(d) {
    // Navigate inside YouTube (no page load) to a video known to have a
    // transcript, the way YouTube's own links do, and copy immediately.
    await setTimestampsPreference(d, false);
    await openVideo(d, VIDEOS.manual);
    const first = await copyViaToolbar(d);
    check("spa-known: first video copied", first.changed);
    await d.executeScript(`
      window.__noReloadMarker = true;
      const id = arguments[0];
      document.querySelector("ytd-app").dispatchEvent(new CustomEvent("yt-navigate", { bubbles: true, detail: { endpoint: {
        commandMetadata: { webCommandMetadata: { url: "/watch?v=" + id, webPageType: "WEB_PAGE_TYPE_WATCH", rootVe: 3832 } },
        watchEndpoint: { videoId: id } } } }));`, VIDEOS.supplied);
    await sleep(150);
    const second = await copyViaToolbar(d);
    check("spa-known: navigation happened without a page load", await d.executeScript("return window.__noReloadMarker === true"));
    const panel = await pagePanel(d);
    check("spa-known: copies the new video, not the previous one",
      second.changed && second.text !== first.text && lines(second.text)[0] === panel.firstText && lines(second.text).length === panel.count,
      second.changed ? `${lines(second.text).length} lines; ${excerpt(lines(second.text)[0])}` : "nothing copied");
  },

  async "load-failure"(d) {
    // A video for which YouTube's panel often stays empty for anonymous,
    // automated sessions. Either outcome must be clean: a complete copy or
    // nothing at all.
    await openVideo(d, "CLCJaiyjKkc");
    const r = await copyViaToolbar(d, 40000);
    const panel = await pagePanel(d);
    if (r.changed) {
      check("load-failure: YouTube loaded it this time; copy is complete", lines(r.text).length === panel.count, `${panel.count} segments`);
    } else {
      check("load-failure: clipboard left untouched", !r.changed);
      const direct = await runContentScriptsInPage(d);
      check("load-failure: reports LOAD_FAILED", direct.code === "LOAD_FAILED", JSON.stringify(direct));
    }
  },

  async reload(d) {
    await setTimestampsPreference(d, false);
    await openVideo(d, VIDEOS.supplied);
    await copyViaToolbar(d);
    await d.navigate().refresh();
    await sleep(5000);
    const r = await copyViaToolbar(d);
    check("reload: copies again after a page reload", r.changed && lines(r.text).length >= 100, `${r.changed ? lines(r.text).length : 0} lines`);
  },

  async "not-a-video"(d) {
    await d.get("https://www.youtube.com/");
    await sleep(3000);
    const r = await copyViaToolbar(d, 6000);
    check("not-a-video: clipboard left untouched on the YouTube home page", !r.changed);
  },
};

// -------------------------------------------------------------------- main

const only = (process.env.E2E_ONLY || "").split(",").filter(Boolean);
const selected = Object.keys(SCENARIOS).filter((n) => !only.length || only.includes(n));

try {
  await readdir(`${root}dist`);
  await readFile(PACKAGE);
} catch {
  console.error(`Missing ${PACKAGE}. Run "npm run build" first.`);
  process.exit(2);
}

const driver = await startFirefox();
try {
  const caps = await driver.getCapabilities();
  console.log(`Firefox ${caps.get("browserVersion")}; installing ${PACKAGE} as a temporary add-on`);
  await driver.installAddon(PACKAGE, true);
  for (const name of selected) {
    console.log(`\n# ${name}`);
    try {
      await SCENARIOS[name](driver);
    } catch (error) {
      check(`${name}: ran without errors`, false, String(error).split("\n")[0]);
    }
  }
} finally {
  await driver.quit();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
