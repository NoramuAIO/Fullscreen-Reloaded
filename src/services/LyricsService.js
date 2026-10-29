/**
 * Lyrics orchestration service.
 * Manages provider priority chain and resolves lyrics for the active track.
 */
import { SpotifyLyricsProvider } from "./providers/SpotifyLyricsProvider.js";
import { LrclibLyricsProvider } from "./providers/LrclibLyricsProvider.js";
import { GeniusLyricsProvider } from "./providers/GeniusLyricsProvider.js";
import { AppleMusicLyricsProvider } from "./providers/AppleMusicLyricsProvider.js";
import { AppleMusicAuth } from "./AppleMusicAuth.js";
import { Settings } from "../utils/settings.js";

const _lyricsCache = new Map();
const _inflight = new Map();

export const LyricsService = {
  providers: {
    applemusic: new AppleMusicLyricsProvider(),
    lrclib: new LrclibLyricsProvider(),
    genius: new GeniusLyricsProvider(),
    spotify: new SpotifyLyricsProvider(),
  },

  getOrderedProviders() {
    const pref = Settings.get("lyricsProvider") || "auto";

    if (pref === "applemusic") return [this.providers.applemusic];
    if (pref === "lrclib") return [this.providers.lrclib];
    if (pref === "genius") return [this.providers.genius];
    if (pref === "spotify") return [this.providers.spotify];

    // Requested order for "auto": Apple Music -> LRCLIB -> Genius -> Spotify
    return [
      this.providers.applemusic,
      this.providers.lrclib,
      this.providers.genius,
      this.providers.spotify,
    ];
  },

  clearCache() {
    _lyricsCache.clear();
    _inflight.clear();
  },

  _cacheResult(trackKey, result) {
    if (!trackKey || !result) return;
    if (_lyricsCache.size > 100) {
      const firstKey = _lyricsCache.keys().next().value;
      _lyricsCache.delete(firstKey);
    }
    _lyricsCache.set(trackKey, result);
  },

  async resolve(track) {
    if (!track) return { type: "none", lines: [] };
    const trackKey = track.uri || (track.name + "_" + (track.artists?.[0]?.name || ""));

    // 1. Instant Cache hit (0ms)
    if (trackKey && _lyricsCache.has(trackKey)) {
      return _lyricsCache.get(trackKey);
    }

    // 2. Deduplicate concurrent calls for the same track
    if (trackKey && _inflight.has(trackKey)) {
      return _inflight.get(trackKey);
    }

    const promise = this._resolveInternal(track, trackKey);
    if (trackKey) {
      _inflight.set(trackKey, promise);
    }

    try {
      return await promise;
    } finally {
      if (trackKey) {
        _inflight.delete(trackKey);
      }
    }
  },

  async _resolveInternal(track, trackKey) {
    const pref = Settings.get("lyricsProvider") || "auto";

    if (pref === "auto") {
      let unsyncedCandidate = null;

      // 1. Apple Music (word-synced / synced)
      try {
        const amRes = await this.providers.applemusic.fetch(track);
        if (amRes && amRes.lines?.length) {
          if (amRes.type === "synced" || amRes.type === "word-synced") {
            this._cacheResult(trackKey, amRes);
            return amRes;
          }
          unsyncedCandidate = amRes;
        }
      } catch (_) {}

      // 2. LRCLIB & Spotify (start Spotify in background so there is zero wait if LRCLIB misses)
      const spotifyPromise = this.providers.spotify.fetch(track).catch(() => null);
      try {
        const lrcRes = await this.providers.lrclib.fetch(track);
        if (lrcRes && lrcRes.lines?.length) {
          if (lrcRes.type === "synced" || lrcRes.type === "word-synced") {
            this._cacheResult(trackKey, lrcRes);
            return lrcRes;
          }
          if (!unsyncedCandidate) unsyncedCandidate = lrcRes;
        }
      } catch (_) {}

      // Check if Spotify has SYNCED lyrics before hitting Genius CORS proxy
      try {
        const spRes = await spotifyPromise;
        if (spRes && spRes.lines?.length) {
          if (spRes.type === "synced" || spRes.type === "word-synced") {
            this._cacheResult(trackKey, spRes);
            return spRes;
          }
          // Hold Spotify unsynced at lower priority than Genius
          var spotifyUnsynced = spRes;
        }
      } catch (_) {}

      // 3. Genius (unsynced lyrics — higher priority than Spotify unsynced)
      if (!unsyncedCandidate) {
        try {
          const genRes = await this.providers.genius.fetch(track);
          if (genRes && genRes.lines?.length) {
            unsyncedCandidate = genRes;
          }
        } catch (_) {}
      }

      // 4. Fallback to unsynced candidate (Apple Music / LRCLIB / Genius) or Spotify unsynced
      const finalUnsynced = unsyncedCandidate || spotifyUnsynced || null;
      if (finalUnsynced) {
        this._cacheResult(trackKey, finalUnsynced);
        return finalUnsynced;
      }

      return { type: "none", lines: [] };
    }

    // Explicit single-provider selection
    const chain = this.getOrderedProviders();
    for (const provider of chain) {
      try {
        const result = await provider.fetch(track);
        if (result && result.lines && result.lines.length) {
          this._cacheResult(trackKey, result);
          return result;
        }
      } catch (_) {}
    }

    return { type: "none", lines: [] };
  },
};
