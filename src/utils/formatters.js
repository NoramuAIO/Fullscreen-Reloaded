/**
 * String, time, and image formatters.
 */

export function formatMs(ms) {
  if (!ms || ms < 0 || isNaN(ms)) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Resolves Spotify image strings or internal paths to loadable URLs.
 * Spotify 1.3.6 can return:
 * - Direct HTTP(S) URLs (e.g. https://i.scdn.co/image/...)
 * - Spotify URI hashes (e.g. spotify:image:ab67616d0000b273...)
 * - Raw 40-character hex hashes
 */
export function resolveImageUrl(value) {
  if (!value || typeof value !== "string") return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }
  const hash = value.split(":").pop();
  if (!hash) return "";
  return `https://i.scdn.co/image/${hash}`;
}

export function rgb(arr) {
  if (!arr || !arr.length) return "rgb(16, 16, 20)";
  return `rgb(${Math.round(arr[0])}, ${Math.round(arr[1])}, ${Math.round(arr[2])})`;
}

export function rgba(arr, a) {
  if (!arr || !arr.length) return `rgba(16, 16, 20, ${a})`;
  return `rgba(${Math.round(arr[0])}, ${Math.round(arr[1])}, ${Math.round(arr[2])}, ${a})`;
}
