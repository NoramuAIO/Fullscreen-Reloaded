/**
 * LRCLIB open lyrics provider (https://lrclib.net).
 * Free, open, no API key required. Line-synced and plain lyrics with 503 retry and cleaned search fallback.
 */
import { BaseLyricsProvider } from "./BaseLyricsProvider.js";
import { parseLRC } from "../../utils/parsers.js";

export class LrclibLyricsProvider extends BaseLyricsProvider {
  async fetch(track) {
    if (!track) return null;
    const meta = track.metadata || {};
    const rawTitle = meta.title || track.name || "";
    const artist = (track.artists && track.artists[0]?.name) || meta.artist_name?.split(",")[0]?.trim() || "";
    const durationSec = meta.duration ? Math.round(Number(meta.duration) / 1000) : 0;

    if (!rawTitle || !artist) return null;

    // Clean title (strip features, remasters, bonus tracks)
    const cleanTitle = rawTitle
      .replace(/\s*[\(\[](feat\.|featuring|with|remastered|remaster|deluxe|bonus track)[^\)\]]*[\)\]]/gi, "")
      .replace(/\s*-\s*(remastered|live|mono|stereo|bonus track).*/gi, "")
      .trim();

    const targetTitle = cleanTitle || rawTitle;

    // 1. Single request to structured search (avoids 503 rate-limiting from concurrent bursts)
    const searchRes = await this._search(targetTitle, artist, durationSec);
    if (searchRes && searchRes.lines?.length) {
      return searchRes;
    }

    // 2. Fallback to free-text query search only if structured search returned nothing
    const qRes = await this._searchQuery(`${targetTitle} ${artist}`, durationSec);
    if (qRes && qRes.lines?.length) {
      return qRes;
    }

    return null;
  }

  async _search(title, artist, durationSec = 0) {
    const searchParams = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });
    return await this._tryFetch(`https://lrclib.net/api/search?${searchParams.toString()}`, true, durationSec);
  }

  async _searchQuery(query, durationSec = 0) {
    const params = new URLSearchParams({ q: query });
    return await this._tryFetch(`https://lrclib.net/api/search?${params.toString()}`, true, durationSec);
  }

  async _fetchJsonWithRetry(url) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2200);
        const r = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (r.ok) {
          return await r.json();
        }
        // Retry once on 503 Service Unavailable
        if (r.status === 503 && attempt === 0) {
          await new Promise((res) => setTimeout(res, 450));
          continue;
        }
        return null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  async _tryFetch(url, isSearch = false, durationSec = 0) {
    let res = await this._fetchJsonWithRetry(url);
    if (!res) return null;

    // In search results, prioritize items with syncedLyrics (closest in duration if known)
    if (isSearch && Array.isArray(res)) {
      if (!res.length) return null;
      const syncedItems = res.filter((item) => item && item.syncedLyrics && item.syncedLyrics.trim().length);
      if (syncedItems.length) {
        if (durationSec > 0) {
          syncedItems.sort(
            (a, b) => Math.abs((Number(a.duration) || 0) - durationSec) - Math.abs((Number(b.duration) || 0) - durationSec)
          );
        }
        res = syncedItems[0];
      } else {
        const plainItems = res.filter((item) => item && item.plainLyrics && item.plainLyrics.trim().length);
        res = plainItems[0] || null;
      }
    }
    if (!res) return null;

    if (res.syncedLyrics && res.syncedLyrics.trim().length) {
      const parsed = parseLRC(res.syncedLyrics);
      if (parsed.length) {
        const isWordSynced = parsed.some((l) => l.isWordSynced);
        return {
          type: isWordSynced ? "word-synced" : "synced",
          source: "LRCLIB",
          lines: parsed,
        };
      }
    }

    if (res.plainLyrics && res.plainLyrics.trim().length) {
      const lines = res.plainLyrics
        .split("\n")
        .filter((l) => l.trim().length)
        .map((text) => ({ startMs: 0, words: [{ text, startMs: null }] }));
      if (lines.length) {
        return {
          type: "unsynced",
          source: "LRCLIB",
          lines,
        };
      }
    }

    return null;
  }
}
