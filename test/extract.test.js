const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const { readSegments, textOf } = require("../extension/content/segments.js");
const detect = require("../extension/content/detect.js");
const { copyTranscript, isOrdered } = require("../extension/content/run.js");
const { readVideoDetails } = require("../extension/content/metadata.js");

const fixture = (name) => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");

function page(name, videoId) {
  const dom = new JSDOM(fixture(name), { url: `https://www.youtube.com/watch?v=${videoId}&t=42s` });
  return { document: dom.window.document, location: dom.window.location, window: dom.window };
}

// Fast, deterministic waiting for the orchestration tests.
const FAST = { pageTimeoutMs: 20, loadTimeoutMs: 40, pollMs: 1, stableChecks: 3 };
const env = (p, extra = {}) => ({ document: p.document, location: p.location, config: FAST, sleep: () => Promise.resolve(), ...extra });

const EXPANDED = "ENGAGEMENT_PANEL_VISIBILITY_EXPANDED";
const HIDDEN = "ENGAGEMENT_PANEL_VISIBILITY_HIDDEN";
const openPanel = (p) => p.document.querySelector(`[visibility="${EXPANDED}"]`);

// ---------------------------------------------------------------- extraction

test("modern layout: timestamps without the accessibility label, chapters excluded", () => {
  const p = page("modern.html", "TESTVIDEO01");
  const { layout, segments } = readSegments(openPanel(p));
  assert.equal(layout, "modern");
  assert.equal(segments.length, 6);
  assert.deepEqual(segments[2], { timestamp: "1:08", text: "So I'm going to pour the water now." });
  for (const s of segments) {
    assert.doesNotMatch(s.text, /seconds|minute|Chapter/);
    assert.match(s.timestamp, /^\d+:\d\d$/);
  }
});

