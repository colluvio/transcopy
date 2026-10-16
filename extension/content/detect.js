/*
 * Transcript detection.
 *
 * Works out which video the page is showing, finds YouTube's transcript
 * panel, and opens it through YouTube's own "Show transcript" button when it
 * is closed. Nothing here calls YouTube APIs; it only uses the page as the
 * user sees it.
 */
(function (root) {
  "use strict";

  const seg =
    typeof module !== "undefined" && module.exports
      ? require("./segments.js")
      : root.CopyYouTubeTranscript;

  const PANEL = "ytd-engagement-panel-section-list-renderer";
  const EXPANDED = "ENGAGEMENT_PANEL_VISIBILITY_EXPANDED";

  /** The `v` parameter of a /watch URL, or null on any other page. */
  function videoIdFromUrl(href) {
    let url;
    try {
      url = new URL(href);
    } catch {
      return null;
    }
    if (!/(^|\.)youtube\.com$/.test(url.hostname) || url.pathname !== "/watch") return null;
    return url.searchParams.get("v") || null;
  }

  /**
   * The video the watch page has actually rendered. During YouTube's
   * single-page navigation the URL changes first and the page catches up a
   * moment later, so the two can briefly disagree.
   */
  function renderedVideoId(doc) {
    const flexy = doc.querySelector("ytd-watch-flexy");
    return flexy ? flexy.getAttribute("video-id") : null;
  }

  function expandedPanels(doc) {
    return Array.from(doc.querySelectorAll(PANEL)).filter(
      (p) => p.getAttribute("visibility") === EXPANDED
    );
  }

  /**
   * Find the open transcript panel. Panels that are collapsed are ignored,
   * because YouTube keeps old, hidden panels (sometimes from the previous
   * video) in the DOM.
   *
   * @returns {{panel: Element, hasSegments: boolean} | null}
   */
  function findTranscriptPanel(doc) {
    const panels = expandedPanels(doc);
    const withSegments = panels.find((p) => p.querySelector(seg.ANY_SEGMENT));
    if (withSegments) return { panel: withSegments, hasSegments: true };
    const transcriptPanel = panels.find((p) =>
      /transcript/i.test(p.getAttribute("target-id") || "")
    );
    return transcriptPanel ? { panel: transcriptPanel, hasSegments: false } : null;
  }

  /** YouTube's own "Show transcript" button from the video description. */
  function findShowTranscriptButton(doc) {
    return (
      doc.querySelector("ytd-video-description-transcript-section-renderer button") ||
      doc.querySelector("ytd-video-description-transcript-section-renderer [role='button']")
    );
  }

  /**
   * Whether the panel still shows a loading indicator next to its segments,
   * which would mean the list is not complete yet.
   */
  function isPanelLoading(panel) {
    if (!panel) return false;
    const list =
      panel.querySelector("ytd-transcript-segment-list-renderer") ||
      panel.querySelector("#content") ||
      panel;
    return !!list.querySelector(
      "ytd-continuation-item-renderer, yt-content-loading-renderer"
    );
  }

  /**
   * The language label from the legacy panel's footer dropdown, if present.
   * The modern panel has no language selector.
   */
  function legacyLanguageLabel(panel) {
    const label = panel && panel.querySelector("ytd-transcript-footer-renderer #label-text");
    const text = label ? label.textContent.trim() : "";
    return text || null;
  }

  const api = {
    videoIdFromUrl,
    renderedVideoId,
    findTranscriptPanel,
    findShowTranscriptButton,
    isPanelLoading,
    legacyLanguageLabel,
  };
  root.CopyYouTubeTranscript = Object.assign(root.CopyYouTubeTranscript || {}, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
