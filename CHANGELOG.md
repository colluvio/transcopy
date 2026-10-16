# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.1] - 2026-10-16

### Changed

- Renamed from "Copy YouTube Transcript" to **Transcopy**, because several add-ons with nearly the same name already exist on addons.mozilla.org.
- New add-on ID `transcopy@colluvio.org` (was `copy-youtube-transcript@colluvio.org`; that version was never on addons.mozilla.org). A temporary install of 1.0.0 is a separate add-on: remove it before installing this one.
- The repository moved to https://github.com/colluvio/transcopy. The old address redirects.
- The release package is now `transcopy-<version>.zip`.

No change in behavior.

## [1.0.0] - 2026-10-16

### Added

- Toolbar popup that copies the transcript of the current YouTube video when it opens. The keyboard shortcut is <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd>.
- Plain-text output (one segment per line) and optional timestamps (`[MM:SS]`, or `[HH:MM:SS]` for videos over an hour). The choice is remembered.
- Support for YouTube's current transcript panel (`transcript-segment-view-model`) and the older one (`ytd-transcript-segment-renderer`, including the name of the selected language).
- Opens YouTube's transcript panel with its own "Show transcript" button when it is closed, including when the panel is on its Chapters tab.
- Completeness checks: waits for a stable segment list with no loading indicator. It refuses stale content during in-page navigation and timestamps that go backwards.
- Clear error messages for pages that aren't videos, missing transcripts, load failures, incomplete loads, navigation during copying and clipboard errors.
- Unit tests with synthetic HTML fixtures, an end-to-end test in real Firefox, `web-ext lint`, and GitHub Actions for CI and release packaging.

[1.0.1]: https://github.com/colluvio/transcopy/releases/tag/v1.0.1
[1.0.0]: https://github.com/colluvio/transcopy/releases/tag/v1.0.0
