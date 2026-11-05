/**
 * Apple Music lyrics provider.
 * Fetches studio word-level (TTML karaoke) and line-synced lyrics via open TTML catalog
 * (no user token required), with fallback to authenticated Apple Music catalog API.
 */
import { BaseLyricsProvider } from "./BaseLyricsProvider.js";
import { AppleMusicAuth } from "../AppleMusicAuth.js";
import { parseTTML } from "../../utils/parsers.js";

function normText(s) {
  return String(s || "")
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export class AppleMusicLyricsProvider extends BaseLyricsProvider {
  async fetch(track) {
    if (!track) return null;
    const meta = track.metadata || {};
    const rawTitle = meta.title || track.name || "";
    const artist = (track.artists && track.artists[0]?.name) || meta.artist_name?.split(",")[0]?.trim() || "";
    const durationSec = meta.duration ? Math.round(Number(meta.duration) / 1000) : 0;
    const durationMs = Number(meta.duration) || 0;

    if (!rawTitle || !artist) return null;

    const cleanTitle = rawTitle
      .replace(/\s*[\(\[](feat\.|featuring|with|remastered|remaster|deluxe|bonus track)[^\)\]]*[\)\]]/gi, "")
      .replace(/\s*-\s*(remastered|live|mono|stereo|bonus track).*/gi, "")
      .trim();

    const targetTitle = cleanTitle || rawTitle;

    // 1. Public Apple Music TTML Catalog (Zero Auth Required, Full CORS)
    const publicRes = await this._fetchPublicTTML(targetTitle, artist, durationSec);
    if (publicRes && publicRes.lines?.length) {
      return publicRes;
    }

    // 2. Fallback to authenticated Apple Music API if user configured Music-User-Token
    if (!AppleMusicAuth.isConnected()) return null;

    const devToken = await AppleMusicAuth.getDeveloperToken();
    if (!devToken) return null;

    const songId = await this.findSongId(devToken, targetTitle, artist, durationMs);
    if (!songId) return null;

    const userToken = AppleMusicAuth.getUserToken();
    const headers = {
      Authorization: `Bearer ${devToken}`,
      Origin: "https://music.apple.com",
    };
    if (userToken) {
      headers["Music-User-Token"] = userToken;
    }

    let res = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      res = await fetch(
        `https://amp-api.music.apple.com/v1/catalog/${AppleMusicAuth.storefront}/songs/${songId}/lyrics`,
        { headers, signal: controller.signal }
      ).then((r) => (r.ok ? r.json() : null));
      clearTimeout(timeoutId);
    } catch (e) {
      return null;
    }

    const ttml = res && res.data && res.data[0] && res.data[0].attributes && res.data[0].attributes.ttml;
    if (!ttml) return null;

    const lines = parseTTML(ttml);
    if (!lines.length) return null;

    const wordSynced = lines.some((l) => l.isWordSynced);
    const lineSynced = lines.some((l) => l.hasLineTime);
    return {
      type: wordSynced ? "word-synced" : lineSynced ? "synced" : "unsynced",
      source: "Apple Music",
      lines,
    };
  }

  async _fetchPublicTTML(title, artist, durationSec = 0) {
    try {
      let results = await this._queryBinimum(title, artist);
      if (!results.length && title.includes(" - ")) {
        const shortTitle = title.split(" - ")[0].trim();
        if (shortTitle) results = await this._queryBinimum(shortTitle, artist);
      }
      if (!results.length) return null;

      const normArtist = normText(artist);
      const normTitle = normText(title);

      // Filter by artist or title match (keep all timing_types including 'none' so unsynced Apple Music tracks also work)
      const valid = results.filter((item) => {
        if (!item || !item.lyricsUrl) return false;
        const itemArtist = normText(item.artist_name);
        const itemTitle = normText(item.track_name);
        const artistMatch = itemArtist.includes(normArtist) || normArtist.includes(itemArtist);
        const titleMatch = itemTitle.includes(normTitle) || normTitle.includes(itemTitle);
        return artistMatch || titleMatch;
      });

      const pool = valid.length ? valid : results.filter((item) => item?.lyricsUrl);
      if (!pool.length) return null;

      const timingRank = (t) => (t === "word" ? 2 : t === "line" ? 1 : 0);

      // Sort: strongly prefer word > line > none, and prefer close duration
      pool.sort((a, b) => {
        const rankA = timingRank(a.timing_type);
        const rankB = timingRank(b.timing_type);

        const diffA = durationSec > 0 ? Math.abs((Number(a.duration) || 0) - durationSec) : 0;
        const diffB = durationSec > 0 ? Math.abs((Number(b.duration) || 0) - durationSec) : 0;
        const closeA = diffA <= 15 ? 1 : 0;
        const closeB = diffB <= 15 ? 1 : 0;

        if (closeA !== closeB) return closeB - closeA;
        if (rankA !== rankB) return rankB - rankA;
        return diffA - diffB;
      });

      const best = pool[0];
      const ttmlCtrl = new AbortController();
      const ttmlTimer = setTimeout(() => ttmlCtrl.abort(), 2400);
      const ttmlRes = await fetch(best.lyricsUrl, { signal: ttmlCtrl.signal });
      clearTimeout(ttmlTimer);
      if (!ttmlRes.ok) return null;

      const ttmlText = await ttmlRes.text();
      if (!ttmlText || !ttmlText.includes("<p")) return null;

      const lines = parseTTML(ttmlText);
      if (!lines.length) return null;

      const wordSynced = best.timing_type === "word" && lines.some((l) => l.isWordSynced);
      const lineSynced = best.timing_type !== "none" && lines.some((l) => l.hasLineTime || l.isWordSynced);
      return {
        type: wordSynced ? "word-synced" : lineSynced ? "synced" : "unsynced",
        source: "Apple Music",
        lines,
      };
    } catch (e) {
      return null;
    }
  }

  async _queryBinimum(title, artist) {
    try {
      const params = new URLSearchParams({
        track: title,
        artist: artist,
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2400);
      const r = await fetch(`https://lyrics-api.binimum.org/?${params.toString()}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data?.results) ? data.results : [];
    } catch (e) {
      return [];
    }
  }

  async findSongId(devToken, title, artist, durationMs) {
    const term = encodeURIComponent(`${title} ${artist}`);
    let res = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      res = await fetch(
        `https://amp-api.music.apple.com/v1/catalog/${AppleMusicAuth.storefront}/search?term=${term}&types=songs&limit=5`,
        { headers: { Authorization: `Bearer ${devToken}`, Origin: "https://music.apple.com" }, signal: controller.signal }
      ).then((r) => (r.ok ? r.json() : null));
      clearTimeout(timer);
    } catch (e) {
      return null;
    }

    const songs = res && res.results && res.results.songs && res.results.songs.data;
    if (!songs || !songs.length) return null;

    let best = songs[0];
    if (durationMs) {
      let bestDiff = Infinity;
      for (const s of songs) {
        const d = Number(s.attributes && s.attributes.durationInMillis) || 0;
        const diff = Math.abs(d - durationMs);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = s;
        }
      }
    }
    return best.id;
  }
}
