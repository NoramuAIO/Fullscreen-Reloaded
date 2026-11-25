/**
 * Bridge layer for interacting with SpotiKit and Spotify Desktop.
 * Provides safe wrappers, lifecycle signals, token resolution, queue normalization, and event management.
 */

const PLAYER_EVENT_MAP = {
  songchange: "track",
  playpause: "playpause",
  progress: "progress",
  state: "state",
};

function _normalizeQueueEntry(entry) {
  if (!entry) return null;
  if (entry.metadata || entry.contextTrack?.metadata) {
    return entry;
  }

  const title = entry.title || entry.name || "";
  const artistName =
    typeof entry.artist === "string"
      ? entry.artist
      : entry.artist?.name || (Array.isArray(entry.artists) ? entry.artists[0]?.name || "" : "");
  const albumName =
    typeof entry.album === "string"
      ? entry.album
      : entry.album?.name || "";
  const imageUrl = entry.image || entry.album?.images?.[0]?.url || "";

  return {
    uri: entry.uri || "",
    ...(entry.uid !== undefined ? { uid: entry.uid } : {}),
    name: title,
    metadata: {
      title,
      artist_name: artistName,
      album_title: albumName,
      image_xlarge_url: imageUrl,
    },
    artists: artistName ? [{ name: artistName }] : [],
    album: {
      name: albumName,
      images: imageUrl ? [{ url: imageUrl }] : [],
    },
  };
}

