/*
 * User interface. Opening the popup (toolbar click or keyboard shortcut)
 * copies the transcript straight away, so the common case is one click.
 * The checkbox choice is remembered; changing it copies again.
 */
import { messageFor } from "./messages.js";
import { writeText } from "./clipboard.js";

const CONTENT_SCRIPTS = [
  "/content/timestamps.js",
  "/content/format.js",
  "/content/segments.js",
  "/content/detect.js",
  "/content/run.js",
];

const timestampsBox = document.getElementById("timestamps");
const copyButton = document.getElementById("copy");
const statusEl = document.getElementById("status");

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.dataset.kind = kind;
}

const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Run the extraction in the tab and return its result object. */
async function extract(tabId, timestamps) {
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: CONTENT_SCRIPTS });
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      func: (opts) => globalThis.Transcopy.copyTranscript(opts),
      args: [{ timestamps }],
    });
    if (injection && injection.error) throw injection.error;
    return (injection && injection.result) || { ok: false, code: "UNEXPECTED" };
  } catch (error) {
    console.error("Transcopy:", error);
    return { ok: false, code: "INJECTION_FAILED" };
  }
}

async function copy() {
  copyButton.disabled = true;
  setStatus("Copying…");
  try {
    const tab = await activeTab();
    // activeTab exposes the URL of the tab the user clicked on. Only inject
    // into YouTube watch pages.
    if (!tab || !globalThis.Transcopy.videoIdFromUrl(tab.url || "")) {
      setStatus(messageFor("NOT_A_VIDEO"), "error");
      return;
    }

    const result = await extract(tab.id, timestampsBox.checked);
    if (!result.ok) {
      setStatus(messageFor(result.code), "error");
      return;
    }

    try {
      await writeText(result.text);
    } catch (error) {
      console.error("Transcopy:", error);
      setStatus(messageFor("CLIPBOARD_FAILED"), "error");
      return;
    }

    let message = `Copied ${plural(result.segmentCount, "segment")}`;
    if (result.lastTimestamp) message += ` (up to ${result.lastTimestamp})`;
    if (result.language) message += ` · ${result.language}`;
    setStatus(`${message}.`, "ok");
  } catch (error) {
    console.error("Transcopy:", error);
    setStatus(messageFor("UNEXPECTED"), "error");
  } finally {
    copyButton.disabled = false;
  }
}

async function init() {
  try {
    const { timestamps = false } = await browser.storage.local.get("timestamps");
    timestampsBox.checked = !!timestamps;
  } catch {
    // Storage unavailable: keep the default (text only).
  }

  timestampsBox.addEventListener("change", () => {
    browser.storage.local.set({ timestamps: timestampsBox.checked }).catch(() => {});
    copy();
  });
  copyButton.addEventListener("click", copy);

  copy();
}

init();
