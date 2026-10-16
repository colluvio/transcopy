# Testing

There are three layers of testing:

| Layer | Command | Where it runs |
|---|---|---|
| Unit and fixture tests | `npm test` | Locally and in CI |
| Lint (Mozilla's add-on validator) | `npm run lint` | Locally and in CI |
| End-to-end, in real Firefox against live YouTube | `npm run build && npm run test:e2e` | Locally only. It depends on YouTube, which changes and sometimes refuses automated sessions. |

## Unit and fixture tests

`test/format.test.js` covers timestamp parsing and padding, whitespace normalization, Unicode and punctuation, repeated segments, hour-long videos and a 20,000-segment transcript.

`test/extract.test.js` runs the content scripts against jsdom using two fixtures in `test/fixtures/`:

- `modern.html`: the current "In this video" panel, with chapters, accessibility labels, a hidden stale panel, line breaks and non-Latin text;
- `legacy.html`: the older panel, with its language dropdown and a video longer than an hour.

The fixtures copy YouTube's DOM structure but contain only invented text. The tests cover:

- the panel already open or initially closed;
- the panel open on its Chapters tab;
- segments arriving gradually;
- a missing transcript, a load failure and a loading indicator that never goes away;
- stale content during in-page navigation, and navigation during loading;
- timestamps that go backwards;
- pages that aren't watch pages;
- transcript text treated as text, never markup.

## End-to-end test

`e2e/run.mjs` starts Firefox through geckodriver and installs `dist/*.zip` as a temporary add-on. It then clicks the extension's toolbar button from Firefox's privileged chrome context, which grants `activeTab` exactly like a real click. The popup copies, and the test reads the system clipboard and compares it with what YouTube's panel shows.

```bash
npm run build
npm run test:e2e                                  # headless
HEADED=1 npm run test:e2e                         # watch it
E2E_ONLY=supplied-closed,long npm run test:e2e    # selected scenarios
FIREFOX_BIN=/path/to/firefox GECKODRIVER=/path/to/geckodriver npm run test:e2e
```

Firefox 140+ and geckodriver 0.36+ are needed (geckodriver runs with `--allow-system-access`). Selenium Manager downloads both if the variables are unset.

| Scenario | Video | What is checked |
|---|---|---|
| `supplied-closed` | `0UPvLfZ6X3Q` (English, auto-generated, 13:29) | Panel closed → the extension opens it. 104 lines, one per segment. The first and last lines match the panel. No timestamps or "1 minute, 8 seconds" labels. |
| `supplied-open-timestamps` | same | Panel opened by hand first. Every line is `[MM:SS] text`, from `[00:00]` to `[13:29]`, and the `[01:08]` line is clean. |
| `manual-captions` | `av3zdxYvCp8` (TED-Ed, manual English captions) | Complete copy that matches the panel. |
| `spanish-auto` | `8yJyKGOwCW4` (Spanish, auto-generated, 1:27:53) | `[HH:MM:SS]` timestamps and 666 lines. The text stays Spanish, with no translation. |
| `long` | `DrM1rex7ooc` (3:00:00) | 1,346 lines, the last one at 2:59:18, about 150,000 characters. |
| `missing` | `1VMI7nffU-Q` (silent video, no captions) | Clipboard untouched, `NO_TRANSCRIPT`. |
| `spa-navigation` | `0UPvLfZ6X3Q` → related video | Copying 200 ms after an in-page navigation never returns the previous video's transcript. |
| `spa-to-known-video` | `av3zdxYvCp8` → `0UPvLfZ6X3Q` | After YouTube's in-page navigation, the copy is the new video's full transcript. |
| `load-failure` | `CLCJaiyjKkc` | YouTube often leaves this panel empty for anonymous automated sessions. The result is either clipboard untouched with `LOAD_FAILED`, or a complete copy. |
| `reload` | `0UPvLfZ6X3Q` | Still works after a page reload. |
| `not-a-video` | youtube.com home | Clipboard untouched. |

### Results, 16 October 2026 (Firefox 158.0, geckodriver 0.37.1, Linux/WSL2)

All scenarios passed: 39 checks in the full run, plus 5 in the `spa-to-known-video` and `load-failure` scenarios added afterwards. Copy times were 1.5–3 s, including opening the panel.

Observations:

- In this anonymous, automated profile, YouTube refused transcripts for roughly half of the videos sampled. Its own `get_transcript` request returned HTTP 400 `FAILED_PRECONDITION`, and the panel stayed empty. This also happened with a visible (non-headless) window. The user's own Firefox loaded such transcripts, so this looks like YouTube treating automated sessions differently. The extension reports `LOAD_FAILED` in that case and copies nothing.
- The tests ran in a fresh profile, where YouTube's cookie banner appears; the e2e script declines it ("Reject all").

## Manual test checklist

Use this before each release, in your normal Firefox profile. Load the extension with `npm start` or `about:debugging` → **Load Temporary Add-on…** → `extension/manifest.json`.

1. **Supplied video, panel closed.** Open https://www.youtube.com/watch?v=0UPvLfZ6X3Q without opening the transcript, then click the toolbar button.
   - The popup says "Copied 104 segments (up to 13:29)." and YouTube's transcript panel is now open.
   - Paste into a text editor: 104 lines with no timestamps, and the line at 1:08 starts "prompt you to open up…" with no "1 minute, 8 seconds".
2. **Timestamps.** Tick **Include timestamps**. It copies again. Paste: lines start `[00:00]` … `[13:29]`. Close and reopen the popup: the box is still ticked.
3. **Panel already open.** Reload, open the transcript with YouTube's **Show transcript**, then click the button. The result is the same.
4. **Chapters tab.** In the open panel, switch to **Chapters**, then click the button. The panel switches back to Transcript and copies.
5. **Another language.** https://www.youtube.com/watch?v=8yJyKGOwCW4 (Spanish). The paste is in Spanish. With timestamps, lines start `[00:00:00]` because the video is over an hour.
6. **Manual captions.** https://www.youtube.com/watch?v=av3zdxYvCp8 (TED-Ed) copies a complete transcript.
7. **Long video.** https://www.youtube.com/watch?v=DrM1rex7ooc (3 hours) copies 1,346 segments, up to 2:59:18.
8. **No transcript.** https://www.youtube.com/watch?v=1VMI7nffU-Q shows "This video doesn't offer a transcript…", and the clipboard is unchanged.
9. **Possible load failure.** https://www.youtube.com/watch?v=CLCJaiyjKkc gives either a full copy or "YouTube opened the transcript panel but didn't load the transcript…", never a partial copy.
10. **Navigation.** Copy on one video, click a related video, then immediately click the button. You get either the new video's transcript or a "still loading / switched video" message, never the previous transcript.
11. **Reload.** Reload a video page and copy again.
12. **Other pages.** On the YouTube home page and on a non-YouTube site, the popup says to open a video page.
13. **Keyboard shortcut.** <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd> opens the popup and copies. It can be changed in `about:addons` → gear → Manage Extension Shortcuts.
14. **Clipboard.** Paste into another application (not only Firefox) to confirm the system clipboard is used.
15. **Dark mode.** The popup is readable with the system in dark mode.
