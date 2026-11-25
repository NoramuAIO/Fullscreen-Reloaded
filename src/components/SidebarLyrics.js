/**
 * Spotify Right Sidebar (Now Playing View) Live Lyrics Card.
 * - Hides Spotify's native `[data-testid="lyrics-npv-section"]` while active so there is no duplicate card.
 * - Features Apple Music Liquid header, larger readable bold typography, expand/collapse height,
 *   fullscreen launch shortcut, click-to-seek, toggleable blurred album backdrop (`sidebarLyricsBg`),
 *   and toggleable live word/line karaoke sweep animation (`sidebarLyricsAnim`).
 */
import { el } from "../utils/dom.js";
import { Icons } from "../utils/icons.js";
import { t } from "../utils/i18n.js";
import { Settings } from "../utils/settings.js";
import { resolveImageUrl } from "../utils/formatters.js";
import { normalizeWordTimings, clamp01 } from "../utils/letterTiming.js";
import { LyricsService } from "../services/LyricsService.js";
import { SpotiKitBridge } from "../services/SpotiKitBridge.js";

const CARD_ID = "fr-sidebar-lyrics-card";
const HIDE_NATIVE_CLASS = "fr-hide-native-npv-lyrics";
const RIGHT_SIDEBAR_SEL = ".right-sidebar";
const NPV_PANEL_SEL = ".npv-sections";
const NPV_LYRICS_SEL = '[data-testid="lyrics-npv-section"]';
const NPV_COVER_SEL = ".npv-cover-art-section";

const SIDEBAR_ICONS = {
  expand:
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="m8.4 6.4 3.6-3.4 3.6 3.4"/><path d="m8.4 17.6 3.6 3.4 3.6-3.4"/></svg>',
  chevron:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
};

