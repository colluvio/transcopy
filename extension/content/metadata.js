/*
 * Video details: title, channel and publication date.
 *
 * The main source is the schema.org VideoObject (JSON-LD) that YouTube keeps
 * inside <ytd-watch-flexy>. It is updated on in-page navigation and names its
 * video in "@id", so a record belonging to another video is never used. The
 * copy in <head> is written once per page load and goes stale after
 * navigation; it is only used when its "@id" matches too. If no matching
 * record exists, the title and channel shown on the page are used and the
 * date is left out (the page only shows it as relative or localized text).
 *
 * The record holds the original title; the page may show a translation.
 */
(function (root) {
  "use strict";

  const lib =
    typeof module !== "undefined" && module.exports
      ? Object.assign({}, require("./detect.js"), require("./format.js"))
      : root.Transcopy;

  /** Parsed VideoObject records that describe `videoId`, page copy first. */
  function videoObjects(doc, videoId) {
    const scripts = [
      ...doc.querySelectorAll('ytd-watch-flexy script[type="application/ld+json"]'),
      ...doc.querySelectorAll('script[type="application/ld+json"]'),
    ];
    const records = [];
    for (const script of new Set(scripts)) {
      let data;
      try {
        data = JSON.parse(script.textContent);
      } catch {
        continue;
      }
      if (!data || data["@type"] !== "VideoObject") continue;
      if (lib.videoIdFromUrl(String(data["@id"] || data.url || "")) !== videoId) continue;
      records.push(data);
    }
    return records;
  }

  /** "2026-10-15T10:28:30-07:00" -> "2026-10-15", as YouTube displays it. */
  function dateOnly(value) {
    const match = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(String(value || "").trim());
    return match ? match[1] : null;
  }

  const authorName = (author) =>
    author && typeof author === "object" ? author.name : author;

  const firstText = (values) =>
    values.map((v) => lib.normalizeText(typeof v === "string" ? v : "")).find(Boolean) || null;

  /**
   * @returns {{title: string|null, url: string, channel: string|null, published: string|null}}
   */
  function readVideoDetails(doc, videoId) {
    const records = videoObjects(doc, videoId);
    const shown = (selector) => {
      const el = doc.querySelector(selector);
      return el ? el.textContent : "";
    };
    return {
      title: firstText([...records.map((r) => r.name), shown("ytd-watch-metadata h1")]),
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      channel: firstText([
        ...records.map((r) => authorName(r.author)),
        shown("ytd-watch-metadata ytd-channel-name a"),
      ]),
      published:
        records.map((r) => dateOnly(r.uploadDate) || dateOnly(r.datePublished)).find(Boolean) || null,
    };
  }

  const api = { readVideoDetails };
  root.Transcopy = Object.assign(root.Transcopy || {}, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
