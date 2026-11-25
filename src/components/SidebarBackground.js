/**
 * Living Liquid Aurora background for Spotify's entire Right Sidebar (Now Playing View).
 * - Adapts dynamically to the playing track's album art and extracted color palette.
 * - Supports 5 modes: `liquid-aurora` (default), `song-mesh`, `frosted-art`, `custom-color`, and `off`.
 * - Dual-layer artwork crossfade + 3 organic drifting color orbs + subtle glass specular rim.
 * - Cleans up all injected DOM nodes, observers, timers, and CSS variables on disable or stop.
 */
import { el } from "../utils/dom.js";
import { Settings } from "../utils/settings.js";
import { resolveImageUrl, rgb, rgba } from "../utils/formatters.js";
import { ColorExtractor } from "../services/ColorExtractor.js";
import { SpotiKitBridge } from "../services/SpotiKitBridge.js";

const BG_ID = "fr-right-sidebar-bg";
const ACTIVE_CLASS = "fr-sidebar-panel-bg-active";
const HOST_CLASS = "fr-sbg-host";
const CLEAR_BG_CLASS = "fr-sbg-clear-bg";
const MODE_ATTR = "data-fr-sbg-mode";
const HOST_SELECTORS = [
  ".right-sidebar",
  '[data-testid="right-sidebar"]',
  ".Root__right-sidebar",
];