export const SidebarLyrics = {
  _app: null,
  cardEl: null,
  bgEl: null,
  bodyEl: null,
  scrollEl: null,
  statusEl: null,
  _observer: null,
  _attachTimer: null,
  _retryInterval: null,
  _rafId: null,
  _mounted: false,
  _expanded: false,
  _collapsed: false,
  _requestId: 0,
  _currentUri: null,
  _loading: false,
  _lines: [],
  _lineEls: [],
  _syncType: "none",
  _activeIndex: -1,

  init(app) {
    this._app = app || null;
    this.syncEnabled();
  },

  _setNativeLyricsHidden(hidden) {
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.classList.toggle(HIDE_NATIVE_CLASS, Boolean(hidden));
    }
  },

  syncEnabled() {
    const enabled = Settings.get("sidebarLyrics") !== false;
    this._setNativeLyricsHidden(enabled);
    if (!enabled) {
      this._unmountCard();
      return;
    }
    this._mountCard();
    this.syncBackground();
    this.syncAnimation();
  },

  syncBackground() {
    if (!this.cardEl) return;
    const showBg = Settings.get("sidebarLyricsBg") !== false;
    this.cardEl.classList.toggle("fr-sb-has-bg", showBg);
  },

  syncAnimation() {
    if (!this.cardEl) return;
    const animated = Settings.get("sidebarLyricsAnim") !== false;
    this.cardEl.classList.toggle("fr-sb-animated", animated);
    if (!animated && this._activeIndex >= 0) {
      this._clearLineAnim(this._activeIndex);
    }
  },

  _mountCard() {
    if (this._mounted && this.cardEl) {
      this._ensureAttached();
      return;
    }
    this._mounted = true;

    document.getElementById(CARD_ID)?.remove();

    const card = el("section", "fr-sidebar-card");
    card.id = CARD_ID;
    if (Settings.get("sidebarLyricsBg") !== false) {
      card.classList.add("fr-sb-has-bg");
    }
    if (Settings.get("sidebarLyricsAnim") !== false) {
      card.classList.add("fr-sb-animated");
    }

    const bg = el("div", "fr-sb-bg");
    const scrim = el("div", "fr-sb-scrim");

    const header = el("div", "fr-sb-header");
    const titleBtn = el("button", "fr-sb-title-btn");
    titleBtn.setAttribute("type", "button");
    const iconSpan = el("span", "fr-sb-icon");
    iconSpan.innerHTML = Icons.lyrics;
    const titleSpan = el("span", "fr-sb-title", "Fullscreen Reloaded");
    titleBtn.append(iconSpan, titleSpan);
    titleBtn.addEventListener("click", () => this._toggleCollapsed());

    const controls = el("div", "fr-sb-controls");

    const expandBtn = el("button", "fr-sb-btn");
    expandBtn.setAttribute("type", "button");
    expandBtn.title = t("sidebarExpand");
    expandBtn.innerHTML = SIDEBAR_ICONS.expand;
    expandBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._expanded = !this._expanded;
      card.classList.toggle("fr-sb-expanded", this._expanded);
      expandBtn.classList.toggle("fr-active", this._expanded);
      if (this._activeIndex >= 0) this._scrollToActive(true);
    });

    const fsBtn = el("button", "fr-sb-btn");
    fsBtn.setAttribute("type", "button");
    fsBtn.title = t("sidebarOpenFullscreen");
    fsBtn.innerHTML = Icons.fullscreen;
    fsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._app?.launch?.();
    });

    const collapseBtn = el("button", "fr-sb-btn fr-sb-chevron-btn");
    collapseBtn.setAttribute("type", "button");
    collapseBtn.title = t("sidebarCollapse");
    collapseBtn.innerHTML = SIDEBAR_ICONS.chevron;
    collapseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggleCollapsed();
    });

    controls.append(expandBtn, fsBtn, collapseBtn);
    header.append(titleBtn, controls);

    const body = el("div", "fr-sb-body");
    const scrollEl = el("div", "fr-sb-scroll");
    const statusEl = el("div", "fr-sb-status", t("sidebarLoading"));
    body.append(scrollEl, statusEl);

    card.append(bg, scrim, header, body);

    this.cardEl = card;
    this.bgEl = bg;
    this.bodyEl = body;
    this.scrollEl = scrollEl;
    this.statusEl = statusEl;

    this._ensureAttached();
    this._startObserving();
    this._startLoop();

    const currentTrack = SpotiKitBridge.getCurrentTrack();
    if (currentTrack) {
      this.onTrackChange(currentTrack);
    }
  },

  _toggleCollapsed() {
    if (!this.cardEl) return;
    this._collapsed = !this._collapsed;
    this.cardEl.classList.toggle("fr-sb-collapsed", this._collapsed);
  },

  _findSlot() {
    if (typeof document === "undefined") return null;
    const panel =
      document.querySelector(`${RIGHT_SIDEBAR_SEL} ${NPV_PANEL_SEL}`) ||
      document.querySelector(NPV_PANEL_SEL);
    if (!panel) return null;

    const findTopRow = (node) => {
      let cur = node;
      while (cur && cur.parentElement && cur.parentElement !== panel) {
        cur = cur.parentElement;
      }
      return cur && cur.parentElement === panel ? cur : null;
    };

    const nativeLyrics = panel.querySelector(NPV_LYRICS_SEL);
    const lyricsRow = nativeLyrics ? findTopRow(nativeLyrics) : null;
    if (lyricsRow) return { parent: panel, before: lyricsRow };

    const coverSection = panel.querySelector(NPV_COVER_SEL);
    const coverRow = coverSection ? findTopRow(coverSection) : null;
    if (coverRow) {
      const next = coverRow.nextElementSibling;
      return { parent: panel, before: next === this.cardEl ? this.cardEl.nextElementSibling : next };
    }

    return { parent: panel, before: panel.firstElementChild === this.cardEl ? this.cardEl : panel.firstElementChild };
  },

  _ensureAttached() {
    if (!this.cardEl || !this._mounted) return false;
    const slot = this._findSlot();
    if (!slot) return false;
    if (this.cardEl.parentElement === slot.parent) return true;
    try {
      slot.parent.insertBefore(this.cardEl, slot.before || null);
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
        }, 300);
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
    if (!this._mounted || !this.cardEl || !track) return;
    const meta = track.metadata || {};
    const imgUrl = resolveImageUrl(
      meta.image_xlarge_url ||
        meta.image_large_url ||
        meta.image_url ||
        track.album?.images?.[0]?.url ||
        track.images?.[0]?.url
    );
    if (this.bgEl && imgUrl) {
      this.bgEl.style.backgroundImage = `url("${imgUrl}")`;
    }

    if (this._currentUri === track.uri && (this._lines.length > 0 || this._loading)) return;
    this._currentUri = track.uri;
    this._loading = true;
    const req = ++this._requestId;

    this._lines = [];
    this._lineEls = [];
    this._activeIndex = -1;
    this._syncType = "none";
    if (this.scrollEl) this.scrollEl.innerHTML = "";
    if (this.statusEl) {
      this.statusEl.textContent = t("sidebarLoading");
      this.statusEl.classList.add("fr-show");
    }

    const data = await LyricsService.resolve(track);
    if (req !== this._requestId || !this._mounted || !this.scrollEl || SpotiKitBridge.isStopped()) return;
    this._loading = false;

    if (!data || !Array.isArray(data.lines) || !data.lines.length) {
      if (this.statusEl) {
        this.statusEl.textContent = t("sidebarNoLyrics");
        this.statusEl.classList.add("fr-show");
      }
      return;
    }

    if (this.statusEl) this.statusEl.classList.remove("fr-show");
    this._syncType = data.type || "synced";
    this._lines = data.lines.map((l) => ({ ...l }));
    if (this._syncType === "synced" || this._syncType === "word-synced") {
      this._lines.sort((a, b) => (Number(a.startMs) || 0) - (Number(b.startMs) || 0));
    }

    const frag = document.createDocumentFragment();
    const isSynced = this._syncType === "synced" || this._syncType === "word-synced";

    for (let i = 0; i < this._lines.length; i++) {
      const line = this._lines[i];
      const nextLine = this._lines[i + 1];
      const lineStart = Number(line.startMs) || 0;
      const nextStart = nextLine ? Number(nextLine.startMs) : lineStart + 3200;
      line._sbSpanMs = Math.max(400, nextStart - lineStart);

      const lineEl = el("div", "fr-sb-line fr-sb-future");
      if (this._syncType === "word-synced" && Array.isArray(line.words) && line.words.length) {
        const normWords = normalizeWordTimings(
          line.words.map((w) => (typeof w === "object" ? { ...w } : { text: String(w || "") })),
          lineStart,
          line._sbSpanMs
        );
        line._sbWords = normWords.map((w) => {
          const span = el("span", "fr-sb-word", w.text || "");
          lineEl.appendChild(span);
          return { el: span, startMs: w.startMs, endMs: w.endMs };
        });
      } else {
        const text =
          line.text ||
          (Array.isArray(line.words) ? line.words.map((w) => (typeof w === "string" ? w : w?.text || "")).join("").trim() : "");
        const span = el("span", "fr-sb-sentence", text || "♪");
        lineEl.appendChild(span);
        line._sbSentenceEl = span;
      }

      if (isSynced) {
        lineEl.classList.add("fr-sb-clickable");
        lineEl.addEventListener("click", () => {
          SpotiKitBridge.seek(lineStart);
        });
      }
      frag.appendChild(lineEl);
      this._lineEls.push(lineEl);
    }

    this.scrollEl.appendChild(frag);
    this._tick(true);
  },

  _clearLineAnim(idx) {
    const line = this._lines[idx];
    if (!line) return;
    if (line._sbSentenceEl) {
      line._sbSentenceEl.style.removeProperty("--sb-pct");
    }
    if (Array.isArray(line._sbWords)) {
      for (let k = 0; k < line._sbWords.length; k++) {
        const w = line._sbWords[k];
        w.el.classList.remove("fr-sb-w-active", "fr-sb-w-done");
        w.el.style.removeProperty("--sb-w-pct");
      }
    }
  },

  _scrollToActive(instant = false) {
    if (!this.scrollEl || this._activeIndex < 0) return;
    const activeEl = this._lineEls[this._activeIndex];
    if (!activeEl) return;
    const containerH = this.scrollEl.clientHeight || 340;
    const targetTop = Math.max(0, activeEl.offsetTop - containerH * 0.36 + (activeEl.offsetHeight || 36) / 2);
    if (typeof this.scrollEl.scrollTo === "function") {
      this.scrollEl.scrollTo({
        top: targetTop,
        behavior: instant ? "auto" : "smooth",
      });
    } else {
      this.scrollEl.scrollTop = targetTop;
    }
  },

  _tick(instant = false) {
    if (!this._mounted || this._collapsed || !this._lines.length) return;
    if (this._syncType !== "synced" && this._syncType !== "word-synced") return;

    const progressMs = SpotiKitBridge.getProgress();
    let idx = -1;
    if (this._lines[0] && progressMs >= (Number(this._lines[0].startMs) || 0)) {
      idx = this._activeIndex < 0 ? 0 : this._activeIndex;
      while (idx + 1 < this._lines.length && (Number(this._lines[idx + 1].startMs) || 0) <= progressMs) idx++;
      while (idx > 0 && (Number(this._lines[idx].startMs) || 0) > progressMs) idx--;
    }

    if (idx !== this._activeIndex || instant) {
      const prevIdx = this._activeIndex;
      if (prevIdx >= 0 && prevIdx !== idx) this._clearLineAnim(prevIdx);
      this._activeIndex = idx;
      for (let i = 0; i < this._lineEls.length; i++) {
        const node = this._lineEls[i];
        node.classList.toggle("fr-sb-active", i === idx);
        node.classList.toggle("fr-sb-past", idx >= 0 && i < idx);
        node.classList.toggle("fr-sb-future", idx < 0 || i > idx);
      }
      this._scrollToActive(instant);
    }

    // Live karaoke animation inside right sidebar (when enabled in settings)
    const animated = Settings.get("sidebarLyricsAnim") !== false;
    if (!animated || this._activeIndex < 0) return;

    const activeLine = this._lines[this._activeIndex];
    if (!activeLine) return;

    if (Array.isArray(activeLine._sbWords) && activeLine._sbWords.length) {
      for (let k = 0; k < activeLine._sbWords.length; k++) {
        const w = activeLine._sbWords[k];
        if (progressMs <= w.startMs) {
          w.el.classList.remove("fr-sb-w-active", "fr-sb-w-done");
          w.el.style.removeProperty("--sb-w-pct");
        } else if (progressMs >= w.endMs) {
          w.el.classList.remove("fr-sb-w-active");
          w.el.classList.add("fr-sb-w-done");
          w.el.style.removeProperty("--sb-w-pct");
        } else {
          w.el.classList.remove("fr-sb-w-done");
          w.el.classList.add("fr-sb-w-active");
          const r = clamp01((progressMs - w.startMs) / Math.max(40, w.endMs - w.startMs));
          w.el.style.setProperty("--sb-w-pct", `${(-15 + r * 130).toFixed(1)}%`);
        }
      }
    } else if (activeLine._sbSentenceEl) {
      const start = Number(activeLine.startMs) || 0;
      const p = clamp01((progressMs - start) / Math.max(400, activeLine._sbSpanMs || 2400));
      activeLine._sbSentenceEl.style.setProperty("--sb-pct", `${(p * 118).toFixed(1)}%`);
    }
  },

  _startLoop() {
    if (this._rafId) return;
    const step = () => {
      if (!this._mounted || SpotiKitBridge.isStopped()) {
        this._rafId = null;
        return;
      }
      if (!this._app?.open && !this._collapsed) {
        this._tick(false);
      }
      this._rafId = requestAnimationFrame(step);
    };
    this._rafId = requestAnimationFrame(step);
  },

  _unmountCard() {
    this._mounted = false;
    this._requestId++;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
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
    this.cardEl?.remove();
    this.cardEl = null;
    this.bgEl = null;
    this.bodyEl = null;
    this.scrollEl = null;
    this.statusEl = null;
    this._lines = [];
    this._lineEls = [];
    this._activeIndex = -1;
    this._currentUri = null;
    this._loading = false;
    this._syncType = "none";
  },

  destroy() {
    this._setNativeLyricsHidden(false);
    this._unmountCard();
    this._app = null;
  },
};
