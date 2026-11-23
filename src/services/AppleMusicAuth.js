/**
 * Apple Music authorization & developer token manager.
 */
import { Settings } from "../utils/settings.js";
import { SpotiKitBridge } from "./SpotiKitBridge.js";
import { t } from "../utils/i18n.js";

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
      const signal = SpotiKitBridge.createTimeoutSignal(1500);
      const html = await fetch(proxyUrl, { signal }).then((r) => (r.ok ? r.text() : ""));
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

  _getScope() {
    return typeof SpotiKit !== "undefined" ? SpotiKit.Storage?.scope?.("fullscreen-reloaded") || null : null;
  },

  _readCache() {
    try {
      const scope = this._getScope();
      let parsed = null;
      if (scope && typeof scope.get === "function") {
        const raw = scope.get("apple-dev-token", null);
        if (!raw) return null;
        parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      } else if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem("fullscreen-reloaded:apple-dev-token");
        if (!raw) return null;
        parsed = JSON.parse(raw);
      }
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof parsed.token !== "string" ||
        !parsed.token ||
        !Number.isFinite(parsed.expires) ||
        parsed.expires < Date.now()
      ) {
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  },

  _writeCache(token, expires) {
    try {
      const payload = { token, expires };
      const scope = this._getScope();
      if (scope && typeof scope.set === "function") {
        scope.set("apple-dev-token", payload);
        return;
      }
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("fullscreen-reloaded:apple-dev-token", JSON.stringify(payload));
      }
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
      SpotiKitBridge.notify(t("appleConnectError"), { type: "error" });
      return false;
    }
    try {
      const MusicKit = await this.loadMusicKit();
      await MusicKit.configure({
        developerToken: devToken,
        app: { name: "Fullscreen Reloaded", build: "1.4.0" },
      });
      const instance = MusicKit.getInstance();
      const userToken = await instance.authorize();
      Settings.set("appleMusicUserToken", userToken);
      SpotiKitBridge.notify(t("appleConnected"), { type: "default" });
      return true;
    } catch (e) {
      SpotiKitBridge.notify(t("appleConnectFailed"), { type: "error" });
      return false;
    }
  },
};
