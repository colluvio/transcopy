/*
 * Segment extraction.
 *
 * Reads { timestamp, text } pairs from a transcript panel. Two DOM structures
 * are supported:
 *
 *  - modern (2025+): <transcript-segment-view-model> containing a visible
 *    timestamp div, a screen-reader-only label div ("1 minute, 8 seconds")
 *    and the caption text in an attributed-string span.
 *  - legacy: <ytd-transcript-segment-renderer> with .segment-timestamp and
 *    .segment-text children.
 *
 * Text is read from specific child elements instead of `innerText` on the
 * whole segment, which is what produced "1:081 minute, 8 secondsSo I'm...".
 * Chapter headings live outside the segment elements and are never read.
 */
(function (root) {
  "use strict";

  const MODERN_SEGMENT = "transcript-segment-view-model";
  const LEGACY_SEGMENT = "ytd-transcript-segment-renderer";
  const ANY_SEGMENT = `${MODERN_SEGMENT}, ${LEGACY_SEGMENT}`;

  /**
   * Text content of an element, treating <br> as a space so that words on
   * either side of a line break are not glued together.
   */
  function textOf(el) {
    if (!el) return "";
    let out = "";
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) out += child.nodeValue;
        else if (child.nodeType === 1) {
          const tag = child.tagName.toLowerCase();
          if (tag === "br") out += " ";
          else if (tag !== "script" && tag !== "style" && tag !== "template") walk(child);
        }
      }
    };
    walk(el);
    return out;
  }

  /** True for the visible timestamp element, false for its a11y label. */
  const isVisibleTimestamp = (el) =>
    /Timestamp/.test(el.className || "") && !/A11y/i.test(el.className || "");

  function readModernSegment(seg) {
    const tsEl =
      seg.querySelector(".ytwTranscriptSegmentViewModelTimestamp") ||
      Array.from(seg.querySelectorAll('[class*="Timestamp"]')).find(isVisibleTimestamp);
    let textEl = seg.querySelector(".ytAttributedStringHost, [role='text']");
    let text;
    if (textEl) {
      text = textOf(textEl);
    } else {
      // Fallback if the text span is renamed: drop every timestamp-related
      // element (visible and accessible label) and keep what is left.
      const clone = seg.cloneNode(true);
      clone.querySelectorAll('[class*="Timestamp"]').forEach((e) => e.remove());
      text = textOf(clone);
    }
    return { timestamp: textOf(tsEl).trim(), text };
  }

  function readLegacySegment(seg) {
    const tsEl = seg.querySelector(".segment-timestamp");
    const textEl = seg.querySelector(".segment-text") || seg.querySelector("yt-formatted-string");
    return { timestamp: textOf(tsEl).trim(), text: textOf(textEl) };
  }

  /**
   * Read every segment inside `container`, in document order.
   * @returns {{layout: "modern"|"legacy"|null, segments: Array<{timestamp: string, text: string}>}}
   */
  function readSegments(container) {
    if (!container) return { layout: null, segments: [] };
    const modern = container.querySelectorAll(MODERN_SEGMENT);
    if (modern.length) {
      return { layout: "modern", segments: Array.from(modern, readModernSegment) };
    }
    const legacy = container.querySelectorAll(LEGACY_SEGMENT);
    if (legacy.length) {
      return { layout: "legacy", segments: Array.from(legacy, readLegacySegment) };
    }
    return { layout: null, segments: [] };
  }

  const api = { ANY_SEGMENT, textOf, readSegments };
  root.Transcopy = Object.assign(root.Transcopy || {}, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
