/**
 * FullLyricsCreator
 * Modular studio lyrics editor & synchronizer coordinator for Fullscreen Reloaded.
 * Delegates step rendering, cue stamping, chrome, and preview to `src/components/creator/`.
 */
import { el } from "../utils/dom.js";
import { t } from "../utils/i18n.js";
import { SpotiKitBridge } from "../services/SpotiKitBridge.js";
import { LyricsService } from "../services/LyricsService.js";
import { LyricsView } from "./LyricsView.js";
import {
  getCustomSync,
  extractTrackId,
  normalizeTrackUri,
  splitTextIntoTokens,
  parsePlainTextToDraftLines,
  serializeDraftLinesToText,
  fullscreenLinesToDraft,
  importFileToDraft,
  CHANGE_EVENT,
} from "../services/CustomSyncStorage.js";
import { CreatorSyncEngine } from "./creator/CreatorSyncEngine.js";
import { CreatorChrome } from "./creator/CreatorChrome.js";
import { CreatorTextStep } from "./creator/CreatorTextStep.js";
import { CreatorSyncStep } from "./creator/CreatorSyncStep.js";
import { CreatorPreviewStep } from "./creator/CreatorPreviewStep.js";

export const FullLyricsCreator = {
  root: null,
  backdrop: null,
  modal: null,
  bodyEl: null,
  fileInputEl: null,
  toastEl: null,
  _toastTimer: null,

  isOpen: false,
  app: null,
  step: "text", // "text" | "sync" | "preview"
  textSubMode: "visual", // "visual" | "raw"
  libraryOpen: false,
  moreMenuOpen: false,

  draft: null,
  rawTextCache: "",
  activeTarget: {
    type: "line", // "line" | "token" | "lineEnd" | "bgToken" | "bgEnd" | "end"
    lineIdx: 0,
    tokenIdx: 0,
    bgIdx: 0,
  },

  // Live preview & transport state
  _rafId: null,
  _previewLines: [],
  _previewLineEls: [],
  _previewType: "none",
  _lastKnownProgress: 0,
  _lastKnownTime: 0,
  _lastKnownPlaying: false,
  _scrubbing: false,
  _abortController: null,
  _dragAbortController: null,

  build(app) {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    this.app = app;
    const backdrop = el("div", "fr-creator-backdrop");
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) this.close();
    });

    const modal = el("div", "fr-creator-modal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-label", t("creatorTitle"));

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json,.ttml,.xml,.lrc,.txt";
    fileInput.hidden = true;
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (file) this.handleImportFile(file);
    });

    const toastEl = el("div", "fr-creator-toast");

    modal.append(fileInput, toastEl);
    backdrop.appendChild(modal);

    this.root = backdrop;
    this.backdrop = backdrop;
    this.modal = modal;
    this.fileInputEl = fileInput;
    this.toastEl = toastEl;

    // Listen to external or internal custom sync changes
    window.addEventListener(
      CHANGE_EVENT,
      () => {
        if (!this.root || !this.app?._mounted || SpotiKitBridge.isStopped()) return;
        LyricsService.clearCache();
        if (this.app?.currentTrack) {
          LyricsView.loadForTrack(this.app.currentTrack, this.app, true);
        }
      },
      { signal }
    );

    return backdrop;
  },

  showToast(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.add("fr-show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastEl?.classList.remove("fr-show");
    }, 2600);
  },

  getCurrentTrackInfo() {
    const track = this.app?.currentTrack || SpotiKitBridge.getCurrentTrack() || {};
    const meta = track.metadata || {};
    const trackUri = normalizeTrackUri(track.uri || "");
    const trackId = extractTrackId(trackUri || track.id || "");
    const title = meta.title || track.name || t("unknownTitle");
    const artist =
      track.artists && track.artists.length
        ? track.artists.map((a) => a.name || a.displayName || "").filter(Boolean).join(", ")
        : meta.artist_name || t("unknownArtist");
    const durationMs = Number(meta.duration) || SpotiKitBridge.getDuration() || 180000;
    return { track, trackUri, trackId, title, artist, durationMs };
  },

  async openForCurrentTrack() {
    const info = this.getCurrentTrackInfo();
    const saved = getCustomSync(info.trackUri || info.trackId);

    if (saved && saved.draft) {
      const d = saved.draft;
      const inferredSyncMode =
        d.syncMode ||
        (saved.lyrics?.Type === "Static"
          ? "static"
          : saved.mode === "word" || saved.lyrics?.Type === "Syllable"
          ? "word"
          : "line");
      this.draft = {
        trackId: info.trackId || d.trackId,
        trackUri: info.trackUri || d.trackUri,
        title: info.title || d.title,
        artist: info.artist || d.artist,
        durationMs: info.durationMs || d.durationMs || 180000,
        mode: inferredSyncMode === "word" ? "word" : "line",
        syncMode: inferredSyncMode,
        credit: d.credit ?? saved.credit ?? "",
        lines: (d.lines || []).map((l) =>
          l.kind === "interlude"
            ? { kind: "interlude", start: l.start ?? null, end: l.end ?? null }
            : {
                kind: "lyric",
                text: l.text || "",
                isDuet: Boolean(l.isDuet),
                tokens: (l.tokens || splitTextIntoTokens(l.text || "")).map((tok) => ({
                  text: tok.text,
                  start: tok.start ?? null,
                  end: tok.end ?? null,
                })),
                backgrounds: (l.backgrounds || []).map((b) => ({
                  text: b.text || "",
                  tokens: (b.tokens || splitTextIntoTokens(b.text || "")).map((bt) => ({
                    text: bt.text,
                    start: bt.start ?? null,
                    end: bt.end ?? null,
                  })),
                  start: b.start ?? null,
                  end: b.end ?? null,
                })),
                start: l.start ?? null,
                end: l.end ?? null,
              }
        ),
        endMs: d.endMs ?? info.durationMs ?? null,
        updatedAt: d.updatedAt || Date.now(),
      };
      this.rawTextCache = serializeDraftLinesToText(this.draft.lines);
      this.step = this.draft.lines.length > 0 ? "sync" : "text";
    } else if (LyricsView.lines && LyricsView.lines.length > 0) {
      // Pre-populate from currently displayed lyrics in LyricsView!
      this.draft = fullscreenLinesToDraft(
        {
          type: LyricsView.syncType,
          lines: LyricsView.lines,
        },
        info
      );
      this.rawTextCache = serializeDraftLinesToText(this.draft.lines);
      this.step = "text";
    } else {
      this.draft = {
        trackId: info.trackId,
        trackUri: info.trackUri,
        title: info.title,
        artist: info.artist,
        durationMs: info.durationMs,
        mode: "word",
        syncMode: "word",
        credit: "",
        lines: [],
        endMs: info.durationMs || null,
        updatedAt: Date.now(),
      };
      this.rawTextCache = "";
      this.step = "text";
    }

    this.libraryOpen = false;
    this.moreMenuOpen = false;
    this.activeTarget = this.findFirstIncompleteTarget();
    this.isOpen = true;
    this.root.classList.add("fr-show");
    this.render();
    this.startTransportLoop();
    this.bindKeyHandler();
  },

  toggleOpen() {
    if (this.isOpen) this.close();
    else this.openForCurrentTrack();
  },

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.libraryOpen = false;
    this.moreMenuOpen = false;
    this.root?.classList.remove("fr-show");
    this.stopTransportLoop();
    this.unbindKeyHandler();
  },

  // ==========================================================================
  // Mode & Step Transitions
  // ==========================================================================

  syncRawTextToDraft() {
    if (this.step === "text" && this.textSubMode === "raw") {
      this.draft.lines = parsePlainTextToDraftLines(this.rawTextCache, this.draft.lines);
    }
  },

  setSyncMode(newMode) {
    if (!this.draft || this.draft.syncMode === newMode) return;
    this.syncRawTextToDraft();

    // Carry timestamps smoothly between line <-> word modes
    for (const line of this.draft.lines) {
      if (!line || line.kind !== "lyric") continue;
      if (newMode === "line" && line.start == null && line.tokens?.[0]?.start != null) {
        line.start = line.tokens[0].start;
      } else if (newMode === "word" && line.start != null && line.tokens?.length) {
        if (line.tokens[0].start == null) {
          line.tokens[0].start = line.start;
        }
      }
    }

    this.draft.syncMode = newMode;
    this.draft.mode = newMode === "word" ? "word" : "line";
    this.activeTarget = this.findFirstIncompleteTarget();
    this.render();
  },

  setStep(nextStep) {
    if (nextStep === this.step) return;
    this.syncRawTextToDraft();
    this.rawTextCache = serializeDraftLinesToText(this.draft.lines);
    this.step = nextStep;
    if (nextStep === "sync") {
      this.activeTarget = this.findFirstIncompleteTarget();
    }
    this.render();
  },

  // ==========================================================================
  // Keyboard Shortcuts in Studio
  // ==========================================================================

  bindKeyHandler() {
    if (this._keyHandler) return;
    this._keyHandler = (e) => {
      if (!this.isOpen) return;
      const target = e.target;
      const isElement =
        typeof HTMLElement !== "undefined"
          ? target instanceof HTMLElement
          : target && typeof target.tagName === "string";
      const isInput =
        isElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (this.libraryOpen || this.moreMenuOpen) {
          this.libraryOpen = false;
          this.moreMenuOpen = false;
          this.render();
          return;
        }
        this.close();
        return;
      }

      if (isInput || this.step !== "sync") return;

      // Space or Right Alt -> Stamp Cue
      if (e.code === "Space" || e.code === "AltRight") {
        e.preventDefault();
        e.stopPropagation();
        this.stampCurrentCue();
        return;
      }

      // P or K -> Toggle Play/Pause without stamping
      if (e.key === "p" || e.key === "P" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        e.stopPropagation();
        SpotiKitBridge.togglePlay();
        return;
      }

      // Backspace -> Undo last cue
      if (e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        this.undoLastCue();
        return;
      }

      // Delete -> Clear active cue
      if (e.key === "Delete") {
        e.preventDefault();
        e.stopPropagation();
        this.setTargetTime(this.activeTarget, null);
        this.renderSyncListOnly();
        return;
      }

      // Arrow Up / Down -> Move between targets
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        this.moveActiveTarget(-1, false);
        this.renderSyncListOnly();
        this.scrollActiveTargetIntoView();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        this.moveActiveTarget(1, false);
        this.renderSyncListOnly();
        this.scrollActiveTargetIntoView();
        return;
      }

      // Arrow Left / Right -> Nudge active target time (±100ms, or ±300ms with Shift)
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        const cur = this.getTargetTime(this.activeTarget);
        if (cur != null) {
          const delta = (e.shiftKey ? 300 : 100) * (e.key === "ArrowLeft" ? -1 : 1);
          this.setTargetTime(this.activeTarget, Math.max(0, cur + delta));
          this.renderSyncListOnly();
        }
      }
    };
    window.addEventListener("keydown", this._keyHandler, true);
  },

  unbindKeyHandler() {
    if (!this._keyHandler) return;
    window.removeEventListener("keydown", this._keyHandler, true);
    this._keyHandler = null;
  },

  destroy() {
    this.close();
    this.stopTransportLoop();
    this.unbindKeyHandler();

    clearTimeout(this._toastTimer);
    this._toastTimer = null;

    this._abortController?.abort();
    this._abortController = null;
    this._dragAbortController?.abort();
    this._dragAbortController = null;

    this._scrubbing = false;
    this._wasTransportPlaying = null;
    this._previewLines = [];
    this._previewLineEls = [];
    this.draft = null;
    this.app = null;

    this.root?.remove();
    this.root = null;
    this.backdrop = null;
    this.modal = null;
    this.bodyEl = null;
    this.fileInputEl = null;
    this.toastEl = null;
    this.transportPlayBtn = null;
    this.transportCurEl = null;
    this.transportDurEl = null;
    this.transportFillEl = null;
  },
};

Object.assign(
  FullLyricsCreator,
  CreatorSyncEngine,
  CreatorChrome,
  CreatorTextStep,
  CreatorSyncStep,
  CreatorPreviewStep
);