export const SpotiKitBridge = {
  _ctx: null,

  /**
   * Stores the SpotiKit extension context for lifecycle signals.
   */
  init(ctx) {
    this._ctx = ctx || null;
    return this._ctx;
  },

  getSignal() {
    return this._ctx?.signal || null;
  },

  isStopped() {
    return Boolean(this._ctx?.signal?.aborted);
  },

  /**
   * Creates an AbortSignal that aborts after `ms` milliseconds OR when `ctx.signal` aborts.
   * Cleans up timers and parent listeners once aborted.
   */
  createTimeoutSignal(ms) {
    const controller = new AbortController();
    const parentSignal = this.getSignal();

    if (parentSignal?.aborted) {
      controller.abort(parentSignal.reason);
      return controller.signal;
    }

    let timer = null;
    let onParentAbort = null;

    const cleanup = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (parentSignal && onParentAbort) {
        parentSignal.removeEventListener("abort", onParentAbort);
        onParentAbort = null;
      }
    };

    if (parentSignal) {
      onParentAbort = () => {
        cleanup();
        if (!controller.signal.aborted) {
          controller.abort(parentSignal.reason);
        }
      };
      parentSignal.addEventListener("abort", onParentAbort, { once: true });
    }

    if (typeof ms === "number" && Number.isFinite(ms) && ms >= 0) {
      timer = setTimeout(() => {
        cleanup();
        if (!controller.signal.aborted) {
          const reason =
            typeof DOMException !== "undefined"
              ? new DOMException("The operation was aborted due to timeout", "TimeoutError")
              : new Error("TimeoutError");
          controller.abort(reason);
        }
      }, ms);
    }

    controller.signal.addEventListener("abort", cleanup, { once: true });
    return controller.signal;
  },

  /**
   * Awaits SpotiKit readiness without legacy polling loops.
   */
  async waitForReady() {
    if (typeof SpotiKit === "undefined" || !SpotiKit) return null;
    try {
      if (SpotiKit.ready) {
        await SpotiKit.ready;
      }
      return SpotiKit;
    } catch (_) {
      return SpotiKit;
    }
  },

  /**
   * Retrieves Spotify session access token across Platform & Http surfaces.
   */
  async getAccessToken() {
    if (typeof SpotiKit === "undefined" || !SpotiKit) return null;

    try {
      const authApi = SpotiKit.Platform?.AuthorizationAPI;
      if (typeof authApi?.getState === "function") {
        const state = authApi.getState();
        if (
          state?.isAuthorized !== false &&
          typeof state?.token?.accessToken === "string" &&
          state.token.accessToken
        ) {
          return state.token.accessToken;
        }
      }
    } catch (_) {}

    try {
      const authApi = SpotiKit.Platform?.AuthorizationAPI;
      if (typeof authApi?.getAccessToken === "function") {
        const res = await authApi.getAccessToken();
        const token = typeof res === "string" ? res : res?.accessToken;
        if (token) return token;
      }
    } catch (_) {}

    try {
      const session = SpotiKit.Platform?.Session;
      if (typeof session?.accessToken === "string" && session.accessToken) {
        return session.accessToken;
      }
      if (typeof session?.getAccessToken === "function") {
        const res = await session.getAccessToken();
        const token = typeof res === "string" ? res : res?.accessToken;
        if (token) return token;
      }
    } catch (_) {}

    try {
      if (typeof SpotiKit.Http?.get === "function") {
        const res = await SpotiKit.Http.get("sp://oauth/v2/token");
        const parsed = typeof res === "string" ? JSON.parse(res) : res;
        const token = parsed?.accessToken || parsed?.token?.accessToken;
        if (typeof token === "string" && token) return token;
      }
    } catch (_) {}

    return null;
  },

  async httpGet(url, options) {
    if (typeof SpotiKit === "undefined" || typeof SpotiKit.Http?.get !== "function") {
      return null;
    }
    return options !== undefined
      ? SpotiKit.Http.get(url, options)
      : SpotiKit.Http.get(url);
  },

  async getAudioData(uri) {
    if (!uri || typeof SpotiKit === "undefined" || typeof SpotiKit.Audio?.analysis !== "function") {
      return null;
    }
    try {
      return await SpotiKit.Audio.analysis(uri);
    } catch (_) {
      return null;
    }
  },

  /**
   * Fetches and normalizes the next upcoming track in queue.
   */
  async getNextTrack() {
    if (typeof SpotiKit === "undefined" || !SpotiKit) return null;

    try {
      if (SpotiKit.Queue?.next?.length) {
        return _normalizeQueueEntry(SpotiKit.Queue.next[0]);
      }
    } catch (_) {}

    try {
      if (SpotiKit.Platform?.PlayerAPI?._queue?.nextTracks?.length) {
        return _normalizeQueueEntry(SpotiKit.Platform.PlayerAPI._queue.nextTracks[0]);
      }
    } catch (_) {}

    try {
      if (typeof SpotiKit.Platform?.PlayerAPI?.getQueue === "function") {
        const q = await SpotiKit.Platform.PlayerAPI.getQueue();
        if (q?.nextTracks?.length) {
          return _normalizeQueueEntry(q.nextTracks[0]);
        }
      }
    } catch (_) {}

    return null;
  },

  getCurrentTrack() {
    if (typeof SpotiKit === "undefined" || !SpotiKit.Player) return null;
    return SpotiKit.Player.track || SpotiKit.Player.state?.item || null;
  },

  getDuration() {
    return Number(typeof SpotiKit !== "undefined" ? SpotiKit.Player?.duration : 0) || 0;
  },

  getProgress() {
    return Number(typeof SpotiKit !== "undefined" ? SpotiKit.Player?.position : 0) || 0;
  },

  isPlaying() {
    return Boolean(typeof SpotiKit !== "undefined" && SpotiKit.Player?.isPlaying);
  },

  seek(ms) {
    if (typeof SpotiKit !== "undefined" && typeof SpotiKit.Player?.seek === "function") {
      SpotiKit.Player.seek(Math.max(0, Number(ms) || 0));
    }
  },

  togglePlay() {
    if (typeof SpotiKit !== "undefined") {
      SpotiKit.Player?.toggle?.();
    }
  },

  next() {
    if (typeof SpotiKit !== "undefined") {
      SpotiKit.Player?.next?.();
    }
  },

  back() {
    if (typeof SpotiKit !== "undefined") {
      SpotiKit.Player?.previous?.();
    }
  },

  toggleShuffle() {
    if (typeof SpotiKit !== "undefined" && typeof SpotiKit.Player?.setShuffle === "function") {
      SpotiKit.Player.setShuffle(!this.getShuffle());
    }
  },

  getShuffle() {
    return Boolean(typeof SpotiKit !== "undefined" && SpotiKit.Player?.shuffle);
  },

  getRepeatMode() {
    const mode = typeof SpotiKit !== "undefined" ? SpotiKit.Player?.repeat : "off";
    return mode === "context" || mode === "track" || mode === "off" ? mode : "off";
  },

  getRepeat() {
    return this.getRepeatMode() !== "off";
  },

  toggleRepeat() {
    const current = this.getRepeatMode();
    const nextMode = current === "off" ? "context" : current === "context" ? "track" : "off";
    if (typeof SpotiKit !== "undefined") {
      SpotiKit.Player?.setRepeat?.(nextMode);
    }
    return nextMode;
  },

  getVolume() {
    const v = typeof SpotiKit !== "undefined" ? SpotiKit.Player?.volume : 1;
    return typeof v === "number" && !Number.isNaN(v) ? Math.max(0, Math.min(1, v)) : 1;
  },

  setVolume(vol) {
    const n = Number(vol);
    const clamped = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
    if (typeof SpotiKit !== "undefined") {
      SpotiKit.Player?.setMuted?.(false);
      SpotiKit.Player?.setVolume?.(clamped);
    }
  },

  getMute() {
    return Boolean(typeof SpotiKit !== "undefined" && SpotiKit.Player?.muted);
  },

  toggleMute() {
    this.setMute(!this.getMute());
  },

  setMute(mute) {
    if (typeof SpotiKit !== "undefined") {
      SpotiKit.Player?.setMuted?.(Boolean(mute));
    }
  },

  addPlayerListener(event, cb) {
    const mappedEvent = PLAYER_EVENT_MAP[event] || event;
    if (typeof SpotiKit === "undefined" || typeof SpotiKit.Player?.on !== "function") {
      return () => {};
    }
    const unsub = SpotiKit.Player.on(mappedEvent, cb);
    return typeof unsub === "function"
      ? unsub
      : () => {
          if (typeof SpotiKit !== "undefined") {
            SpotiKit.Player?.off?.(mappedEvent, cb);
          }
        };
  },

  openQueue() {
    this.navigateToPath("/queue");
  },

  uriToSpotifyPath(uri) {
    if (!uri || typeof uri !== "string") return null;
    const trimmed = uri.trim();
    if (trimmed.startsWith("/")) return trimmed;
    const match = trimmed.match(/^spotify:(track|album|artist|playlist|show|episode):([A-Za-z0-9]+)$/i);
    if (match) {
      return `/${match[1].toLowerCase()}/${match[2]}`;
    }
    return null;
  },

  navigateToPath(path) {
    if (!path || typeof path !== "string") return false;
    try {
      if (typeof SpotiKit !== "undefined" && typeof SpotiKit.Navigation?.go === "function") {
        SpotiKit.Navigation.go(path);
        return true;
      }
      if (typeof SpotiKit !== "undefined" && typeof SpotiKit.Platform?.History?.push === "function") {
        SpotiKit.Platform.History.push(path);
        return true;
      }
    } catch (_) {}

    if (typeof window !== "undefined" && window.location) {
      window.location.hash = path;
      return true;
    }
    return false;
  },

  navigateToUri(uri) {
    const path = this.uriToSpotifyPath(uri);
    if (!path) return false;
    return this.navigateToPath(path);
  },

  getTrackArtists(track) {
    if (!track || typeof track !== "object") return [];
    const meta = track.metadata || {};
    if (Array.isArray(track.artists) && track.artists.length > 0) {
      const list = track.artists
        .map((a, idx) => {
          const name = a?.name || a?.displayName || "";
          const metaUriKey = idx === 0 ? "artist_uri" : `artist_uri:${idx}`;
          const uri = a?.uri || meta[metaUriKey] || "";
          return name ? { name, uri } : null;
        })
        .filter(Boolean);
      if (list.length) return list;
    }

    const rawNames = String(meta.artist_name || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (rawNames.length) {
      return rawNames.map((name, idx) => {
        const metaUriKey = idx === 0 ? "artist_uri" : `artist_uri:${idx}`;
        return { name, uri: meta[metaUriKey] || "" };
      });
    }
    return [];
  },

  notify(message, options) {
    if (message === undefined || message === null || message === "") return;
    const plainText =
      typeof message === "string"
        ? message.replace(/<[^>]*>/g, "").trim()
        : String(message);
    if (!plainText) return;
    try {
      if (typeof SpotiKit !== "undefined" && typeof SpotiKit.notify === "function") {
        SpotiKit.notify(plainText, options);
      }
    } catch (_) {}
  },

  getLocale() {
    try {
      if (typeof SpotiKit !== "undefined") {
        if (typeof SpotiKit.Locale?.language === "string" && SpotiKit.Locale.language) {
          return SpotiKit.Locale.language;
        }
        const platformLocale = SpotiKit.Platform?.Translations?.getLocale?.();
        if (typeof platformLocale === "string" && platformLocale) {
          return platformLocale;
        }
      }
    } catch (_) {}

    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language;
    }
    return "en";
  },

  /**
   * Determines whether a DOM element is Spotify's native fullscreen button.
   */
  isSpotifyFullscreenButton(target) {
    if (!target || typeof target.closest !== "function") return false;
    if (typeof Element !== "undefined" && !(target instanceof Element)) return false;

    const selectors = [
      '[data-testid="fullscreen-mode-button"]',
      'button[data-testid="fullscreen-button"]',
      'button[data-testid="control-button-fullscreen"]',
      'button[data-testid="fullscreen-control"]',
      'button[data-testid="npv-fullscreen-button"]',
      "button.control-button--fullscreen",
      'button[aria-label*="ull screen" i]',
      'button[aria-label*="am ekran" i]',
      'button[aria-label*="fullscreen" i]',
      'button[aria-label*="tam ekran" i]',
    ];

    if (target.closest(selectors.join(", "))) {
      return true;
    }

    const button = target.closest("button");
    if (button) {
      const label = (button.getAttribute("aria-label") || "").toLowerCase();
      if (
        label.includes("fullscreen") ||
        label.includes("full screen") ||
        label.includes("tam ekran")
      ) {
        return true;
      }

      const extraControls = target.closest(
        '.now-playing-bar-extra-controls, .main-nowPlayingBar-extraControls, [data-testid="now-playing-bar"], .now-playing-bar'
      );
      if (
        extraControls &&
        (label.includes("screen") || label.includes("ekran") || label.includes("full"))
      ) {
        return true;
      }
    }

    return false;
  },
};
