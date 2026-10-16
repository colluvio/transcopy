# AMO listing

`amo/metadata.json` is the machine-readable version that `web-ext sign` submits. This page summarizes it for review.

| Field | Value |
|---|---|
| Name | Copy YouTube Transcript |
| Slug / URL | `copy-youtube-transcript-colluvio` → https://addons.mozilla.org/firefox/addon/copy-youtube-transcript-colluvio/ |
| Add-on ID | `copy-youtube-transcript@colluvio.org` |
| Summary | Copy the transcript of a YouTube video to your clipboard in one click, as plain text or with timestamps. Uses the text YouTube shows, in its language. No tracking, no accounts. |
| Category | Photos, Music & Videos (`photos-music-videos`) |
| Tags | `youtube` (AMO only accepts tags from its fixed list) |
| License | MIT |
| Compatibility | Firefox for desktop 140+ (not Android) |
| Homepage | https://github.com/colluvio/copy-youtube-transcript |
| Support website | https://github.com/colluvio/copy-youtube-transcript/issues (set in the Developer Hub; the API can't set it) |
| Source code | https://github.com/colluvio/copy-youtube-transcript |
| Privacy policy | [PRIVACY.md](../PRIVACY.md), uploaded by `node scripts/amo.mjs listing` |
| Data collection | None (`data_collection_permissions.required: ["none"]`) |
| Experimental / requires payment | No / No |
| Icon | `extension/icons/icon-128.png` |
| Screenshots (1280×800) | `amo/screenshots/screenshot-1.png`: "One click copies the transcript YouTube shows, as plain text." · `screenshot-2.png`: "Optional timestamps: [MM:SS] before every line." · `screenshot-3.png`: "Clear messages instead of partial copies." |

The screenshots are rendered from `amo/screenshots/compose.html`, using the popup's real markup and stylesheet with invented transcript text. They contain no third-party video imagery or YouTube logos.

## Full description

See `description` in [metadata.json](metadata.json). AMO accepts a small subset of HTML there; `<b>` is used for headings.
