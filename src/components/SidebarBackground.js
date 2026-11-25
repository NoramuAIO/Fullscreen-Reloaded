/**
 * Living Liquid Aurora background for Spotify's entire Right Sidebar (Now Playing View).
 * - Adapts dynamically to the playing track's album art and extracted color palette.
 * - Supports 5 modes: `liquid-aurora` (default), `song-mesh`, `frosted-art`, `custom-color`, and `off`.
 * - Dual-layer artwork crossfade + 3 organic drifting color orbs + subtle glass specular rim.
 * - Mounts cleanly inside Spotify's rounded right-sidebar panel and strips opaque Spotify wrappers/gradients
 *   (including hashed React modules, `--background-base`, and `::before`/`::after` overlays).
 * - Restores all modified inline styles, classes, DOM nodes, observers, and timers on disable or stop.
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
const STICKY_HDR_CLASS = "fr-sbg-sticky-hdr";
const MODE_ATTR = "data-fr-sbg-mode";

const OUTER_HOST_SELECTORS = [
  "#Desktop_PanelContainer_Id",
  ".Root__right-sidebar",
  '[data-testid="right-sidebar"]',
  ".right-sidebar",
];

const KNOWN_BG_OVERLAY_SELECTOR = [
  ".main-nowPlayingView-background",
  ".main-nowPlayingView-gradient",
  ".main-nowPlayingView-content",
  ".main-nowPlayingView-container",
  ".main-nowPlayingView-nowPlayingWidgets",
  ".main-nowPlayingView-contextItemInfo",
  ".main-nowPlayingView-coverArtContainer",
  ".npv-cover-art-section",
].join(",");

function hexToRgbTuple(hex) {
  const clean = String(hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return [27, 20, 51];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function parseColorAlpha(colorStr) {
  if (!colorStr || colorStr === "transparent") return 0;
  const rgbaMatch = colorStr.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/i);
  if (rgbaMatch) return parseFloat(rgbaMatch[1]) || 0;
  if (/^rgb\(/i.test(colorStr)) return 1;
  return 0.5;
}

export const SidebarBackground = {
  layerEl: null,
  artA: null,
  artB: null,
  _hostEl: null,
  _clearedEls: new Set(),
  _stickyEls: new Set(),
  _restoredStyles: new Map(),
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
    ds.setProperty("--fr-sbg-custom-soft", rgba(bright, 0.56));
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
    ds.setProperty("--fr-sbg-dom-soft", rgba(dom, 0.78));
    ds.setProperty("--fr-sbg-acc", rgb(acc));
    ds.setProperty("--fr-sbg-acc-soft", rgba(acc, 0.62));
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

    let outer = null;
    for (const sel of OUTER_HOST_SELECTORS) {
      const node = document.querySelector(sel);
      if (node) {
        outer = node;
        break;
      }
    }
    if (!outer) {
      const npv = document.querySelector(".npv-sections");
      return npv?.parentElement || null;
    }

    // Prefer the rounded panel element inside outer (.Root__right-sidebar / #Desktop_PanelContainer_Id)
    // so Liquid Aurora clips flush inside the panel's rounded border and never bleeds into the outer gutter.
    const canInspectStyle = typeof window !== "undefined" && typeof window.getComputedStyle === "function";
    const candidates = [
      outer.id === "Desktop_PanelContainer_Id" ? outer : outer.querySelector?.("#Desktop_PanelContainer_Id"),
      outer.querySelector?.('aside[aria-label*="Now playing" i]'),
      outer.querySelector?.("aside"),
      outer.querySelector?.(".right-sidebar"),
      outer,
    ].filter(Boolean);

    if (canInspectStyle) {
      const outerStyle = window.getComputedStyle(outer);
      const outerRadius = parseFloat(outerStyle.borderTopLeftRadius || "0") || 0;
      if (outerRadius > 0) {
        return outer;
      }
      const outerRect = outer.getBoundingClientRect?.() || { width: 0, height: 0 };
      for (const cand of candidates) {
        if (cand === outer) continue;
        const rect = cand.getBoundingClientRect?.() || { width: 0, height: 0 };
        const cs = window.getComputedStyle(cand);
        const radius = parseFloat(cs.borderTopLeftRadius || "0") || 0;
        const fillsHeight = outerRect.height <= 0 || rect.height >= outerRect.height * 0.8;
        if (radius > 0 && fillsHeight && rect.width > 80) {
          return cand;
        }
      }
    }

    // Fallback preference: #Desktop_PanelContainer_Id or .right-sidebar inside outer if non-empty
    const innerPanel =
      (outer.id !== "Desktop_PanelContainer_Id" && outer.querySelector?.("#Desktop_PanelContainer_Id")) ||
      outer.querySelector?.("aside.NowPlayingView") ||
      outer.querySelector?.('aside[aria-label*="Now playing" i]');
    return innerPanel || outer;
  },

  _saveAndClearElement(node) {
    if (!node || !node.classList || node.id === BG_ID || node.id === "fr-sidebar-lyrics-card") return;
    if (!node.classList.contains(CLEAR_BG_CLASS)) {
      node.classList.add(CLEAR_BG_CLASS);
      this._clearedEls.add(node);
    }
    if (node.style && !this._restoredStyles.has(node)) {
      const getVal = (p) =>
        typeof node.style.getPropertyValue === "function" ? node.style.getPropertyValue(p) || "" : "";
      const getPrio = (p) =>
        typeof node.style.getPropertyPriority === "function"
          ? node.style.getPropertyPriority(p) || ""
          : "";
      this._restoredStyles.set(node, {
        bg: getVal("background"),
        bgPrio: getPrio("background"),
        bgColor: getVal("background-color"),
        bgColorPrio: getPrio("background-color"),
        bgImg: getVal("background-image"),
        bgImgPrio: getPrio("background-image"),
      });
      if (typeof node.style.setProperty === "function") {
        node.style.setProperty("background", "transparent", "important");
        node.style.setProperty("background-color", "transparent", "important");
        node.style.setProperty("background-image", "none", "important");
      }
    }
  },

  _markTransparentWrappers(host) {
    if (!host) return;

    // 1. Walk ancestor chain up from known Now Playing containers to host (inclusive of host inner children)
    const anchorSelectors = [
      ".npv-sections",
      '[data-testid="NPV_Panel_OpenDiv"]',
      ".main-nowPlayingView-content",
      ".main-nowPlayingView-container",
      ".main-buddyFeed-container",
      ".os-viewport",
      ".os-content",
      "aside",
    ];
    for (const sel of anchorSelectors) {
      const found = host.querySelector?.(sel);
      if (!found) continue;
      let cur = found;
      while (cur && cur !== host) {
        this._saveAndClearElement(cur);
        cur = cur.parentElement;
      }
    }

    // 2. Also clear direct children of host (e.g. wrapper around aside or sibling overlay containers)
    if (host.children) {
      for (const child of host.children) {
        if (child && child !== this.layerEl) {
          this._saveAndClearElement(child);
        }
      }
    }

    // 3. Explicit known Spotify gradient/overlay classes inside host
    if (typeof host.querySelectorAll === "function") {
      const overlays = host.querySelectorAll(KNOWN_BG_OVERLAY_SELECTOR);
      for (const ov of overlays) {
        this._saveAndClearElement(ov);
      }
    }

    // 4. Runtime computed-style sweep: catch hashed CSS classes, sibling gradient backdrops, and sticky headers
    if (
      typeof window !== "undefined" &&
      typeof window.getComputedStyle === "function" &&
      typeof host.querySelectorAll === "function"
    ) {
      const hostRect = host.getBoundingClientRect?.() || { width: 0, height: 0, top: 0 };
      if (hostRect.width <= 0 || hostRect.height <= 0) return;

      const blocks = host.querySelectorAll("div, aside, section, header, nav");
      let inspected = 0;
      for (const node of blocks) {
        if (inspected++ > 120) break;
        if (!node || node === this.layerEl || node.closest?.(`#${BG_ID}`)) continue;
        if (node.closest?.("#fr-sidebar-lyrics-card") || node.id === "fr-sidebar-lyrics-card") continue;
        if (
          node.closest?.(".main-nowPlayingView-section") ||
          node.closest?.(".npv-section") ||
          node.classList?.contains("main-nowPlayingView-section") ||
          node.classList?.contains("npv-section")
        ) {
          continue;
        }
        if (node.closest?.('[role="button"], button, a')) continue;

        const rect = node.getBoundingClientRect?.();
        if (!rect || rect.width < hostRect.width * 0.72 || rect.height < 32) continue;

        const cs = window.getComputedStyle(node);
        const bgImg = cs.backgroundImage || "";
        // Never strip actual image textures (e.g. album cover or canvas background)
        if (bgImg.includes("url(")) continue;

        const alpha = parseColorAlpha(cs.backgroundColor);
        const hasGradient = bgImg.includes("gradient(");

        // Sticky or top header bar inside the sidebar (e.g. playlist name + close/expand buttons)
        const isTopBar =
          (cs.position === "sticky" || rect.top <= hostRect.top + 10) &&
          rect.height <= 88 &&
          rect.height >= 36 &&
          rect.width >= hostRect.width * 0.85;

        if (isTopBar && (alpha > 0.25 || hasGradient) && node.parentElement) {
          if (!node.classList?.contains(STICKY_HDR_CLASS)) {
            node.classList?.add(STICKY_HDR_CLASS);
            this._stickyEls.add(node);
          }
          continue;
        }

        const isFullOrTallPanel = rect.height >= hostRect.height * 0.45 && rect.width >= hostRect.width * 0.85;
        const isAbsoluteBackdrop = cs.position === "absolute" && rect.height >= 48 && rect.width >= hostRect.width * 0.7;

        if ((isFullOrTallPanel || isAbsoluteBackdrop) && (alpha > 0.15 || hasGradient)) {
          this._saveAndClearElement(node);
        }
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
    for (const node of this._stickyEls) {
      node?.classList?.remove(STICKY_HDR_CLASS);
    }
    this._stickyEls.clear();
    for (const [node, prev] of this._restoredStyles.entries()) {
      if (!node?.style) continue;
      const restoreProp = (prop, val, prio) => {
        if (val) node.style.setProperty(prop, val, prio || "");
        else node.style.removeProperty(prop);
      };
      restoreProp("background", prev.bg, prev.bgPrio);
      restoreProp("background-color", prev.bgColor, prev.bgColorPrio);
      restoreProp("background-image", prev.bgImg, prev.bgImgPrio);
    }
    this._restoredStyles.clear();
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

    let inserted = this.layerEl.parentElement === host;
    if (!inserted) {
      try {
        host.insertBefore(this.layerEl, host.firstChild || null);
        inserted = true;
      } catch (_) {
        inserted = false;
      }
    }

    this._markTransparentWrappers(host);
    return inserted;
  },

  _startObserving() {
    if (typeof MutationObserver !== "undefined" && !this._observer && document.body) {
      this._observer = new MutationObserver(() => {
        if (this._attachTimer) return;
        this._attachTimer = setTimeout(() => {
          this._attachTimer = null;
          this._ensureAttached();
        }, 250);
      });
      this._observer.observe(document.body, { childList: true, subtree: true });
    }
    if (!this._retryInterval) {
      this._retryInterval = setInterval(() => {
        if (!this._mounted || SpotiKitBridge.isStopped()) return;
        this._ensureAttached();
      }, 1500);
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
