# transcopy: agent guide

Transcopy is a Firefox MV3 extension that copies the transcript YouTube's panel shows to the clipboard, as plain text or with timestamps, plus a video-details header. It lives in a **public** repo, `colluvio/transcopy` (push over SSH), is listed on AMO as `transcopy` (ID `transcopy@colluvio.org`), and is linked from colluvio.org. Not factory-managed. Plain JS/HTML/CSS: no framework, bundler or runtime dependencies.

## Read only what the task needs
- `CONTRIBUTING.md`: the guidelines below in full. It's short.
- `README.md` → "How it works" and "Limitations": the file roles and YouTube DOM findings.
- `docs/TESTING.md`: unit, e2e and manual checklist, with past results. `docs/PUBLISHING.md`: the AMO flow and its **Status** table (current release state).

## Map
- `extension/manifest.json`.
- `extension/content/`, injected on click via `activeTab` + `scripting`: `detect.js` (page/video identity, panel), `segments.js` (current and old layouts), `timestamps.js`, `metadata.js` (schema.org `VideoObject` in `#microformat`), `format.js`, `run.js` (orchestration and staleness checks).
- `extension/popup/`: `popup.js`/`.html`/`.css`, `clipboard.js`, `messages.js` (error texts).
- `test/`: node:test with jsdom fixtures. `e2e/run.mjs`: real Firefox against live YouTube.
- `amo/`: listing text, metadata and screenshots. `scripts/`: `amo.mjs`, `amo-submit.sh`, icon and screenshot renderers. `dist/` is gitignored.

## Commands
```sh
npm ci
npm run check        # npm test && web-ext lint
npm run build        # dist/transcopy-<version>.zip
npm start            # web-ext run on the test video
npm run test:e2e     # live YouTube; needs Firefox 140+, geckodriver 0.36+; YouTube often refuses automated sessions
```

## Rules
- Never copy partial or mismatched transcripts. Fail with an error code and add its message to `popup/messages.js`.
- Don't call undocumented YouTube APIs (`get_transcript`, `timedtext`). Read what the page shows.
- No network requests, analytics, remote code or new permissions. A permission change needs matching updates to `PRIVACY.md` and the AMO listing.
- Release: bump the manifest and `package.json` versions and update `CHANGELOG.md`. AMO submission follows `docs/PUBLISHING.md` and is outward-facing: get the user's OK.
- AMO credentials come from a local env file passed as `AMO_ENV_FILE=` (see `docs/PUBLISHING.md`). Never read, print or commit it.
