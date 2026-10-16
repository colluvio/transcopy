/*
 * Timestamp normalization.
 *
 * YouTube shows segment start times as "0:07", "13:29" or "1:02:03". These
 * helpers turn such labels into seconds and back into a zero-padded label
 * ("00:07", "01:02:03") so every line of a copied transcript lines up.
 *
 * Loaded both as a content script (attaches to globalThis.Transcopy)
 * and as a CommonJS module by the unit tests.
 */
(function (root) {
  "use strict";

  /**
   * Parse a displayed timestamp such as "1:08" or "1:02:03" into seconds.
   * Returns null when the label is not a plain [[h:]m:]s timestamp.
   */
  function parseTimestamp(label) {
    if (typeof label !== "string") return null;
    const trimmed = label.trim();
    if (!/^\d{1,3}(:\d{1,2}){1,2}$/.test(trimmed)) return null;
    const parts = trimmed.split(":").map(Number);
    if (parts.slice(1).some((n) => n > 59)) return null;
    return parts.reduce((total, n) => total * 60 + n, 0);
  }

  const pad2 = (n) => String(n).padStart(2, "0");

  /**
   * Format seconds as "MM:SS", or "HH:MM:SS" when withHours is true.
   */
  function formatTimestamp(seconds, withHours) {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (withHours) return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
    // Without hours, minutes keep counting past 59 rather than losing time.
    return `${pad2(h * 60 + m)}:${pad2(sec)}`;
  }

  const api = { parseTimestamp, formatTimestamp };
  root.Transcopy = Object.assign(root.Transcopy || {}, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
