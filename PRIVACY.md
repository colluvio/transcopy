# Privacy policy: Copy YouTube Transcript

Last updated: 16 October 2026

Copy YouTube Transcript is a free, open-source Firefox extension published by Colluvio.org. It does not collect, store, transmit or sell any personal data.

## What the extension does

When you click its toolbar button (or press its keyboard shortcut) on a youtube.com video page, the extension:

1. reads the transcript YouTube displays in that tab, opening YouTube's own transcript panel first if it is closed;
2. writes the transcript text to your clipboard.

All of this happens inside your browser.

## What it does not do

- It makes no network requests. The extension has no server and calls no third-party services, including AI services and analytics.
- It does not read your browsing history or any page you have not clicked the button on.
- It does not use cookies, accounts or identifiers.
- It does not load remote code.

## Data stored on your device

The only thing the extension stores is your "Include timestamps" choice, kept with Firefox's extension storage on your computer. Removing the extension deletes it.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Access the current tab only after you click the extension's button or use its shortcut. |
| `scripting` | Run the transcript reader in that tab. |
| `clipboardWrite` | Put the transcript on your clipboard. |
| `storage` | Remember the "Include timestamps" choice. |

In Firefox's data-collection settings the extension declares that it collects no data.

## YouTube

Transcripts come from the YouTube page you are viewing. Your use of YouTube is governed by Google's own terms and privacy policy. This extension is not affiliated with YouTube or Google.

## Contact

Questions or concerns: open an issue at https://github.com/colluvio/copy-youtube-transcript/issues.
