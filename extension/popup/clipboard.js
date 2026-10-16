/*
 * Clipboard interaction. The extension declares the "clipboardWrite"
 * permission, which lets extension pages write text with the standard
 * Clipboard API without a separate click.
 */
export async function writeText(text) {
  await navigator.clipboard.writeText(text);
}