function hexToRgbTuple(hex) {
  const clean = String(hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return [27, 20, 51];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export const SidebarBackground = {
  layerEl: null,
  artA: null,
  artB: null,
  _hostEl: null,
  _clearedEls: new Set(),
  _activeIsA: true,
  _currentImgUrl: "",
  _lastColors: null,
  _mounted: false,
  _observer: null,
  _attachTimer: null,
  _retryInterval: null,
  _extractGen: 0,

  init() {
    this.sync();
  },

  getMode() {
    return Settings.get("sidebarPanelBg") || "liquid-aurora";
  },

  sync() {
    const mode = this.getMode();
    if (mode === "off") {
      this._unmountLayer();
      this._clearRootAttrs();
      return;
    }

    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.classList.add(ACTIVE_CLASS);
      document.documentElement.setAttribute(MODE_ATTR, mode);
    }

    this._mountLayer();
    this._applyCustomColorVar();

    if (this._lastColors) {
      this.applyColors(this._lastColors);
    }

    const currentTrack = SpotiKitBridge.getCurrentTrack();
    if (currentTrack) {
      this.onTrackChange(currentTrack);
    }
  },

  _clearRootAttrs() {
    if (typeof document === "undefined" || !document.documentElement) return;
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.documentElement.removeAttribute(MODE_ATTR);
    const ds = document.documentElement.style;
    ds.removeProperty("--fr-sbg-dom");
    ds.removeProperty("--fr-sbg-dom-soft");
    ds.removeProperty("--fr-sbg-acc");
    ds.removeProperty("--fr-sbg-acc-soft");
    ds.removeProperty("--fr-sbg-dark");
    ds.removeProperty("--fr-sbg-custom");
    ds.removeProperty("--fr-sbg-custom-soft");
    ds.removeProperty("--fr-sbg-custom-deep");
  },

  _applyCustomColorVar() {
    if (typeof document === "undefined" || !document.documentElement?.style) return;
    const hex = Settings.get("sidebarPanelBgColor") || "#1b1433";
    const [r, g, b] = hexToRgbTuple(hex);
    const bright = [
      Math.min(255, Math.round(r * 1.45 + 48)),
      Math.min(255, Math.round(g * 1.45 + 48)),
      Math.min(255, Math.round(b * 1.45 + 48)),
    ];
    const deep = [
      Math.round(r * 0.35),
      Math.round(g * 0.35),
      Math.round(b * 0.35),
    ];
    const ds = document.documentElement.style;
    ds.setProperty("--fr-sbg-custom", rgb([r, g, b]));
    ds.setProperty("--fr-sbg-custom-soft", rgba(bright, 0.52));
    ds.setProperty("--fr-sbg-custom-deep", rgb(deep));
  },

  applyColors(colors) {
    if (!colors || typeof document === "undefined" || !document.documentElement?.style) return;
    this._lastColors = colors;
    if (this.getMode() === "off") return;

    const dom = colors.dominant || [24, 24, 38];
    const acc = colors.accent || [160, 175, 255];
    const dark = colors.dark || [10, 10, 18];

    const ds = document.documentElement.style;
    ds.setProperty("--fr-sbg-dom", rgb(dom));
    ds.setProperty("--fr-sbg-dom-soft", rgba(dom, 0.72));
    ds.setProperty("--fr-sbg-acc", rgb(acc));
    ds.setProperty("--fr-sbg-acc-soft", rgba(acc, 0.58));
    ds.setProperty("--fr-sbg-dark", rgb(dark));
  },

  _mountLayer() {
    if (this._mounted && this.layerEl) {
      this._ensureAttached();
      return;
    }
    this._mounted = true;

    document.getElementById(BG_ID)?.remove();

    const layer = el("div", "fr-sbg-layer");
    layer.id = BG_ID;
    layer.setAttribute("aria-hidden", "true");

    const artA = el("div", "fr-sbg-art fr-sbg-art-a fr-sbg-art-active");
    const artB = el("div", "fr-sbg-art fr-sbg-art-b");

    const mesh = el("div", "fr-sbg-mesh");
    const orb1 = el("div", "fr-sbg-orb fr-sbg-orb-1");
    const orb2 = el("div", "fr-sbg-orb fr-sbg-orb-2");
    const orb3 = el("div", "fr-sbg-orb fr-sbg-orb-3");
    mesh.append(orb1, orb2, orb3);

    const sheen = el("div", "fr-sbg-sheen");
    const grain = el("div", "fr-sbg-grain");

    layer.append(artA, artB, mesh, sheen, grain);

    this.layerEl = layer;
    this.artA = artA;
    this.artB = artB;
    this._activeIsA = true;

    if (this._currentImgUrl) {
      artA.style.backgroundImage = `url("${this._currentImgUrl}")`;
    }

    this._ensureAttached();
    this._startObserving();
  },

  _findHost() {
    if (typeof document === "undefined") return null;
    for (const sel of HOST_SELECTORS) {
      const node = document.querySelector(sel);
      if (node) return node;
    }
    const npv = document.querySelector(".npv-sections");
    return npv?.parentElement || null;
  },

  _markTransparentWrappers(host) {
    if (!host) return;
    const targets = [
      host.querySelector?.(".npv-sections"),
      host.querySelector?.('[data-testid="NPV_Panel_OpenDiv"]'),
      host.querySelector?.(".main-buddyFeed-container"),
      host.querySelector?.(".os-viewport"),
    ].filter(Boolean);

    for (const node of targets) {
      let cur = node;
      while (cur && cur !== host) {
        if (cur.classList && !cur.classList.contains(CLEAR_BG_CLASS)) {
          cur.classList.add(CLEAR_BG_CLASS);
          this._clearedEls.add(cur);
        }
        cur = cur.parentElement;
      }
    }
  },

  _cleanupHostClasses() {
    if (this._hostEl?.classList) {
      this._hostEl.classList.remove(HOST_CLASS);
    }
    this._hostEl = null;
    for (const node of this._clearedEls) {
      node?.classList?.remove(CLEAR_BG_CLASS);
    }
    this._clearedEls.clear();
  },

  _ensureAttached() {
    if (!this.layerEl || !this._mounted) return false;
    const host = this._findHost();
    if (!host) return false;

    if (this._hostEl && this._hostEl !== host) {
      this._cleanupHostClasses();
    }
    this._hostEl = host;
    host.classList?.add(HOST_CLASS);
    this._markTransparentWrappers(host);

    if (this.layerEl.parentElement === host) return true;
    try {
      host.insertBefore(this.layerEl, host.firstChild || null);
      return true;
    } catch (_) {
      return false;
    }
  },

  _startObserving() {
    if (typeof MutationObserver !== "undefined" && !this._observer && document.body) {
      this._observer = new MutationObserver(() => {
        if (this._attachTimer) return;
        this._attachTimer = setTimeout(() => {
          this._attachTimer = null;
          this._ensureAttached();
        }, 350);
      });
      this._observer.observe(document.body, { childList: true, subtree: true });
    }
    if (!this._retryInterval) {
      this._retryInterval = setInterval(() => {
        if (!this._mounted || SpotiKitBridge.isStopped()) return;
        this._ensureAttached();
      }, 1800);
    }
  },

  async onTrackChange(track) {
    if (!track || this.getMode() === "off") return;
    const meta = track.metadata || {};
    const imgUrl = resolveImageUrl(
      meta.image_xlarge_url ||
        meta.image_large_url ||
        meta.image_url ||
        track.album?.images?.[0]?.url ||
        track.images?.[0]?.url
    );
    if (!imgUrl) return;

    if (imgUrl !== this._currentImgUrl) {
      this._currentImgUrl = imgUrl;
      this._crossfadeArtwork(imgUrl);
    }

    const gen = ++this._extractGen;
    const colors = await ColorExtractor.extract(imgUrl);
    if (gen !== this._extractGen || !this._mounted || SpotiKitBridge.isStopped()) return;
    if (colors) {
      this.applyColors(colors);
    }
  },

  _crossfadeArtwork(imgUrl) {
    if (!this.artA || !this.artB) return;
    const incoming = this._activeIsA ? this.artB : this.artA;
    const outgoing = this._activeIsA ? this.artA : this.artB;
    incoming.style.backgroundImage = `url("${imgUrl}")`;
    incoming.classList.add("fr-sbg-art-active");
    outgoing.classList.remove("fr-sbg-art-active");
    this._activeIsA = !this._activeIsA;
  },

  _unmountLayer() {
    this._mounted = false;
    this._extractGen++;
    if (this._attachTimer) {
      clearTimeout(this._attachTimer);
      this._attachTimer = null;
    }
    if (this._retryInterval) {
      clearInterval(this._retryInterval);
      this._retryInterval = null;
    }
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    this.layerEl?.remove();
    this.layerEl = null;
    this.artA = null;
    this.artB = null;
    this._cleanupHostClasses();
  },

  destroy() {
    this._unmountLayer();
    this._clearRootAttrs();
    this._currentImgUrl = "";
    this._lastColors = null;
  },
};
