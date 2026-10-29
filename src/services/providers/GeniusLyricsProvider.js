/**
 * Genius lyrics provider.
 * Fetches unsynced lyrics through a CORS proxy to bypass Spotify CEF cross-origin restrictions.
 */
import { BaseLyricsProvider } from "./BaseLyricsProvider.js";

async function safeProxyFetch(targetUrl, timeoutMs = 1800) {
  const proxies = [
    (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  ];

  for (const getProxyUrl of proxies) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const proxyUrl = getProxyUrl(targetUrl);
      const res = await fetch(proxyUrl, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res && res.ok) {
        return res;
      }
    } catch (e) {
      clearTimeout(timer);
      // Try next proxy
    }
  }
  return null;
}

export class GeniusLyricsProvider extends BaseLyricsProvider {
  async fetch(track) {
    if (!track) return null;
    const meta = track.metadata || {};
    const rawTitle = meta.title || track.name || "";
    const artist = (track.artists && track.artists[0]?.name) || meta.artist_name?.split(",")[0]?.trim() || "";

    if (!rawTitle || !artist) return null;

    // Clean title for search
    const cleanTitle = rawTitle
      .replace(/\s*[\(\[](feat\.|featuring|with|remastered|remaster|deluxe|bonus track)[^\)\]]*[\)\]]/gi, "")
      .replace(/\s*-\s*(remastered|live|mono|stereo|bonus track).*/gi, "")
      .trim();

    const query = `${cleanTitle || rawTitle} ${artist}`.trim();

    try {
      const searchUrl = `https://genius.com/api/search/multi?per_page=5&q=${encodeURIComponent(query)}`;
      const searchRes = await safeProxyFetch(searchUrl, 2500);
      if (!searchRes) return null;

      const data = await searchRes.json().catch(() => null);
      if (!data?.response?.sections) return null;

      const songSection = data.response.sections.find((s) => s.type === "song");
      if (!songSection || !songSection.hits?.length) return null;

      // Find best match among hits
      const hit = songSection.hits[0]?.result;
      if (!hit?.url) return null;

      // Fetch the song page through CORS proxy
      const pageRes = await safeProxyFetch(hit.url, 2500);
      if (!pageRes) return null;

      const html = await pageRes.text().catch(() => "");
      if (!html || !html.includes("data-lyrics-container")) return null;

      // Extract all data-lyrics-container divs
      const regex = /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi;
      let match;
      let rawLyrics = "";

      while ((match = regex.exec(html)) !== null) {
        let piece = match[1]
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#x27;/g, "'")
          .replace(/&quot;/g, '"');
        rawLyrics += piece + "\n\n";
      }

      if (!rawLyrics.trim()) return null;

      // Clean metadata headers, contributor counts, and embeds
      const linesText = rawLyrics
        .replace(/^.*Contributors.*$/gm, "")
        .replace(/^Translations.*$/gm, "")
        .replace(/^[0-9]*Embed$/gm, "")
        .replace(/Embed$/gm, "")
        .replace(/You might also like.*$/gm, "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (!linesText.length) return null;

      const lines = linesText.map((text) => ({
        startMs: 0,
        words: [{ text, startMs: null }],
      }));

      return {
        type: "unsynced",
        source: "Genius",
        lines,
      };
    } catch (e) {
      return null;
    }
  }
}
