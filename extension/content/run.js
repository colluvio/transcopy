/*
 * Orchestration (runs in the YouTube tab when the user clicks the toolbar
 * button).
 *
 * 1. Confirm the tab shows a /watch page and that the page has finished
 *    switching to that video (single-page navigation).
 * 2. Use the open transcript panel, or open it with YouTube's own button.
 * 3. Wait until the segment list is complete: segments present, the count
 *    unchanged across several checks and no loading indicator.
 * 4. Extract and format, optionally under the video's title, URL, channel
 *    and publication date. Fail with an error code instead of returning a
 *    partial or mismatched transcript.
 *
 * The result is a plain object; the popup turns error codes into messages.
 */
(function (root) {
  "use strict";

  const lib =
    typeof module !== "undefined" && module.exports
      ? Object.assign({}, require("./detect.js"), require("./segments.js"), require("./timestamps.js"), require("./format.js"), require("./metadata.js"))
      : root.Transcopy;

  const DEFAULTS = {
    pageTimeoutMs: 5000, // wait for the page to catch up with the URL
    loadTimeoutMs: 20000, // wait for YouTube to load the transcript
    pollMs: 250,
    stableChecks: 4, // identical consecutive checks required (~1 s)
  };

  const fail = (code, details) => ({ ok: false, code, ...(details || {}) });

  /** Timestamps must not go backwards; if they do, two lists are mixed. */
  function isOrdered(segments) {
    let previous = -1;
    for (const s of segments) {
      const t = lib.parseTimestamp(s.timestamp);
      if (t === null) continue;
      if (t < previous) return false;
      previous = t;
    }
    return true;
  }

  /**
   * @param {{timestamps?: boolean, details?: boolean}} options
   * @param {{document?: Document, location?: Location, sleep?: Function, config?: object}} env
   *        injectable for tests; defaults to the live page.
   */
  async function copyTranscript(options = {}, env = {}) {
    const doc = env.document || root.document;
    const loc = env.location || root.location;
    const cfg = Object.assign({}, DEFAULTS, env.config);
    const sleep = env.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));

    const videoId = lib.videoIdFromUrl(loc.href);
    if (!videoId) return fail("NOT_A_VIDEO");

    // The rendered page must belong to the URL's video. A missing attribute
    // (structure change) is tolerated; an explicit mismatch is not.
    const pageMatches = () => {
      const rendered = lib.renderedVideoId(doc);
      return rendered === null || rendered === videoId;
    };
    const stillSameVideo = () => lib.videoIdFromUrl(loc.href) === videoId && pageMatches();

    for (let waited = 0; !pageMatches(); waited += cfg.pollMs) {
      if (waited >= cfg.pageTimeoutMs) return fail("PAGE_NOT_READY");
      await sleep(cfg.pollMs);
    }

    // Open the transcript if it is not already showing segments. Clicking
    // "Show transcript" also switches an open panel back from its Chapters
    // tab to the Transcript tab.
    let found = lib.findTranscriptPanel(doc);
    let openedPanel = false;
    if (!found || !found.hasSegments) {
      const button = lib.findShowTranscriptButton(doc);
      if (button) {
        button.click();
        openedPanel = !found;
      } else if (!found) {
        return fail("NO_TRANSCRIPT");
      }
    }

    // Wait for a complete, stable list.
    let last = null;
    let stable = 0;
    let sawPanel = false;
    for (let waited = 0; ; waited += cfg.pollMs) {
      await sleep(cfg.pollMs);
      if (!stillSameVideo()) return fail("NAVIGATED");

      found = lib.findTranscriptPanel(doc);
      if (found) sawPanel = true;
      const { layout, segments } = lib.readSegments(found && found.panel);
      const loading = lib.isPanelLoading(found && found.panel);
      const signature = segments.length
        ? `${segments.length}|${segments[segments.length - 1].timestamp}`
        : null;

      if (signature && !loading && signature === last) stable += 1;
      else stable = 0;
      last = signature;

      if (stable >= cfg.stableChecks) {
        if (!isOrdered(segments)) return fail("INCONSISTENT");
        const transcript = lib.formatTranscript(segments, { timestamps: !!options.timestamps });
        if (!transcript) return fail("EMPTY");
        const text = options.details
          ? lib.formatWithDetails(lib.readVideoDetails(doc, videoId), transcript)
          : transcript;
        return {
          ok: true,
          text,
          layout,
          segmentCount: segments.length,
          characters: text.length,
          firstTimestamp: segments[0].timestamp || null,
          lastTimestamp: segments[segments.length - 1].timestamp || null,
          language: layout === "legacy" ? lib.legacyLanguageLabel(found.panel) : null,
          openedPanel,
          videoId,
        };
      }

      if (waited >= cfg.loadTimeoutMs) {
        if (signature) return fail("INCOMPLETE", { segmentCount: segments.length });
        return fail(sawPanel ? "LOAD_FAILED" : "NO_TRANSCRIPT");
      }
    }
  }

  const api = { copyTranscript, isOrdered };
  root.Transcopy = Object.assign(root.Transcopy || {}, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
