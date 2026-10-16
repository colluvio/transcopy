/*
 * Error handling: user-facing messages for the error codes returned by the
 * content script (content/run.js) and by the popup itself.
 */
export const MESSAGES = {
  NOT_A_VIDEO: "Open a YouTube video page (youtube.com/watch…), then try again.",
  PAGE_NOT_READY: "The video page is still loading. Wait a moment and try again.",
  NAVIGATED: "The page switched to another video while copying. Try again.",
  NO_TRANSCRIPT:
    "This video doesn't offer a transcript. YouTube shows no “Show transcript” option for it.",
  LOAD_FAILED:
    "YouTube opened the transcript panel but didn't load the transcript. Reload the page and try again. If an ad is playing, wait until it ends.",
  INCOMPLETE:
    "The transcript didn't finish loading, so nothing was copied. Try again in a moment.",
  INCONSISTENT:
    "The transcript panel looks inconsistent (it may be mixing two videos), so nothing was copied. Reload the page and try again.",
  EMPTY: "The transcript panel is empty, so nothing was copied.",
  INJECTION_FAILED:
    "Firefox didn't allow access to this tab. Reload the YouTube page and try again.",
  CLIPBOARD_FAILED: "The transcript was found, but Firefox didn't allow writing to the clipboard.",
  UNEXPECTED: "Something unexpected went wrong. Reload the page and try again.",
};

export function messageFor(code) {
  return MESSAGES[code] || MESSAGES.UNEXPECTED;
}