test("modern layout: line breaks never glue words together", () => {
  const p = page("modern.html", "TESTVIDEO01");
  const { segments } = readSegments(openPanel(p));
  assert.match(segments[1].text, /that's\s+small/);
  assert.match(segments[5].text, /“quotes” after/);
});

test("modern layout: falls back when the text span is renamed", () => {
  const p = page("modern.html", "TESTVIDEO01");
  for (const span of openPanel(p).querySelectorAll("span[role='text']")) {
    span.removeAttribute("role");
    span.className = "somethingNew";
  }
  const { segments } = readSegments(openPanel(p));
  assert.deepEqual(segments[2], { timestamp: "1:08", text: "So I'm going to pour the water now." });
});

test("legacy layout: segments, timestamps and language label", () => {
  const p = page("legacy.html", "TESTVIDEO02");
  const panel = openPanel(p);
  const { layout, segments } = readSegments(panel);
  assert.equal(layout, "legacy");
  assert.deepEqual(segments.map((s) => s.timestamp), ["0:02", "59:58", "1:02:03"]);
  assert.equal(segments[0].text, "Hola a todos y bienvenidos.");
  assert.equal(detect.legacyLanguageLabel(panel), "Spanish (auto-generated)");
});

test("textOf ignores script/style/template content", () => {
  const { document } = new JSDOM("<p>a<script>x</script><style>y</style><template>z</template>b<br>c</p>").window;
  assert.equal(textOf(document.querySelector("p")), "ab c");
});

// ------------------------------------------------------------- video details

test("video details come from the VideoObject record of the current video", () => {
  const p = page("modern.html", "TESTVIDEO01");
  assert.deepEqual(readVideoDetails(p.document, "TESTVIDEO01"), {
    title: "How rivers carry sand",
    url: "https://www.youtube.com/watch?v=TESTVIDEO01",
    channel: "River Lab",
    // The date YouTube shows, not converted to another time zone.
    published: "2026-03-07",
  });
});

test("video details never use a record that belongs to another video", () => {
  const p = page("modern.html", "TESTVIDEO01");
  p.document.querySelector("#microformat").remove();
  p.document.querySelector("ytd-watch-metadata h1").textContent = "Title shown on the page";
  p.document.querySelector("ytd-channel-name a").textContent = "Channel shown on the page";
  // Only the stale <head> record (PREVIOUS001) is left: fall back to the page.
  assert.deepEqual(readVideoDetails(p.document, "TESTVIDEO01"), {
    title: "Title shown on the page",
    url: "https://www.youtube.com/watch?v=TESTVIDEO01",
    channel: "Channel shown on the page",
    published: null,
  });
});

test("video details: author objects, date-only values and broken records", () => {
  const p = page("modern.html", "TESTVIDEO01");
  const script = p.document.querySelector("#microformat script");
  script.textContent = JSON.stringify({
    "@type": "VideoObject",
    "@id": "https://www.youtube.com/watch?v=TESTVIDEO01",
    name: "  Spaced\n title ",
    author: { "@type": "Person", name: "Object Author" },
    uploadDate: "2024-02-29",
  });
  script.insertAdjacentHTML("beforebegin", '<script type="application/ld+json">{not json</script>');
  const details = readVideoDetails(p.document, "TESTVIDEO01");
  assert.equal(details.title, "Spaced title");
  assert.equal(details.channel, "Object Author");
  assert.equal(details.published, "2024-02-29");
});

test("video details: only the URL when the page shows nothing else", () => {
  const p = page("legacy.html", "TESTVIDEO02");
  assert.deepEqual(readVideoDetails(p.document, "TESTVIDEO02"), {
    title: null,
    url: "https://www.youtube.com/watch?v=TESTVIDEO02",
    channel: null,
    published: null,
  });
});

// ----------------------------------------------------------------- detection

test("videoIdFromUrl accepts only YouTube watch pages", () => {
  assert.equal(detect.videoIdFromUrl("https://www.youtube.com/watch?v=0UPvLfZ6X3Q&t=5"), "0UPvLfZ6X3Q");
  assert.equal(detect.videoIdFromUrl("https://youtube.com/watch?v=abc"), "abc");
  assert.equal(detect.videoIdFromUrl("https://www.youtube.com/"), null);
  assert.equal(detect.videoIdFromUrl("https://www.youtube.com/shorts/abc"), null);
  assert.equal(detect.videoIdFromUrl("https://evil.example/watch?v=abc"), null);
  assert.equal(detect.videoIdFromUrl("https://notyoutube.com/watch?v=abc"), null);
  assert.equal(detect.videoIdFromUrl("about:blank"), null);
  assert.equal(detect.videoIdFromUrl(""), null);
});

test("findTranscriptPanel ignores collapsed panels", () => {
  const p = page("modern.html", "TESTVIDEO01");
  openPanel(p).setAttribute("visibility", HIDDEN);
  assert.equal(detect.findTranscriptPanel(p.document), null);
});

test("isOrdered detects timestamps going backwards", () => {
  assert.equal(isOrdered([{ timestamp: "0:01" }, { timestamp: "0:01" }, { timestamp: "x" }, { timestamp: "0:05" }]), true);
  assert.equal(isOrdered([{ timestamp: "0:05" }, { timestamp: "0:01" }]), false);
});

// ------------------------------------------------------------- orchestration

test("panel already open: copies text only", async () => {
  const p = page("modern.html", "TESTVIDEO01");
  const result = await copyTranscript({ timestamps: false }, env(p));
  assert.equal(result.ok, true);
  assert.equal(result.segmentCount, 6);
  assert.equal(result.openedPanel, false);
  assert.equal(result.layout, "modern");
  assert.equal(result.lastTimestamp, "13:29");
  assert.equal(
    result.text.split("\n")[0],
    "All right. Today we look at how a river carries sand downstream."
  );
  assert.doesNotMatch(result.text, /Stale text|seconds|Chapter/);
});

test("panel already open: copies with timestamps", async () => {
  const p = page("modern.html", "TESTVIDEO01");
  const result = await copyTranscript({ timestamps: true }, env(p));
  assert.equal(result.ok, true);
  assert.deepEqual(result.text.split("\n").slice(0, 3), [
    "[00:00] All right. Today we look at how a river carries sand downstream.",
    "[00:07] So this is a model that's small enough to fit on a table.",
    "[01:08] So I'm going to pour the water now.",
  ]);
  assert.equal(result.text.split("\n")[5], "[13:29] ¡Gracias! Ça va — 日本語 & “quotes” after a line break.");
});

test("details option: title, URL, channel and date above the transcript", async () => {
  const p = page("modern.html", "TESTVIDEO01");
  const result = await copyTranscript({ timestamps: true, details: true }, env(p));
  assert.equal(result.ok, true);
  assert.deepEqual(result.text.split("\n").slice(0, 8), [
    "Title: How rivers carry sand",
    "URL: https://www.youtube.com/watch?v=TESTVIDEO01",
    "Channel: River Lab",
    "Published: 2026-03-07",
    "",
    "Transcript:",
    "[00:00] All right. Today we look at how a river carries sand downstream.",
    "[00:07] So this is a model that's small enough to fit on a table.",
  ]);
  assert.equal(result.characters, result.text.length);
});

test("legacy panel: hour-long timestamps and language label", async () => {
  const p = page("legacy.html", "TESTVIDEO02");
  const result = await copyTranscript({ timestamps: true }, env(p));
  assert.equal(result.ok, true);
  assert.equal(result.language, "Spanish (auto-generated)");
  assert.equal(result.text, "[00:00:02] Hola a todos y bienvenidos.\n[00:59:58] Hoy hablamos de sedimentos.\n[01:02:03] Hasta la próxima.");
});

test("panel closed: clicks YouTube's Show transcript button and waits for segments", async () => {
  const p = page("modern.html", "TESTVIDEO01");
  const panel = openPanel(p);
  const contents = panel.querySelector("#content");
  const saved = contents.innerHTML;
  panel.setAttribute("visibility", HIDDEN);
  contents.innerHTML = "";

  let clicks = 0;
  let ticks = 0;
  p.document.querySelector("ytd-video-description-transcript-section-renderer button").addEventListener("click", () => {
    clicks += 1;
    panel.setAttribute("visibility", EXPANDED);
  });
  // Segments arrive a few polls after the click, as when YouTube fetches them.
  const sleep = () => {
    ticks += 1;
    if (ticks === 4) contents.innerHTML = saved;
    return Promise.resolve();
  };
  const result = await copyTranscript({}, env(p, { sleep }));
  assert.equal(clicks, 1);
  assert.equal(result.ok, true);
  assert.equal(result.openedPanel, true);
  assert.equal(result.segmentCount, 6);
});

test("segments still arriving: waits until the count is stable", async () => {
  const p = page("modern.html", "TESTVIDEO01");
  const items = Array.from(openPanel(p).querySelectorAll("transcript-segment-view-model"));
  const holders = items.map((el) => {
    const parent = el.parentNode;
    el.remove();
    return { el, parent };
  });
  let ticks = 0;
  const sleep = () => {
    // Add one segment per poll, as a slowly rendering list would.
    if (ticks < holders.length) holders[ticks].parent.appendChild(holders[ticks].el);
    ticks += 1;
    return Promise.resolve();
  };
  const result = await copyTranscript({}, env(p, { sleep }));
  assert.equal(result.ok, true);
  assert.equal(result.segmentCount, 6);
});

test("open panel on the Chapters tab: clicks Show transcript to switch tabs", async () => {
  const p = page("modern.html", "TESTVIDEO01");
  const contents = openPanel(p).querySelector("#content");
  const saved = contents.innerHTML;
  contents.innerHTML = "<p>Chapter list only</p>";
  let clicks = 0;
  p.document.querySelector("ytd-video-description-transcript-section-renderer button").addEventListener("click", () => {
    clicks += 1;
    contents.innerHTML = saved;
  });
  // Without a target-id or segments the panel is not recognized, so the
  // button is clicked as for a closed panel.
  const result = await copyTranscript({}, env(p));
  assert.equal(clicks, 1);
  assert.equal(result.ok, true);
});

test("no transcript: no button and no panel", async () => {
  const p = page("modern.html", "TESTVIDEO01");
  openPanel(p).remove();
  p.document.querySelector("ytd-video-description-transcript-section-renderer").remove();
  const result = await copyTranscript({}, env(p));
  assert.deepEqual(result, { ok: false, code: "NO_TRANSCRIPT" });
});

test("load failure: panel opens but stays empty", async () => {
  const p = page("legacy.html", "TESTVIDEO02");
  p.document.querySelector("ytd-transcript-segment-list-renderer").innerHTML = "";
  const result = await copyTranscript({}, env(p));
  assert.deepEqual(result, { ok: false, code: "LOAD_FAILED" });
});

test("incomplete: a loading indicator under the list blocks copying", async () => {
  const p = page("legacy.html", "TESTVIDEO02");
  p.document
    .querySelector("#segments-container")
    .insertAdjacentHTML("beforeend", "<ytd-continuation-item-renderer></ytd-continuation-item-renderer>");
  const result = await copyTranscript({}, env(p));
  assert.equal(result.ok, false);
  assert.equal(result.code, "INCOMPLETE");
});

test("stale panel during navigation: never copies the previous video", async () => {
  // URL already points at the new video, page still renders the old one.
  const p = page("modern.html", "NEWVIDEO999");
  const result = await copyTranscript({}, env(p));
  assert.deepEqual(result, { ok: false, code: "PAGE_NOT_READY" });
});

test("navigation finishing while waiting: copies the new page once it matches", async () => {
  const p = page("modern.html", "NEWVIDEO999");
  let ticks = 0;
  const sleep = () => {
    ticks += 1;
    if (ticks === 3) p.document.querySelector("ytd-watch-flexy").setAttribute("video-id", "NEWVIDEO999");
    return Promise.resolve();
  };
  const result = await copyTranscript({}, env(p, { sleep }));
  assert.equal(result.ok, true);
  assert.equal(result.videoId, "NEWVIDEO999");
});

test("navigation away during loading aborts", async () => {
  const p = page("modern.html", "TESTVIDEO01");
  let ticks = 0;
  const sleep = () => {
    ticks += 1;
    if (ticks === 2) p.document.querySelector("ytd-watch-flexy").setAttribute("video-id", "OTHER");
    return Promise.resolve();
  };
  const result = await copyTranscript({}, env(p, { sleep }));
  assert.deepEqual(result, { ok: false, code: "NAVIGATED" });
});

test("mixed lists with timestamps going backwards are refused", async () => {
  const p = page("modern.html", "TESTVIDEO01");
  const first = openPanel(p).querySelector(".ytwTranscriptSegmentViewModelTimestamp");
  first.textContent = "59:00";
  const result = await copyTranscript({}, env(p));
  assert.deepEqual(result, { ok: false, code: "INCONSISTENT" });
});

test("not a watch page", async () => {
  const dom = new JSDOM("<p></p>", { url: "https://www.youtube.com/feed/subscriptions" });
  const result = await copyTranscript({}, { document: dom.window.document, location: dom.window.location, config: FAST });
  assert.deepEqual(result, { ok: false, code: "NOT_A_VIDEO" });
});

test("transcript text is treated as text, never as markup", async () => {
  const p = page("modern.html", "TESTVIDEO01");
  const span = openPanel(p).querySelector("span[role='text']");
  span.textContent = "<img src=x onerror=alert(1)> & stays literal";
  const result = await copyTranscript({}, env(p));
  assert.equal(result.text.split("\n")[0], "<img src=x onerror=alert(1)> & stays literal");
});
