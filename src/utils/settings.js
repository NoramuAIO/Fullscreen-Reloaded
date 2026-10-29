/**
 * Settings persistence and state management.
 */

export const Settings = {
  KEY: "fullscreen-reloaded:settings",
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
    interludeDots: true,
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

  load() {
    let stored = null;
    try {
      const raw =
        (typeof Spicetify !== "undefined" && Spicetify.LocalStorage && Spicetify.LocalStorage.get(this.KEY)) ||
        window.localStorage.getItem(this.KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (e) {
      /* ignore corrupt settings */
    }
    this.data = Object.assign({}, this.defaults, stored || {});
    if (!this.data._migratedIdleLyricsV2) {
      this.data.idleLyrics = true;
      this.data.showLyrics = true;
      this.data._migratedIdleLyricsV2 = true;
      this.save();
    }
  },

  save() {
    const raw = JSON.stringify(this.data);
    try {
      if (typeof Spicetify !== "undefined" && Spicetify.LocalStorage) {
        Spicetify.LocalStorage.set(this.KEY, raw);
      } else {
        window.localStorage.setItem(this.KEY, raw);
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
