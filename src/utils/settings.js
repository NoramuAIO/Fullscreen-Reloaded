/**
 * Settings persistence and state management.
 */

export const Settings = {
  KEY: "fullscreen-reloaded:settings",
  SETTINGS_KEY: "settings",
  defaults: {
    backgroundMode: "dynamic-gradient", // solid | gradient | dynamic-gradient | blurred-artwork | artwork | darkened-artwork | custom-color
    customColor: "#101014",
    showLyrics: true,
    idleLyrics: true,
    albumArtSize: "large", // small | medium | large
    albumArtRadius: 18,
    albumArtShadow: true,
    albumArtGlow: true,
    clockPosition: "top", // top | bottom | none
    metaPosition: "left", // left | center | right
    unsyncedScrollMode: "track", // track | slow | normal | fast | off
    waterfallMode: "normal", // normal | intense | off
    letterByLetter: true,
    interludeDots: true,
    bgVocalsDuet: true,
    newPlayerMode: false,
    showLegacyPlayer: false,
    sidebarLyrics: true,
    sidebarLyricsBg: true,
    sidebarLyricsAnim: true,
    pipLyrics: true,
    dynamicThemeColors: true,
    moodMode: "auto", // auto | energetic | melancholic | latenight | dreamy | off
    beatReactive: "normal", // normal | intense | off
    lyricsProvider: "auto", // auto | spotify | lrclib | genius | applemusic
    showAlbumArt: true,
    showTitle: true,
    showArtist: true,
    showAlbum: true,
    transitionMs: 900,
    language: "auto", // auto | en | tr
    appleMusicUserToken: null,
  },
  data: {},
  _listeners: new Set(),

  _getScope() {
    return typeof SpotiKit !== "undefined" ? SpotiKit.Storage?.scope?.("fullscreen-reloaded") || null : null;
  },

  load() {
    let stored = null;
    let migratedFromLocalStorage = false;
    const scope = this._getScope();
    try {
      const scopeValue = scope && typeof scope.get === "function" ? scope.get(this.SETTINGS_KEY, null) : null;
      if (scopeValue !== null && scopeValue !== undefined) {
        const parsed = typeof scopeValue === "string" ? JSON.parse(scopeValue) : scopeValue;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          stored = parsed;
        }
      } else if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(this.KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            stored = parsed;
            if (scope) migratedFromLocalStorage = true;
          }
        }
      }
    } catch (e) {
      /* ignore corrupt settings */
    }
    this.data = Object.assign({}, this.defaults, stored || {});
    let needsSave = migratedFromLocalStorage;
    if (!this.data._migratedIdleLyricsV2) {
      this.data.idleLyrics = true;
      this.data.showLyrics = true;
      this.data._migratedIdleLyricsV2 = true;
      needsSave = true;
    }
    if (needsSave) {
      this.save();
    }
  },

  save() {
    try {
      const scope = this._getScope();
      if (scope && typeof scope.set === "function") {
        scope.set(this.SETTINGS_KEY, { ...this.data });
        return;
      }
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(this.KEY, JSON.stringify(this.data));
      }
    } catch (e) {
      /* storage unavailable */
    }
  },

  set(key, value) {
    this.data[key] = value;
    this.save();
    this._notify(key, value);
  },

  get(key) {
    return this.data[key] !== undefined ? this.data[key] : this.defaults[key];
  },

  onChange(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  },

  _notify(key, value) {
    for (const listener of this._listeners) {
      try {
        listener(key, value);
      } catch (e) {
        console.error("[Fullscreen Reloaded] Settings listener error:", e);
      }
    }
  },
};
