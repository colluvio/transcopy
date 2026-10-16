# Privacy policy: Transcopy

Last updated: 16 October 2026

Transcopy is a free, open-source Firefox extension published by Colluvio.org. It does not collect, store, transmit or sell any personal data.

## What the extension does

When you click its toolbar button (or press its keyboard shortcut) on a youtube.com video page, the extension:

1. reads the transcript YouTube displays in that tab;
2. writes the transcript text to your clipboard.

If YouTube's transcript panel is closed, the extension first presses YouTube's own "Show transcript" button. YouTube's page then loads the transcript from YouTube, exactly as it would if you had clicked that button yourself. Everything the extension itself does happens inside your browser.

## What it does not do

- It sends nothing anywhere. The extension has no server, makes no network requests of its own and contacts no third-party services (no AI services, no analytics).
- It does not read your browsing history or any page you have not clicked the button on.
- It does not use cookies, accounts or identifiers.
- It does not load remote code.

## Data stored on your device

The only thing the extension stores is your "Include timestamps" choice, kept with Firefox's extension storage on your computer. Removing the extension deletes it.

## Permissions

- activeTab: access the current tab only after you click the extension's button or use its shortcut.
- scripting: run the transcript reader in that tab.
- clipboardWrite: put the transcript on your clipboard.
- storage: remember the "Include timestamps" choice.

In Firefox's data-collection settings the extension declares that it collects no data.

## YouTube

Transcripts come from the YouTube page you are viewing. Your use of YouTube is governed by Google's own terms and privacy policy. This extension is not affiliated with YouTube or Google.

## Contact

Questions or concerns: open an issue at https://github.com/colluvio/transcopy/issues.
