/**
 * Apple Music authorization & developer token manager.
 */
import { Settings } from "../utils/settings.js";

export const AppleMusicAuth = {
  storefront: "us",
  _devToken: null,
  _devTokenExpires: 0,
  _musicKitLoading: null,

  async getDeveloperToken() {
    if (this._devToken && Date.now() < this._devTokenExpires) {
      return this._devToken;
    }
    const cached = this._readCache();
    if (cached) {
      this._devToken = cached.token;
      this._devTokenExpires = cached.expires;
      return this._devToken;
    }
    try {
      const proxyUrl =
        "https://corsproxy.io/?url=" + encodeURIComponent("https://music.apple.com/us/browse");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const html = await fetch(proxyUrl, { signal: controller.signal }).then((r) => (r.ok ? r.text() : ""));
      clearTimeout(timer);
      const token = this._extractFromMetaTag(html) || this._extractFromRawJwt(html);
      if (!token) return null;

      this._devToken = token;
      this._devTokenExpires = Date.now() + 12 * 60 * 60 * 1000; // re-check every 12h
      this._writeCache(token, this._devTokenExpires);
      return token;
    } catch (e) {
      return null;
    }
  },

  _extractFromMetaTag(html) {
    const match = html.match(/<meta name="desktop-music-app\/config\/environment" content="([^"]+)"/);
    if (!match) return null;
    try {
      const config = JSON.parse(decodeURIComponent(match[1]));
      return (config && config.MEDIA_API && config.MEDIA_API.token) || null;
    } catch (e) {
      return null;
    }
  },

  _extractFromRawJwt(html) {
    const match = html.match(
      /eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IldlYlBsYXlLaWQifQ\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
    );
    return match ? match[0] : null;
  },

  _readCache() {
    try {
      const raw = window.localStorage.getItem("fullscreen-reloaded:apple-dev-token");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.expires < Date.now()) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  },

  _writeCache(token, expires) {
    try {
      window.localStorage.setItem(
        "fullscreen-reloaded:apple-dev-token",
        JSON.stringify({ token, expires })
      );
    } catch (e) {
      /* ignore */
    }
  },

  getUserToken() {
    return Settings.get("appleMusicUserToken") || null;
  },

  isConnected() {
    return !!this.getUserToken();
  },

  disconnect() {
    Settings.set("appleMusicUserToken", null);
  },

  async loadMusicKit() {
    if (window.MusicKit) return window.MusicKit;
    if (this._musicKitLoading) return this._musicKitLoading;
    this._musicKitLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
      script.async = true;
      script.onload = () => resolve(window.MusicKit);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return this._musicKitLoading;
  },

  async connect() {
    const devToken = await this.getDeveloperToken();
    if (!devToken) {
      if (typeof Spicetify !== "undefined" && Spicetify.showNotification) {
        Spicetify.showNotification("Apple Music'e ulaşılamadı, tekrar deneyin.");
      }
      return false;
    }
    try {
      const MusicKit = await this.loadMusicKit();
      await MusicKit.configure({
        developerToken: devToken,
        app: { name: "Fullscreen Reloaded", build: "1.3.6" },
      });
      const instance = MusicKit.getInstance();
      const userToken = await instance.authorize();
      Settings.set("appleMusicUserToken", userToken);
      if (typeof Spicetify !== "undefined" && Spicetify.showNotification) {
        Spicetify.showNotification("Apple Music bağlandı.");
      }
      return true;
    } catch (e) {
      if (typeof Spicetify !== "undefined" && Spicetify.showNotification) {
        Spicetify.showNotification("Apple Music bağlantısı başarısız oldu.");
      }
      return false;
    }
  },
};
