/*
 * Text formatting.
 *
 * Turns extracted segments ({ timestamp: "1:08", text: "So I'm going to..." })
 * into the text placed on the clipboard. Words, order, punctuation and
 * repeated segments are preserved; only whitespace inside a segment is
 * normalized so that captions split over several lines read as one line.
 */
(function (root) {
  "use strict";

  const ts =
    typeof module !== "undefined" && module.exports
      ? require("./timestamps.js")
      : root.Transcopy;

  /**
   * Collapse runs of whitespace (spaces, tabs, line breaks, no-break spaces)
   * into single spaces and trim the ends. Nothing else is changed.
   */
  function normalizeText(text) {
    return String(text ?? "")
      .replace(/\s+/gu, " ")
      .trim();
  }

  /**
   * Build the clipboard text.
   *
   * @param {Array<{timestamp: string, text: string}>} segments
   * @param {{timestamps?: boolean}} options
   * @returns {string} one segment per line
   */
  function formatTranscript(segments, options = {}) {
    const lines = segments
      .map((s) => ({ timestamp: s.timestamp, text: normalizeText(s.text) }))
      .filter((s) => s.text !== "");

    if (!options.timestamps) return lines.map((s) => s.text).join("\n");

    const seconds = lines.map((s) => ts.parseTimestamp(s.timestamp));
    const withHours = seconds.some((n) => n !== null && n >= 3600);
    return lines
      .map((s, i) => {
        // Keep YouTube's own label if it is not a plain h:mm:ss timestamp.
        const label =
          seconds[i] === null
            ? normalizeText(s.timestamp)
            : ts.formatTimestamp(seconds[i], withHours);
        return label ? `[${label}] ${s.text}` : s.text;
      })
      .join("\n");
  }

  const api = { normalizeText, formatTranscript };
  root.Transcopy = Object.assign(root.Transcopy || {}, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
