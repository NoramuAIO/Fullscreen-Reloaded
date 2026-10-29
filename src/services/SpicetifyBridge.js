/**
 * Bridge layer for interacting with Spicetify and Spotify Desktop 1.3.6.
 * Provides safe wrappers, token resolution, queue fetching, and event management.
 */

export const SpicetifyBridge = {
  REQUIRED_APIS: ["Player", "Platform"],

  /**
   * Safeguards Spicetify.showNotification in Spotify 1.3.6 against
   * "Error: enqueueSnackbar called with invalid argument" when webpack
   * modules (React / Snackbar.simpleLayout) are not yet initialized or
   * when third-party extensions (e.g. Marketplace / Spicy Lyrics) pass invalid args.
   */
  patchShowNotification() {
    if (typeof Spicetify === "undefined") return;
    if (typeof Spicetify.showNotification === "function" && !Spicetify.showNotification._frPatched) {
      const origShow = Spicetify.showNotification.bind(Spicetify);
      const patched = function (message, isError = false, msTimeout = 3000) {
        if (message === undefined || message === null || message === "") return;
        try {
          return origShow(message, isError, msTimeout);
        } catch (err) {
          try {
            const plainText =
              typeof message === "string"
                ? message.replace(/<[^>]*>/g, "").trim()
                : String(message);
            if (plainText && typeof Spicetify.Snackbar?.enqueueSnackbar === "function") {
              return Spicetify.Snackbar.enqueueSnackbar(plainText, {
                variant: isError ? "error" : "default",
                autoHideDuration: msTimeout,
              });
            }
          } catch (_) {
            // Suppress secondary enqueueSnackbar error in Spotify 1.3.6
          }
        }
      };
      patched._frPatched = true;
      Spicetify.showNotification = patched;
    }
  },

  /**
   * Waits for Spicetify and core APIs to become ready.
   * Unlike older versions, this does NOT block on deprecated APIs like CosmosAsync or Keyboard.
   */
  waitForReady(maxWaitMs = 15000) {
    const start = Date.now();
    this.patchShowNotification();
    return new Promise((resolve, reject) => {
      const check = () => {
        this.patchShowNotification();
        if (
          typeof Spicetify !== "undefined" &&
          this.REQUIRED_APIS.every((k) => typeof Spicetify[k] !== "undefined")
        ) {
          resolve(Spicetify);
          return;
        }
        if (Date.now() - start > maxWaitMs) {
          console.warn("[Fullscreen Reloaded] Timed out waiting for Spicetify APIs. Attempting launch anyway...");
          resolve(typeof Spicetify !== "undefined" ? Spicetify : null);
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });
  },

  /**
   * Retrieves Spotify session access token in Spotify 1.3.6.
   * Checks multiple fallback surfaces (Platform.Session, AuthorizationAPI).
   */
  async getAccessToken() {
    try {
      if (typeof Spicetify === "undefined") return null;

      if (typeof Spicetify.Platform?.Session?.accessToken === "string" && Spicetify.Platform.Session.accessToken) {
        return Spicetify.Platform.Session.accessToken;
      }

      if (Spicetify.Platform?.Session?.getAccessToken) {
        const res = await Spicetify.Platform.Session.getAccessToken();
        const token = typeof res === "string" ? res : res?.accessToken;
        if (token) return token;
      }

      if (Spicetify.Platform?.AuthorizationAPI?.getAccessToken) {
        const res = await Spicetify.Platform.AuthorizationAPI.getAccessToken();
        const token = typeof res === "string" ? res : res?.accessToken;
        if (token) return token;
      }
    } catch (e) {
      console.warn("[Fullscreen Reloaded] Could not retrieve session access token:", e);
    }
    return null;
  },

  /**
   * Fetches the upcoming queue tracks. Supports Spotify 1.3.6 PlayerAPI & legacy Spicetify.Queue.
   */
  async getNextTrack() {
    try {
      if (typeof Spicetify === "undefined") return null;

      // 1. Spicetify.Queue synchronous object
      if (Spicetify.Queue?.nextTracks?.length) {
        return Spicetify.Queue.nextTracks[0];
      }

      // 2. Spicetify.Platform.PlayerAPI synchronous internal queue
      if (Spicetify.Platform?.PlayerAPI?._queue?.nextTracks?.length) {
        return Spicetify.Platform.PlayerAPI._queue.nextTracks[0];
      }

      // 3. Spicetify.Platform.PlayerAPI asynchronous getter
      if (Spicetify.Platform?.PlayerAPI?.getQueue) {
        const q = await Spicetify.Platform.PlayerAPI.getQueue();
        if (q?.nextTracks?.length) return q.nextTracks[0];
      }
    } catch (e) {
      // silently fallback
    }
    return null;
  },

  /**
   * Gets current playback data / track metadata.
   */
  getCurrentTrack() {
    if (typeof Spicetify === "undefined" || !Spicetify.Player) return null;
    const data = Spicetify.Player.data;
    if (!data) return null;
    return data.track || data.item || null;
  },

  getDuration() {
    return (typeof Spicetify !== "undefined" && Spicetify.Player?.getDuration()) || 0;
  },

  getProgress() {
    return (typeof Spicetify !== "undefined" && Spicetify.Player?.getProgress()) || 0;
  },

  isPlaying() {
    return !!(typeof Spicetify !== "undefined" && Spicetify.Player?.isPlaying());
  },

  seek(ms) {
    if (typeof Spicetify !== "undefined" && Spicetify.Player?.seek) {
      Spicetify.Player.seek(Math.max(0, ms));
    }
  },

  togglePlay() {
    Spicetify?.Player?.togglePlay?.();
  },

  next() {
    Spicetify?.Player?.next?.();
  },

  back() {
    Spicetify?.Player?.back?.();
  },

  toggleShuffle() {
    Spicetify?.Player?.toggleShuffle?.();
  },

  getShuffle() {
    return !!Spicetify?.Player?.getShuffle?.();
  },

  toggleRepeat() {
    Spicetify?.Player?.toggleRepeat?.();
  },

  getRepeat() {
    return !!Spicetify?.Player?.getRepeat?.();
  },

  getVolume() {
    const v = Spicetify?.Player?.getVolume?.();
    return typeof v === "number" && !isNaN(v) ? Math.max(0, Math.min(1, v)) : 1;
  },

  setVolume(vol) {
    const clamped = Math.max(0, Math.min(1, vol));
    Spicetify?.Player?.setMute?.(false);
    Spicetify?.Player?.setVolume?.(clamped);
  },

  getMute() {
    return !!Spicetify?.Player?.getMute?.();
  },

  toggleMute() {
    Spicetify?.Player?.toggleMute?.();
  },

  setMute(mute) {
    Spicetify?.Player?.setMute?.(!!mute);
  },

  addPlayerListener(event, callback) {
    Spicetify?.Player?.addEventListener?.(event, callback);
    return () => Spicetify?.Player?.removeEventListener?.(event, callback);
  },

  /**
   * Safely opens Spotify Queue view.
   */
  openQueue() {
    if (Spicetify?.Platform?.History?.push) {
      Spicetify.Platform.History.push("/queue");
    } else if (Spicetify?.Player?.toggleQueue) {
      Spicetify.Player.toggleQueue();
    } else {
      window.location.hash = "/queue";
    }
  },

  /**
   * Determines whether a DOM element is Spotify's native fullscreen button.
   * Matches Spotify 1.3.6 selectors, aria-labels, and testids.
   */
  isSpotifyFullscreenButton(target) {
    if (!target || !(target instanceof Element)) return false;

    const selectors = [
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

    const btn = target.closest(selectors.join(", "));
    if (btn) return true;

    // Check if element is inside nowPlayingBar extra controls and has fullscreen SVG icon
    const extraControls = target.closest(
      '.main-nowPlayingBar-extraControls, [data-testid="now-playing-bar"], .now-playing-bar'
    );
    if (extraControls) {
      const button = target.closest("button");
      if (button) {
        const label = (button.getAttribute("aria-label") || "").toLowerCase();
        if (label.includes("screen") || label.includes("ekran") || label.includes("full")) {
          return true;
        }
      }
    }

    return false;
  },
};
