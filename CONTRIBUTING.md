# Contributing

Thanks for helping. This is a small, deliberately simple project: plain JavaScript, HTML and CSS, no framework, no bundler and no runtime dependencies.

## Reporting a problem

YouTube changes its pages often, so the most useful bug report includes:

- the video URL;
- your Firefox version;
- the message the popup showed;
- whether the transcript panel was open, and whether it shows the "In this video" header with Chapters/Transcript tabs (current layout) or a language dropdown at the bottom (older layout).

Open an issue at https://github.com/colluvio/copy-youtube-transcript/issues.

## Making a change

```bash
npm ci
npm test
npm run lint
npm start          # try it in Firefox with web-ext run
```

Guidelines:

- **Keep the concerns separate**: detection (`detect.js`), extraction (`segments.js`), timestamps (`timestamps.js`), formatting (`format.js`), orchestration (`run.js`), clipboard and UI (`popup/`).
- **Never copy partial or mismatched transcripts.** Fail with an error code instead, and add its message to `popup/messages.js`.
- **No network requests, analytics, remote code or new permissions.** Any change to permissions needs a matching update to `PRIVACY.md` and the AMO listing.
- **No undocumented YouTube API calls.** Read what the page displays.
- **Treat transcript text as untrusted.** Never insert it into the DOM as HTML.
- **Fixtures use synthetic text.** When YouTube's markup changes, copy its structure into `test/fixtures/`, but replace every transcript line, title and name with invented text.
- Add or update tests for every behavior change, and run `npm run test:e2e` locally for anything that touches extraction. See [docs/TESTING.md](docs/TESTING.md).
- Update `CHANGELOG.md`.

## Releasing

1. Update the version in `extension/manifest.json` and `package.json`, and add a `CHANGELOG.md` entry.
2. Commit, then tag `vX.Y.Z` and push the tag. The Release workflow tests, lints, builds and attaches the zip to a GitHub Release.
3. Submit the new version to Mozilla. See [docs/PUBLISHING.md](docs/PUBLISHING.md).

By contributing you agree that your contributions are licensed under the MIT license.
