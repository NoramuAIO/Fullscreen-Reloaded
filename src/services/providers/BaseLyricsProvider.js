/**
 * Base Lyrics Provider abstraction.
 */

export class BaseLyricsProvider {
  /**
   * @param {Object} track
   * @returns {Promise<{ type: "synced" | "word-synced" | "unsynced" | "none", source: string, lines: Array } | null>}
   */
  async fetch(track) {
    throw new Error("fetch() not implemented");
  }

  splitWords(text, lineStartMs) {
    const parts = (text || "").trim().split(/\s+/).filter(Boolean);
    return parts.map((w, idx) => ({
      text: idx < parts.length - 1 ? w + " " : w,
      startMs: lineStartMs,
    }));
  }
}
