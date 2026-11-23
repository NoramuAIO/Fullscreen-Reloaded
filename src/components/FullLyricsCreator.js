/**
 * FullLyricsCreator
 * Comprehensive studio lyrics editor & synchronizer for Fullscreen Reloaded.
 * - 100% compatible with Liquid Lyrics localStorage (`liquid-lyrics-custom-sync:<trackUri>`)
 *   and Spicy Lyrics universal JSON schema (`Static` | `Line` | `Syllable`).
 * - Supports Block (`line`), Karaoke (`word`), and Static (`static`) modes,
 *   Visual Sentence & Word Builder + Raw Text editor, Duet (`v2`), Background Vocals (`[bg]`),
 *   Interludes (`#interlude`), TTML/LRC/JSON/TXT import & export, and Local DB Library management.
 */
import { el } from "../utils/dom.js";
import { Icons } from "../utils/icons.js";
import { t } from "../utils/i18n.js";
import { SpotiKitBridge } from "../services/SpotiKitBridge.js";
import { LyricsService } from "../services/LyricsService.js";
import { LyricsView } from "./LyricsView.js";
import {
  getCustomSync,
  hasCustomSync,
  saveCustomSync,
  deleteCustomSync,
  listCustomSyncs,
  extractTrackId,
  normalizeTrackUri,
  splitTextIntoTokens,
  createLyricDraftLine,
  createInterludeDraftLine,
  createBackgroundDraftEntry,
  parsePlainTextToDraftLines,
  serializeDraftLinesToText,
  isDraftLineComplete,
  compileDraftToSpicyLyrics,
  spicyLyricsToFullscreenLines,
  fullscreenLinesToDraft,
  importFileToDraft,
  exportDraftAsJSON,
  exportDraftAsTTML,
  exportDraftAsLRC,
  CHANGE_EVENT,
} from "../services/CustomSyncStorage.js";

function formatCueTime(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "--:--.--";
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function formatTransportTime(ms) {
  const safe = Math.max(0, Math.floor(Number(ms) || 0));
  const min = Math.floor(safe / 60000);
  const sec = Math.floor((safe % 60000) / 1000);
  const tenth = Math.floor((safe % 1000) / 100);
  return `${min}:${String(sec).padStart(2, "0")}.${tenth}`;
}

function downloadFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFileSlug(title, artist) {
  const raw = [artist, title].filter(Boolean).join(" - ") || "lyrics";
  return raw.replace(/[\\/:*?"<>|]+/g, "_").trim();
}

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
  // Actions: Pull Online Lyrics, Auto-Spread Words, Import, Export, Save, Delete
  // ==========================================================================

  async pullOnlineLyrics() {
    const info = this.getCurrentTrackInfo();
    this.showToast("Online sözler çekiliyor...");
    try {
      const online = await LyricsService.resolveOnlineOnly(info.track);
      if (!online || !online.lines || !online.lines.length) {
        this.showToast("Bu şarkı için online söz bulunamadı.");
        return;
      }
      const nextDraft = fullscreenLinesToDraft(online, info);
      nextDraft.credit = this.draft?.credit || "";
      this.draft = nextDraft;
      this.rawTextCache = serializeDraftLinesToText(this.draft.lines);
      this.activeTarget = this.findFirstIncompleteTarget();
      this.render();
      this.showToast(`${online.source || "Online"} sözleri yüklendi (${this.draft.lines.length} satır)`);
    } catch (e) {
      this.showToast("Online sözler alınırken hata oluştu.");
    }
  },

  autoSpreadWordTimings() {
    if (!this.draft || !this.draft.lines.length) return;
    const lines = this.draft.lines;
    const durationFallback = this.draft.endMs || this.draft.durationMs || 180000;
    let count = 0;

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l || l.kind !== "lyric" || !l.tokens?.length) continue;
      const lineStart = l.start ?? l.tokens[0]?.start ?? null;
      if (lineStart == null) continue;

      let nextStart = durationFallback;
      for (let j = i + 1; j < lines.length; j++) {
        const ns = lines[j].start ?? lines[j].tokens?.[0]?.start ?? null;
        if (ns != null) {
          nextStart = ns;
          break;
        }
      }
      const lineEnd = l.end != null && l.end > lineStart ? l.end : Math.min(nextStart, lineStart + Math.max(1800, l.tokens.length * 420));
      const span = Math.max(300, lineEnd - lineStart);
      const step = span / l.tokens.length;

      l.tokens.forEach((tok, idx) => {
        tok.start = Math.round(lineStart + idx * step);
        tok.end = Math.round(lineStart + (idx + 1) * step);
      });
      l.start = lineStart;
      l.end = Math.round(lineEnd);
      count++;
    }

    if (count > 0) {
      this.draft.syncMode = "word";
      this.draft.mode = "word";
      this.render();
      this.showToast(`${count} satırın kelime zamanları otomatik dağıtıldı!`);
    } else {
      this.showToast("Dağıtmak için önce en az bir satırın başlangıç zamanı olmalı.");
    }
  },

  async handleImportFile(file) {
    try {
      const content = await file.text();
      const info = this.getCurrentTrackInfo();
      const importedDraft = importFileToDraft(content, file.name, info);
      this.draft = importedDraft;
      this.rawTextCache = serializeDraftLinesToText(this.draft.lines);
      this.activeTarget = this.findFirstIncompleteTarget();
      this.render();
      this.showToast(`İçe aktarıldı: ${file.name}`);
    } catch (e) {
      this.showToast(`İçe aktarma hatası: ${e.message || "Geçersiz dosya"}`);
    }
  },

  handleSaveToLocalDB() {
    this.syncRawTextToDraft();
    if (!this.draft || !this.draft.lines.length) {
      this.showToast("Kaydedilecek şarkı sözü satırı yok.");
      return;
    }

    const compiled = compileDraftToSpicyLyrics(this.draft);
    const hasOutput =
      compiled.Type === "Static"
        ? (compiled.Lines || []).length > 0
        : (compiled.Content || []).length > 0;

    if (!hasOutput) {
      this.showToast("En az bir satırı zamanlayın veya 'Statik (Düz)' modunu seçin.");
      return;
    }

    const compatMode = this.draft.syncMode === "word" ? "word" : "line";
    saveCustomSync({
      version: 1,
      trackId: this.draft.trackId,
      trackUri: this.draft.trackUri,
      title: this.draft.title,
      artist: this.draft.artist,
      durationMs: this.draft.durationMs,
      mode: compatMode,
      ...(this.draft.credit?.trim() ? { credit: this.draft.credit.trim() } : {}),
      updatedAt: Date.now(),
      lyrics: compiled,
      draft: {
        ...this.draft,
        mode: compatMode,
        updatedAt: Date.now(),
      },
    });

    LyricsService.clearCache();
    if (this.app?.currentTrack) {
      LyricsView.loadForTrack(this.app.currentTrack, this.app, true);
    }
    this.render();
    this.showToast("Local DB'ye kaydedildi (Liquid Lyrics & Fullscreen Reloaded uyumlu)!");
  },

  handleDeleteFromLocalDB(targetUriOrId) {
    const uri = targetUriOrId || this.draft?.trackUri || this.draft?.trackId;
    if (!uri) return;
    deleteCustomSync(uri);
    LyricsService.clearCache();
    if (this.app?.currentTrack) {
      LyricsView.loadForTrack(this.app.currentTrack, this.app, true);
    }
    this.render();
    this.showToast("Local DB kaydı silindi.");
  },

  // ==========================================================================
  // Cue Target Navigation, Stamping & Nudging (Step 2 Sync Studio)
  // ==========================================================================

  getTargetList() {
    if (!this.draft) return [];
    const lines = this.draft.lines || [];
    const syncMode = this.draft.syncMode || "word";
    const list = [];

    if (syncMode === "static") return list;

    if (syncMode === "line") {
      for (let i = 0; i < lines.length; i++) {
        list.push({ type: "line", lineIdx: i, tokenIdx: 0, bgIdx: 0 });
      }
      list.push({ type: "end", lineIdx: lines.length, tokenIdx: 0, bgIdx: 0 });
      return list;
    }

    // Word (Karaoke) mode
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      if (l.kind === "interlude") {
        list.push({ type: "line", lineIdx: i, tokenIdx: 0, bgIdx: 0 });
        continue;
      }
      for (let tIdx = 0; tIdx < l.tokens.length; tIdx++) {
        list.push({ type: "token", lineIdx: i, tokenIdx: tIdx, bgIdx: 0 });
      }
      list.push({ type: "lineEnd", lineIdx: i, tokenIdx: l.tokens.length, bgIdx: 0 });

      for (let bIdx = 0; bIdx < (l.backgrounds || []).length; bIdx++) {
        const bg = l.backgrounds[bIdx];
        for (let btIdx = 0; btIdx < bg.tokens.length; btIdx++) {
          list.push({ type: "bgToken", lineIdx: i, tokenIdx: btIdx, bgIdx: bIdx });
        }
        list.push({ type: "bgEnd", lineIdx: i, tokenIdx: bg.tokens.length, bgIdx: bIdx });
      }
    }
    list.push({ type: "end", lineIdx: lines.length, tokenIdx: 0, bgIdx: 0 });
    return list;
  },

  isTargetEqual(a, b) {
    if (!a || !b) return false;
    return (
      a.type === b.type &&
      a.lineIdx === b.lineIdx &&
      (a.tokenIdx || 0) === (b.tokenIdx || 0) &&
      (a.bgIdx || 0) === (b.bgIdx || 0)
    );
  },

  getTargetTime(target) {
    if (!this.draft || !target) return null;
    if (target.type === "end") return this.draft.endMs ?? null;
    const line = this.draft.lines[target.lineIdx];
    if (!line) return null;
    if (target.type === "line") return line.start ?? null;
    if (line.kind !== "lyric") return null;
    if (target.type === "lineEnd") return line.end ?? null;
    if (target.type === "token") return line.tokens[target.tokenIdx]?.start ?? null;
    if (target.type === "bgToken") {
      return line.backgrounds[target.bgIdx]?.tokens[target.tokenIdx]?.start ?? null;
    }
    if (target.type === "bgEnd") {
      return line.backgrounds[target.bgIdx]?.end ?? null;
    }
    return null;
  },

  findChronologicalInsertIndex(timeMs) {
    if (!this.draft || !Array.isArray(this.draft.lines) || !this.draft.lines.length) return 0;
    if (timeMs == null || timeMs <= 0) return this.draft.lines.length;
    for (let i = 0; i < this.draft.lines.length; i++) {
      const line = this.draft.lines[i];
      const s = line.start ?? line.tokens?.[0]?.start ?? null;
      if (s != null && s > timeMs) {
        return i;
      }
    }
    return this.draft.lines.length;
  },

  setTargetTime(target, ms) {
    if (!this.draft || !target) return;
    const val = ms == null ? null : Math.max(0, Math.round(ms));

    if (target.type === "end") {
      this.draft.endMs = val;
      return;
    }
    const line = this.draft.lines[target.lineIdx];
    if (!line) return;

    if (target.type === "line") {
      line.start = val;
      return;
    }
    if (line.kind !== "lyric") return;

    if (target.type === "lineEnd") {
      line.end = val;
      if (line.tokens.length > 0 && val != null) {
        line.tokens[line.tokens.length - 1].end = val;
      }
      return;
    }

    if (target.type === "token") {
      const tok = line.tokens[target.tokenIdx];
      if (!tok) return;
      tok.start = val;
      if (target.tokenIdx === 0) {
        line.start = val;
      }
      if (target.tokenIdx > 0 && val != null) {
        const prevTok = line.tokens[target.tokenIdx - 1];
        if (prevTok && (prevTok.end == null || prevTok.end > val)) {
          prevTok.end = val;
        }
      }
      if (line.end != null && val != null && line.end <= val) {
        line.end = null;
      }
      return;
    }

    if (target.type === "bgToken") {
      const bg = line.backgrounds[target.bgIdx];
      const tok = bg?.tokens[target.tokenIdx];
      if (!tok) return;
      tok.start = val;
      if (target.tokenIdx === 0) bg.start = val;
      if (target.tokenIdx > 0 && val != null) {
        const prevBgTok = bg.tokens[target.tokenIdx - 1];
        if (prevBgTok && (prevBgTok.end == null || prevBgTok.end > val)) {
          prevBgTok.end = val;
        }
      }
      if (bg.end != null && val != null && bg.end <= val) {
        bg.end = null;
      }
      return;
    }

    if (target.type === "bgEnd") {
      const bg = line.backgrounds[target.bgIdx];
      if (!bg) return;
      bg.end = val;
      if (bg.tokens.length > 0 && val != null) {
        bg.tokens[bg.tokens.length - 1].end = val;
      }
    }
  },

  findFirstIncompleteTarget() {
    const targets = this.getTargetList();
    for (const tObj of targets) {
      if (tObj.type === "lineEnd" || tObj.type === "bgEnd") continue;
      if (this.getTargetTime(tObj) == null) return tObj;
    }
    return targets[0] || { type: "line", lineIdx: 0, tokenIdx: 0, bgIdx: 0 };
  },

  moveActiveTarget(delta, skipOptionalEnds = false) {
    const targets = this.getTargetList();
    if (!targets.length) return;
    let idx = targets.findIndex((item) => this.isTargetEqual(item, this.activeTarget));
    if (idx < 0) idx = 0;

    let nextIdx = idx + delta;
    while (
      skipOptionalEnds &&
      nextIdx >= 0 &&
      nextIdx < targets.length &&
      (targets[nextIdx].type === "lineEnd" || targets[nextIdx].type === "bgEnd")
    ) {
      nextIdx += delta >= 0 ? 1 : -1;
    }

    nextIdx = Math.max(0, Math.min(targets.length - 1, nextIdx));
    this.activeTarget = targets[nextIdx];
  },

  stampCurrentCue() {
    if (!this.draft || !this.draft.lines.length) return;
    const nowMs = Math.max(0, Math.round(this.getAccurateProgressMs()));
    this.setTargetTime(this.activeTarget, nowMs);
    // Advance to next primary cue (or optional end if user explicitly selected it)
    const wasEndFlag =
      this.activeTarget.type === "lineEnd" || this.activeTarget.type === "bgEnd";
    this.moveActiveTarget(1, !wasEndFlag);
    this.renderSyncListOnly();
    this.scrollActiveTargetIntoView();
  },

  undoLastCue() {
    const targets = this.getTargetList();
    if (!targets.length) return;
    let idx = targets.findIndex((item) => this.isTargetEqual(item, this.activeTarget));
    if (idx > 0 && this.getTargetTime(this.activeTarget) == null) {
      idx--;
      // If stepping back landed on an un-stamped lineEnd/bgEnd, step back once more to the last token
      if (
        idx > 0 &&
        (targets[idx].type === "lineEnd" || targets[idx].type === "bgEnd") &&
        this.getTargetTime(targets[idx]) == null
      ) {
        idx--;
      }
      this.activeTarget = targets[idx];
    }
    this.setTargetTime(this.activeTarget, null);
    this.renderSyncListOnly();
    this.scrollActiveTargetIntoView();
  },

  nudgeLineTime(lineIdx, deltaMs) {
    const line = this.draft?.lines[lineIdx];
    if (!line) return;
    if (line.start != null) line.start = Math.max(0, line.start + deltaMs);
    if (line.end != null) line.end = Math.max(0, line.end + deltaMs);
    if (line.kind === "lyric") {
      for (const tok of line.tokens || []) {
        if (tok.start != null) tok.start = Math.max(0, tok.start + deltaMs);
        if (tok.end != null) tok.end = Math.max(0, tok.end + deltaMs);
      }
      for (const bg of line.backgrounds || []) {
        if (bg.start != null) bg.start = Math.max(0, bg.start + deltaMs);
        if (bg.end != null) bg.end = Math.max(0, bg.end + deltaMs);
        for (const bt of bg.tokens || []) {
          if (bt.start != null) bt.start = Math.max(0, bt.start + deltaMs);
          if (bt.end != null) bt.end = Math.max(0, bt.end + deltaMs);
        }
      }
    }
    this.renderSyncListOnly();
  },

  nudgeAllTimes(deltaMs) {
    if (!this.draft) return;
    for (let i = 0; i < this.draft.lines.length; i++) {
      this.nudgeLineTime(i, deltaMs);
    }
    if (this.draft.endMs != null) {
      this.draft.endMs = Math.max(0, this.draft.endMs + deltaMs);
    }
    this.renderSyncListOnly();
    this.showToast(`Tüm zamanlar ${deltaMs > 0 ? `+${deltaMs}` : deltaMs}ms kaydırıldı`);
  },

  clearAllTimes() {
    if (!this.draft) return;
    for (const line of this.draft.lines) {
      line.start = null;
      line.end = null;
      if (line.kind === "lyric") {
        for (const tok of line.tokens || []) {
          tok.start = null;
          tok.end = null;
        }
        for (const bg of line.backgrounds || []) {
          bg.start = null;
          bg.end = null;
          for (const bt of bg.tokens || []) {
            bt.start = null;
            bt.end = null;
          }
        }
      }
    }
    this.draft.endMs = null;
    this.activeTarget = this.findFirstIncompleteTarget();
    this.renderSyncListOnly();
    this.showToast("Tüm zaman damgaları sıfırlandı.");
  },

  scrollActiveTargetIntoView() {
    if (!this.bodyEl) return;
    const activeChip =
      this.bodyEl.querySelector(".fr-creator-token.fr-active") ||
      this.bodyEl.querySelector(".fr-creator-sync-row.fr-active");
    activeChip?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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

  // ==========================================================================
  // Main Render
  // ==========================================================================

  render() {
    if (!this.modal || !this.draft) return;

    // Keep fileInput & toastEl
    this.modal.innerHTML = "";
    this.modal.append(this.fileInputEl, this.toastEl);

    this.modal.appendChild(this.buildHeader());
    this.modal.appendChild(this.buildStepBar());

    if (this.libraryOpen) {
      this.modal.appendChild(this.buildLibraryDrawer());
    }

    const body = el("div", "fr-creator-body");
    this.bodyEl = body;
    this.renderStepContent(body);
    this.modal.appendChild(body);

    this.modal.appendChild(this.buildTransportFooter());
  },

  buildHeader() {
    const header = el("div", "fr-creator-header");

    // Left: Title & Track Meta
    const titleWrap = el("div", "fr-creator-title-wrap");
    const topRow = el("div", "fr-creator-title-row");
    const h2 = el("h2", "fr-creator-title", t("creatorTitle"));
    topRow.appendChild(h2);

    if (hasCustomSync(this.draft.trackUri || this.draft.trackId)) {
      const badge = el("span", "fr-creator-saved-pill", t("creatorSavedBadge"));
      topRow.appendChild(badge);
    }

    const sub = el(
      "div",
      "fr-creator-sub",
      `${this.draft.title || "—"} — ${this.draft.artist || "—"}`
    );
    titleWrap.append(topRow, sub);

    // Center: Mode Switcher (Block / Karaoke / Static)
    const modeSwitch = el("div", "fr-creator-mode-switch");
    const modes = [
      { id: "line", label: t("creatorModeBlock") },
      { id: "word", label: t("creatorModeKaraoke") },
      { id: "static", label: t("creatorModeStatic") },
    ];
    for (const m of modes) {
      const btn = el(
        "button",
        `fr-creator-mode-btn${this.draft.syncMode === m.id ? " fr-active" : ""}`,
        m.label
      );
      btn.type = "button";
      btn.addEventListener("click", () => this.setSyncMode(m.id));
      modeSwitch.appendChild(btn);
    }

    // Right: Pull Online, Library, More Menu, Save, Close
    const actions = el("div", "fr-creator-header-actions");

    const pullBtn = el("button", "fr-creator-btn fr-creator-btn-ghost");
    pullBtn.type = "button";
    pullBtn.innerHTML = `${Icons.wand}<span>${t("creatorLoadCurrent")}</span>`;
    pullBtn.addEventListener("click", () => this.pullOnlineLyrics());

    const libCount = listCustomSyncs().length;
    const libBtn = el(
      "button",
      `fr-creator-btn fr-creator-btn-ghost${this.libraryOpen ? " fr-active" : ""}`
    );
    libBtn.type = "button";
    libBtn.innerHTML = `${Icons.library}<span>Local DB (${libCount})</span>`;
    libBtn.addEventListener("click", () => {
      this.libraryOpen = !this.libraryOpen;
      this.moreMenuOpen = false;
      this.render();
    });

    // More dropdown (Import / Export JSON, TTML, LRC / Delete)
    const moreWrap = el("div", "fr-creator-more-wrap");
    const moreBtn = el(
      "button",
      `fr-creator-icon-btn${this.moreMenuOpen ? " fr-active" : ""}`
    );
    moreBtn.type = "button";
    moreBtn.innerHTML = Icons.more;
    moreBtn.title = "Import / Export";
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.moreMenuOpen = !this.moreMenuOpen;
      this.libraryOpen = false;
      this.render();
    });
    moreWrap.appendChild(moreBtn);

    if (this.moreMenuOpen) {
      const menu = el("div", "fr-creator-dropdown");
      const addMenuItem = (iconSvg, label, onClick, danger = false) => {
        const item = el(
          "button",
          `fr-creator-dropdown-item${danger ? " fr-danger" : ""}`
        );
        item.type = "button";
        item.innerHTML = `${iconSvg}<span>${label}</span>`;
        item.addEventListener("click", () => {
          this.moreMenuOpen = false;
          onClick();
        });
        menu.appendChild(item);
      };

      addMenuItem(Icons.upload, t("creatorImport"), () => this.fileInputEl.click());
      addMenuItem(Icons.download, t("creatorExportJson"), () => {
        this.syncRawTextToDraft();
        const slug = safeFileSlug(this.draft.title, this.draft.artist);
        downloadFile(`${slug}.liquid-lyrics.json`, exportDraftAsJSON(this.draft), "application/json");
      });
      addMenuItem(Icons.download, t("creatorExportTtml"), () => {
        this.syncRawTextToDraft();
        const slug = safeFileSlug(this.draft.title, this.draft.artist);
        downloadFile(`${slug}.ttml`, exportDraftAsTTML(this.draft), "application/xml");
      });
      addMenuItem(Icons.download, t("creatorExportLrc"), () => {
        this.syncRawTextToDraft();
        const slug = safeFileSlug(this.draft.title, this.draft.artist);
        downloadFile(`${slug}.lrc`, exportDraftAsLRC(this.draft), "text/plain");
      });

      if (hasCustomSync(this.draft.trackUri || this.draft.trackId)) {
        addMenuItem(
          Icons.trash,
          t("creatorDeleteSync"),
          () => this.handleDeleteFromLocalDB(),
          true
        );
      }

      moreWrap.appendChild(menu);
    }

    const saveBtn = el("button", "fr-creator-btn fr-creator-btn-primary");
    saveBtn.type = "button";
    saveBtn.innerHTML = `${Icons.check}<span>${t("creatorSaveBtn")}</span>`;
    saveBtn.addEventListener("click", () => this.handleSaveToLocalDB());

    const closeBtn = el("button", "fr-creator-icon-btn");
    closeBtn.type = "button";
    closeBtn.innerHTML = Icons.close;
    closeBtn.addEventListener("click", () => this.close());

    actions.append(pullBtn, libBtn, moreWrap, saveBtn, closeBtn);
    header.append(titleWrap, modeSwitch, actions);
    return header;
  },

  buildStepBar() {
    const bar = el("div", "fr-creator-steps");
    const steps = [
      { id: "text", label: t("creatorStepText") },
      { id: "sync", label: t("creatorStepSync") },
      { id: "preview", label: t("creatorStepPreview") },
    ];
    for (const s of steps) {
      const btn = el(
        "button",
        `fr-creator-step-btn${this.step === s.id ? " fr-active" : ""}`,
        s.label
      );
      btn.type = "button";
      btn.addEventListener("click", () => this.setStep(s.id));
      bar.appendChild(btn);
    }
    return bar;
  },

  buildLibraryDrawer() {
    const drawer = el("div", "fr-creator-library");
    const head = el("div", "fr-creator-library-head");
    head.appendChild(
      el(
        "span",
        "fr-creator-library-title",
        `${t("creatorSavedLibrary")} (liquid-lyrics-custom-sync)`
      )
    );

    const list = listCustomSyncs();
    const grid = el("div", "fr-creator-library-list");

    if (!list.length) {
      grid.appendChild(
        el(
          "div",
          "fr-creator-empty-hint",
          "Henüz Local DB'de kayıtlı şarkı sözü bulunmuyor."
        )
      );
    } else {
      for (const item of list) {
        const row = el("div", "fr-creator-library-item");
        const meta = el("div", "fr-creator-library-meta");
        meta.append(
          el("div", "fr-creator-library-song", item.title || item.trackId),
          el(
            "div",
            "fr-creator-library-artist",
            `${item.artist || "—"} · ${item.mode === "word" ? "Karaoke (Word)" : "Block (Line)"}`
          )
        );

        const acts = el("div", "fr-creator-library-actions");
        const loadBtn = el("button", "fr-creator-mini-btn", "Editöre Yükle");
        loadBtn.type = "button";
        loadBtn.addEventListener("click", () => {
          const rec = getCustomSync(item.trackUri || item.trackId);
          if (rec && rec.draft) {
            this.draft = {
              ...rec.draft,
              syncMode:
                rec.draft.syncMode ||
                (rec.lyrics?.Type === "Static"
                  ? "static"
                  : rec.mode === "word"
                  ? "word"
                  : "line"),
            };
            this.rawTextCache = serializeDraftLinesToText(this.draft.lines || []);
            this.libraryOpen = false;
            this.render();
            this.showToast(`Yüklendi: ${item.title}`);
          }
        });

        const expBtn = el("button", "fr-creator-mini-btn", ".json");
        expBtn.type = "button";
        expBtn.addEventListener("click", () => {
          const rec = getCustomSync(item.trackUri || item.trackId);
          if (rec) {
            const slug = safeFileSlug(rec.title, rec.artist);
            downloadFile(
              `${slug}.liquid-lyrics.json`,
              JSON.stringify(rec, null, 2),
              "application/json"
            );
          }
        });

        const delBtn = el("button", "fr-creator-mini-btn fr-danger", "Sil");
        delBtn.type = "button";
        delBtn.addEventListener("click", () => {
          this.handleDeleteFromLocalDB(item.trackUri || item.trackId);
        });

        acts.append(loadBtn, expBtn, delBtn);
        row.append(meta, acts);
        grid.appendChild(row);
      }
    }

    drawer.append(head, grid);
    return drawer;
  },

  renderStepContent(container) {
    container.innerHTML = "";
    if (this.step === "text") {
      this.renderTextAndBuilderStep(container);
    } else if (this.step === "sync") {
      this.renderSyncStep(container);
    } else {
      this.renderPreviewStep(container);
    }
  },

  // ==========================================================================
  // STEP 1: Text & Visual Sentence / Word Builder
  // ==========================================================================

  renderTextAndBuilderStep(container) {
    const wrap = el("div", "fr-creator-text-step");

    // Sub-toolbar: Switch between Visual Builder & Raw Text + Quick Add Actions
    const toolbar = el("div", "fr-creator-subtoolbar");
    const subSwitch = el("div", "fr-creator-subswitch");

    const visBtn = el(
      "button",
      `fr-creator-subbtn${this.textSubMode === "visual" ? " fr-active" : ""}`,
      t("creatorVisualBuilder")
    );
    visBtn.type = "button";
    visBtn.addEventListener("click", () => {
      if (this.textSubMode === "raw") {
        this.draft.lines = parsePlainTextToDraftLines(this.rawTextCache, this.draft.lines);
      }
      this.textSubMode = "visual";
      this.renderStepContent(this.bodyEl);
    });

    const rawBtn = el(
      "button",
      `fr-creator-subbtn${this.textSubMode === "raw" ? " fr-active" : ""}`,
      t("creatorRawText")
    );
    rawBtn.type = "button";
    rawBtn.addEventListener("click", () => {
      this.rawTextCache = serializeDraftLinesToText(this.draft.lines);
      this.textSubMode = "raw";
      this.renderStepContent(this.bodyEl);
    });

    subSwitch.append(visBtn, rawBtn);

    const quickBtns = el("div", "fr-creator-quick-actions");
    if (this.textSubMode === "visual") {
      const addLineBtn = el("button", "fr-creator-chip-btn", t("creatorAddSentence"));
      addLineBtn.type = "button";
      addLineBtn.addEventListener("click", () => {
        this.draft.lines.push(createLyricDraftLine("Yeni söz satırı", false));
        this.renderStepContent(this.bodyEl);
      });

      const addWordLineBtn = el("button", "fr-creator-chip-btn", "+ Tek Kelime Ekle");
      addWordLineBtn.type = "button";
      addWordLineBtn.addEventListener("click", () => {
        const last = this.draft.lines[this.draft.lines.length - 1];
        if (last && last.kind === "lyric") {
          last.tokens.push({ text: "kelime", start: null, end: null });
          last.text = last.tokens.map((tok) => tok.text).join(" ");
        } else {
          this.draft.lines.push(createLyricDraftLine("kelime", false));
        }
        this.renderStepContent(this.bodyEl);
      });

      const addIntBtn = el("button", "fr-creator-chip-btn", t("creatorAddInterlude"));
      addIntBtn.type = "button";
      addIntBtn.addEventListener("click", () => {
        this.draft.lines.push(createInterludeDraftLine());
        this.renderStepContent(this.bodyEl);
      });

      quickBtns.append(addLineBtn, addWordLineBtn, addIntBtn);
    } else {
      const insInterlude = el("button", "fr-creator-chip-btn", "+ #interlude");
      insInterlude.type = "button";
      insInterlude.addEventListener("click", () => {
        this.rawTextCache = (this.rawTextCache ? this.rawTextCache + "\n" : "") + "#interlude";
        this.renderStepContent(this.bodyEl);
      });

      const insBg = el("button", "fr-creator-chip-btn", "+ [Arka Vokal]");
      insBg.type = "button";
      insBg.addEventListener("click", () => {
        this.rawTextCache = (this.rawTextCache ? this.rawTextCache + "\n" : "") + "[arka vokal]";
        this.renderStepContent(this.bodyEl);
      });

      const insDuet = el("button", "fr-creator-chip-btn", "+ v2: Düet Satırı");
      insDuet.type = "button";
      insDuet.addEventListener("click", () => {
        this.rawTextCache = (this.rawTextCache ? this.rawTextCache + "\n" : "") + "v2: ";
        this.renderStepContent(this.bodyEl);
      });

      quickBtns.append(insInterlude, insBg, insDuet);
    }

    toolbar.append(subSwitch, quickBtns);
    wrap.appendChild(toolbar);

    if (this.textSubMode === "raw") {
      const ta = document.createElement("textarea");
      ta.className = "fr-creator-textarea";
      ta.placeholder = t("creatorTextPlaceholder");
      ta.value = this.rawTextCache;
      ta.addEventListener("input", () => {
        this.rawTextCache = ta.value;
        this.draft.lines = parsePlainTextToDraftLines(this.rawTextCache, this.draft.lines);
      });
      wrap.appendChild(ta);
    } else {
      const builderList = el("div", "fr-creator-builder-list");
      if (!this.draft.lines.length) {
        const emptyBox = el("div", "fr-creator-empty-box");
        emptyBox.append(
          el(
            "p",
            null,
            "Henüz satır yok. Yukarıdan '+ Cümle Ekle'ye tıklayın, 'Aktif Sözleri Çek' ile şarkının mevcut sözlerini getirin veya 'Toplu Metin' sekmesinden yapıştırın."
          )
        );
        builderList.appendChild(emptyBox);
      } else {
        this.draft.lines.forEach((line, idx) => {
          builderList.appendChild(this.buildVisualLineCard(line, idx));
        });
      }
      wrap.appendChild(builderList);
    }

    // Credit input at bottom
    const creditRow = el("div", "fr-creator-credit-row");
    const creditInput = document.createElement("input");
    creditInput.type = "text";
    creditInput.className = "fr-creator-credit-input";
    creditInput.placeholder = t("creatorCreditPlaceholder");
    creditInput.value = this.draft.credit || "";
    creditInput.addEventListener("input", () => {
      this.draft.credit = creditInput.value;
    });
    creditRow.appendChild(creditInput);
    wrap.appendChild(creditRow);

    container.appendChild(wrap);
  },

  buildVisualLineCard(line, lineIdx) {
    const card = el(
      "div",
      `fr-creator-line-card${line.kind === "interlude" ? " fr-is-interlude" : ""}${
        line.isDuet ? " fr-is-duet" : ""
      }`
    );

    const top = el("div", "fr-creator-line-card-top");
    const badge = el("span", "fr-creator-line-num", `#${lineIdx + 1}`);
    top.appendChild(badge);

    if (line.kind === "interlude") {
      top.appendChild(
        el("span", "fr-creator-interlude-title", "♪ Enstrümantal Ara (#interlude • • •)")
      );
    } else {
      const sentenceInput = document.createElement("input");
      sentenceInput.type = "text";
      sentenceInput.className = "fr-creator-line-input";
      sentenceInput.placeholder = "Cümle veya söz satırı yazın...";
      sentenceInput.value = line.text || "";
      sentenceInput.addEventListener("change", () => {
        const clean = sentenceInput.value.trim();
        line.text = clean;
        line.tokens = splitTextIntoTokens(clean, line.tokens || []);
        this.renderStepContent(this.bodyEl);
      });
      top.appendChild(sentenceInput);
    }

    const controls = el("div", "fr-creator-line-card-controls");

    const lineStartMs = line.start ?? line.tokens?.[0]?.start ?? null;
    if (lineStartMs != null) {
      const playLineBtn = el("button", "fr-creator-mini-icon-btn");
      playLineBtn.type = "button";
      playLineBtn.innerHTML = Icons.play;
      playLineBtn.title = `Bu satırdan oynat (${formatCueTime(lineStartMs)})`;
      playLineBtn.addEventListener("click", () => this.seek(lineStartMs, true));
      controls.appendChild(playLineBtn);
    }

    if (line.kind === "lyric") {
      // Duet v2 toggle
      const duetBtn = el(
        "button",
        `fr-creator-mini-btn${line.isDuet ? " fr-active-duet" : ""}`,
        t("creatorDuetToggle")
      );
      duetBtn.type = "button";
      duetBtn.title = "Sağ hizalı Düet şarkıcı (OppositeAligned / v2)";
      duetBtn.addEventListener("click", () => {
        line.isDuet = !line.isDuet;
        this.renderStepContent(this.bodyEl);
      });

      // + Word button
      const addWordBtn = el("button", "fr-creator-mini-btn", t("creatorAddWord"));
      addWordBtn.type = "button";
      addWordBtn.addEventListener("click", () => {
        line.tokens.push({ text: "kelime", start: null, end: null });
        line.text = line.tokens.map((t) => t.text).join(" ");
        this.renderStepContent(this.bodyEl);
      });

      // + Background Vocal button
      const addBgBtn = el("button", "fr-creator-mini-btn", t("creatorAddBgVocal"));
      addBgBtn.type = "button";
      addBgBtn.addEventListener("click", () => {
        line.backgrounds = line.backgrounds || [];
        line.backgrounds.push(createBackgroundDraftEntry("arka vokal"));
        this.renderStepContent(this.bodyEl);
      });

      controls.append(duetBtn, addWordBtn, addBgBtn);
    }

    // Insert lyric line below
    const insBelowBtn = el("button", "fr-creator-mini-btn", "+ Altına Satır");
    insBelowBtn.type = "button";
    insBelowBtn.title = "Bu satırın hemen altına yeni söz satırı ekle";
    insBelowBtn.addEventListener("click", () => {
      this.draft.lines.splice(lineIdx + 1, 0, createLyricDraftLine("", false));
      this.renderStepContent(this.bodyEl);
    });

    // Insert interlude below
    const insIntBelowBtn = el("button", "fr-creator-mini-btn", "+ Altına İnterlude");
    insIntBelowBtn.type = "button";
    insIntBelowBtn.title = "Bu satırın hemen altına enstrümantal ara (• • •) ekle";
    insIntBelowBtn.addEventListener("click", () => {
      this.draft.lines.splice(lineIdx + 1, 0, createInterludeDraftLine());
      this.renderStepContent(this.bodyEl);
    });

    // Move Up / Down
    const upBtn = el("button", "fr-creator-mini-icon-btn");
    upBtn.type = "button";
    upBtn.innerHTML = Icons.up;
    upBtn.disabled = lineIdx === 0;
    upBtn.addEventListener("click", () => {
      if (lineIdx <= 0) return;
      const tmp = this.draft.lines[lineIdx - 1];
      this.draft.lines[lineIdx - 1] = this.draft.lines[lineIdx];
      this.draft.lines[lineIdx] = tmp;
      this.renderStepContent(this.bodyEl);
    });

    const downBtn = el("button", "fr-creator-mini-icon-btn");
    downBtn.type = "button";
    downBtn.innerHTML = Icons.down;
    downBtn.disabled = lineIdx >= this.draft.lines.length - 1;
    downBtn.addEventListener("click", () => {
      if (lineIdx >= this.draft.lines.length - 1) return;
      const tmp = this.draft.lines[lineIdx + 1];
      this.draft.lines[lineIdx + 1] = this.draft.lines[lineIdx];
      this.draft.lines[lineIdx] = tmp;
      this.renderStepContent(this.bodyEl);
    });

    // Delete line
    const delBtn = el("button", "fr-creator-mini-icon-btn fr-danger");
    delBtn.type = "button";
    delBtn.innerHTML = Icons.trash;
    delBtn.addEventListener("click", () => {
      this.draft.lines.splice(lineIdx, 1);
      this.renderStepContent(this.bodyEl);
    });

    controls.append(insBelowBtn, insIntBelowBtn, upBtn, downBtn, delBtn);
    top.appendChild(controls);
    card.appendChild(top);

    // Individual Word Pills Editor (for Lyric lines)
    if (line.kind === "lyric" && Array.isArray(line.tokens) && line.tokens.length > 0) {
      const wordsWrap = el("div", "fr-creator-word-pills");
      line.tokens.forEach((tok, tokIdx) => {
        const pill = el("div", "fr-creator-word-pill");
        const wInput = document.createElement("input");
        wInput.type = "text";
        wInput.className = "fr-creator-word-pill-input";
        wInput.value = tok.text;
        wInput.size = Math.max(2, tok.text.length);
        wInput.addEventListener("change", () => {
          const val = wInput.value.trim();
          if (!val) {
            line.tokens.splice(tokIdx, 1);
          } else if (val.includes(" ")) {
            // If user typed space inside a word pill, automatically split it into multiple words!
            const subParts = val.split(/\s+/).filter(Boolean);
            const newToks = subParts.map((sp, sIdx) => ({
              text: sp,
              start: sIdx === 0 ? tok.start : null,
              end: sIdx === subParts.length - 1 ? tok.end : null,
            }));
            line.tokens.splice(tokIdx, 1, ...newToks);
          } else {
            tok.text = val;
          }
          line.text = line.tokens.map((t) => t.text).join(" ");
          this.renderStepContent(this.bodyEl);
        });

        const delWordBtn = el("button", "fr-creator-word-pill-del", "×");
        delWordBtn.type = "button";
        delWordBtn.title = "Kelimeyi sil";
        delWordBtn.addEventListener("click", () => {
          line.tokens.splice(tokIdx, 1);
          line.text = line.tokens.map((t) => t.text).join(" ");
          this.renderStepContent(this.bodyEl);
        });

        pill.append(wInput, delWordBtn);
        wordsWrap.appendChild(pill);
      });
      card.appendChild(wordsWrap);
    }

    // Background Vocals Editor inside the card
    if (line.kind === "lyric" && Array.isArray(line.backgrounds) && line.backgrounds.length > 0) {
      const bgContainer = el("div", "fr-creator-bg-list");
      line.backgrounds.forEach((bg, bgIdx) => {
        const bgRow = el("div", "fr-creator-bg-edit-row");
        const bgTag = el("span", "fr-creator-bg-badge", "[Arka Vokal]");
        const bgInput = document.createElement("input");
        bgInput.type = "text";
        bgInput.className = "fr-creator-bg-input";
        bgInput.value = bg.text || "";
        bgInput.placeholder = "Arka vokal sözleri...";
        bgInput.addEventListener("change", () => {
          const cleanBg = bgInput.value.trim();
          if (!cleanBg) {
            line.backgrounds.splice(bgIdx, 1);
          } else {
            bg.text = cleanBg;
            bg.tokens = splitTextIntoTokens(cleanBg, bg.tokens || []);
          }
          this.renderStepContent(this.bodyEl);
        });

        const delBg = el("button", "fr-creator-mini-btn fr-danger", "×");
        delBg.type = "button";
        delBg.addEventListener("click", () => {
          line.backgrounds.splice(bgIdx, 1);
          this.renderStepContent(this.bodyEl);
        });

        bgRow.append(bgTag, bgInput, delBg);
        bgContainer.appendChild(bgRow);
      });
      card.appendChild(bgContainer);
    }

    return card;
  },

  // ==========================================================================
  // STEP 2: Sync Studio (Block & Karaoke Word-by-Word Synchronizer)
  // ==========================================================================

  renderSyncStep(container) {
    const wrap = el("div", "fr-creator-sync-step");

    // Top Sync Control Toolbar
    const syncBar = el("div", "fr-creator-sync-toolbar");

    const cueBtn = el("button", "fr-creator-cue-btn", t("creatorSetCue"));
    cueBtn.type = "button";
    cueBtn.addEventListener("click", () => this.stampCurrentCue());

    const undoBtn = el("button", "fr-creator-btn fr-creator-btn-ghost", t("creatorUndoCue"));
    undoBtn.type = "button";
    undoBtn.addEventListener("click", () => this.undoLastCue());

    const shiftGroup = el("div", "fr-creator-shift-group");
    shiftGroup.appendChild(el("span", "fr-creator-shift-label", t("creatorShiftAll")));
    for (const delta of [-300, -100, 100, 300]) {
      const b = el(
        "button",
        "fr-creator-mini-btn",
        delta > 0 ? `+${delta}ms` : `${delta}ms`
      );
      b.type = "button";
      b.addEventListener("click", () => this.nudgeAllTimes(delta));
      shiftGroup.appendChild(b);
    }

    const rightControls = el("div", "fr-creator-sync-right");

    if (this.draft.syncMode === "word") {
      const spreadBtn = el(
        "button",
        "fr-creator-mini-btn",
        "Satır Zamanlarını Kelimelere Dağıt"
      );
      spreadBtn.type = "button";
      spreadBtn.title =
        "Satır başlangıç/bitiş zamanlarını kelimelere eşit olarak dağıtır";
      spreadBtn.addEventListener("click", () => this.autoSpreadWordTimings());
      rightControls.appendChild(spreadBtn);
    }

    const clearAllBtn = el(
      "button",
      "fr-creator-mini-btn fr-danger",
      t("creatorClearAllTimes")
    );
    clearAllBtn.type = "button";
    clearAllBtn.addEventListener("click", () => this.clearAllTimes());

    const progressBadge = el("span", "fr-creator-sync-progress");
    this.syncProgressEl = progressBadge;

    rightControls.append(clearAllBtn, progressBadge);
    syncBar.append(cueBtn, undoBtn, shiftGroup, rightControls);

    // Shortcuts hint bar
    const hintBar = el("div", "fr-creator-shortcuts-bar");
    hintBar.innerHTML = `
      <span><kbd>Space</kbd> / <kbd>Sağ Alt</kbd> Zamanla</span>
      <span><kbd>P</kbd> Oynat/Duraklat</span>
      <span><kbd>Backspace</kbd> Geri Al</span>
      <span><kbd>←</kbd><kbd>→</kbd> ±100ms (<kbd>Shift</kbd> ±300ms)</span>
      <span><kbd>↑</kbd><kbd>↓</kbd> Hedef Seç</span>
      <span><kbd>Del</kbd> Zamanı Sil</span>
    `;

    const listEl = el("div", "fr-creator-sync-list");
    this.syncListEl = listEl;

    // Quick add bar at bottom of Sync step so user can add words/lines without leaving Sync!
    const quickAddBar = el("div", "fr-creator-sync-quickadd");
    const quickInput = document.createElement("input");
    quickInput.type = "text";
    quickInput.className = "fr-creator-sync-quickinput";
    quickInput.placeholder =
      "Senkron ekranından çıkmadan yeni cümle veya kelime ekleyin (v2: düet, #interlude)...";

    const addAsLineBtn = el("button", "fr-creator-mini-btn", "+ Yeni Satır Olarak Ekle");
    addAsLineBtn.type = "button";
    addAsLineBtn.addEventListener("click", () => {
      const val = quickInput.value.trim();
      if (!val) return;
      const nowMs = Math.round(this.getAccurateProgressMs());

      if (/^#interlude$/i.test(val) || val === "♪") {
        const newLine = createInterludeDraftLine(nowMs > 0 ? nowMs : null);
        let insertIdx = this.draft.lines.length;
        if (this.activeTarget?.lineIdx != null && this.activeTarget.lineIdx < this.draft.lines.length) {
          insertIdx = this.activeTarget.lineIdx + 1;
        } else if (nowMs > 0) {
          insertIdx = this.findChronologicalInsertIndex(nowMs);
        }
        this.draft.lines.splice(insertIdx, 0, newLine);
        this.activeTarget = { type: "line", lineIdx: insertIdx, tokenIdx: 0, bgIdx: 0 };
      } else {
        const isDuet = /^v2\s*:/i.test(val);
        const clean = val.replace(/^v[12]\s*:\s*/i, "").trim();
        const newLine = createLyricDraftLine(clean, isDuet);
        let insertIdx = this.draft.lines.length;
        if (this.activeTarget?.lineIdx != null && this.activeTarget.lineIdx < this.draft.lines.length) {
          insertIdx = this.activeTarget.lineIdx + 1;
        } else if (nowMs > 0) {
          insertIdx = this.findChronologicalInsertIndex(nowMs);
        }
        this.draft.lines.splice(insertIdx, 0, newLine);
        this.activeTarget = { type: "token", lineIdx: insertIdx, tokenIdx: 0, bgIdx: 0 };
      }
      quickInput.value = "";
      this.renderSyncListOnly();
      this.scrollActiveTargetIntoView();
    });

    const appendWordBtn = el(
      "button",
      "fr-creator-mini-btn",
      "+ Seçili Satıra Kelime Ekle"
    );
    appendWordBtn.type = "button";
    appendWordBtn.addEventListener("click", () => {
      const val = quickInput.value.trim();
      if (!val) return;
      const targetLine =
        this.draft.lines[this.activeTarget?.lineIdx] ||
        this.draft.lines[this.draft.lines.length - 1];
      if (targetLine && targetLine.kind === "lyric") {
        const parts = val.split(/\s+/).filter(Boolean);
        for (const p of parts) {
          targetLine.tokens.push({ text: p, start: null, end: null });
        }
        targetLine.text = targetLine.tokens.map((t) => t.text).join(" ");
        quickInput.value = "";
        this.renderSyncListOnly();
      }
    });

    quickInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addAsLineBtn.click();
      }
    });

    quickAddBar.append(quickInput, addAsLineBtn, appendWordBtn);

    wrap.append(syncBar, hintBar, listEl, quickAddBar);
    container.appendChild(wrap);

    this.renderSyncListOnly();
  },

  renderSyncListOnly() {
    if (!this.syncListEl || !this.draft) return;
    const listEl = this.syncListEl;
    listEl.innerHTML = "";

    const lines = this.draft.lines || [];
    const syncMode = this.draft.syncMode || "word";

    // Update counter
    if (this.syncProgressEl) {
      const done = lines.filter((l) => isDraftLineComplete(l, syncMode)).length;
      this.syncProgressEl.textContent = `${done} / ${lines.length} satır hazır`;
    }

    if (!lines.length) {
      listEl.appendChild(
        el(
          "div",
          "fr-creator-empty-box",
          "Senkronize edilecek satır yok. 1. Aşamadan söz ekleyin veya aşağıdan yeni cümle yazın."
        )
      );
      return;
    }

    if (syncMode === "static") {
      listEl.appendChild(
        el(
          "div",
          "fr-creator-empty-box",
          "Statik (Zamanlamasız) mod aktif. Doğrudan 'Local DB'ye Kaydet' butonuna basarak düz metin olarak kaydedebilir veya yukarıdan 'Blok' / 'Karaoke' moduna geçebilirsiniz."
        )
      );
      return;
    }

    lines.forEach((line, lineIdx) => {
      if (line.kind === "interlude" || syncMode === "line") {
        listEl.appendChild(this.buildLineSyncRow(line, lineIdx));
      } else {
        listEl.appendChild(this.buildWordSyncRow(line, lineIdx));
      }
    });

    // End of Lyrics target row
    const endTarget = { type: "end", lineIdx: lines.length, tokenIdx: 0, bgIdx: 0 };
    const isEndActive = this.isTargetEqual(this.activeTarget, endTarget);
    const endRow = el(
      "div",
      `fr-creator-sync-row fr-creator-end-row${isEndActive ? " fr-active" : ""}${
        this.draft.endMs != null ? " fr-done" : ""
      }`
    );
    endRow.addEventListener("click", () => {
      this.activeTarget = endTarget;
      if (this.draft.endMs != null) {
        this.seek(this.draft.endMs, true);
      }
      this.renderSyncListOnly();
    });

    endRow.append(
      el("span", "fr-creator-line-num", "⚑"),
      el("span", "fr-creator-time-pill", formatCueTime(this.draft.endMs)),
      el("span", "fr-creator-row-text", "Şarkı Sözü Bitişi (End of Lyrics)")
    );
    listEl.appendChild(endRow);
  },

  buildLineSyncRow(line, lineIdx) {
    const target = { type: "line", lineIdx, tokenIdx: 0, bgIdx: 0 };
    const isActive = this.isTargetEqual(this.activeTarget, target);
    const isDone = line.start != null;

    const row = el(
      "div",
      `fr-creator-sync-row${isActive ? " fr-active" : ""}${isDone ? " fr-done" : ""}${
        line.kind === "interlude" ? " fr-is-interlude" : ""
      }${line.isDuet ? " fr-is-duet" : ""}`
    );
    row.addEventListener("click", () => {
      this.activeTarget = target;
      if (line.start != null) {
        this.seek(line.start, true);
      }
      this.renderSyncListOnly();
    });

    const num = el("span", "fr-creator-line-num", `#${lineIdx + 1}`);
    const timePill = el("span", "fr-creator-time-pill", formatCueTime(line.start));

    const textWrap = el("div", "fr-creator-row-text");
    if (line.kind === "interlude") {
      textWrap.textContent = "♪ Enstrümantal Ara (• • •)";
    } else {
      textWrap.textContent = line.text || "—";
      if (line.backgrounds?.length) {
        const bgSub = el(
          "div",
          "fr-creator-row-bgsub",
          line.backgrounds.map((b) => `(${b.text})`).join(" ")
        );
        textWrap.appendChild(bgSub);
      }
    }

    const actions = el("div", "fr-creator-row-actions");
    actions.addEventListener("click", (e) => e.stopPropagation());

    if (line.kind === "lyric") {
      const duetBtn = el(
        "button",
        `fr-creator-mini-btn${line.isDuet ? " fr-active-duet" : ""}`,
        "v2"
      );
      duetBtn.type = "button";
      duetBtn.title = "Düet (v2) hizalaması";
      duetBtn.addEventListener("click", () => {
        line.isDuet = !line.isDuet;
        this.renderSyncListOnly();
      });
      actions.appendChild(duetBtn);
    }

    // + Ara (Insert interlude directly under this line)
    const addIntBtn = el("button", "fr-creator-mini-btn", "+ Ara");
    addIntBtn.type = "button";
    addIntBtn.title = "Bu satırın hemen altına enstrümantal ara (• • •) ekle";
    addIntBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const nowMs = Math.round(this.getAccurateProgressMs());
      this.draft.lines.splice(lineIdx + 1, 0, createInterludeDraftLine(nowMs > 0 ? nowMs : null));
      this.activeTarget = { type: "line", lineIdx: lineIdx + 1, tokenIdx: 0, bgIdx: 0 };
      this.renderSyncListOnly();
      this.scrollActiveTargetIntoView();
    });
    actions.appendChild(addIntBtn);

    for (const d of [-100, 100]) {
      const b = el("button", "fr-creator-mini-btn", d > 0 ? "+100" : "-100");
      b.type = "button";
      b.disabled = line.start == null;
      b.addEventListener("click", () => this.nudgeLineTime(lineIdx, d));
      actions.appendChild(b);
    }

    const playBtn = el("button", "fr-creator-mini-icon-btn");
    playBtn.type = "button";
    playBtn.innerHTML = Icons.play;
    playBtn.disabled = line.start == null;
    playBtn.title = "Bu satırdan oynat";
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (line.start != null) this.seek(line.start, true);
    });

    const clearBtn = el("button", "fr-creator-mini-icon-btn fr-danger", "×");
    clearBtn.type = "button";
    clearBtn.disabled = line.start == null;
    clearBtn.title = "Zamanı temizle";
    clearBtn.addEventListener("click", () => {
      line.start = null;
      line.end = null;
      this.renderSyncListOnly();
    });

    if (line.kind === "interlude") {
      const delIntBtn = el("button", "fr-creator-mini-icon-btn fr-danger", "🗑");
      delIntBtn.type = "button";
      delIntBtn.title = "Bu enstrümantal arayı sil";
      delIntBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.draft.lines.splice(lineIdx, 1);
        if (this.activeTarget?.lineIdx >= this.draft.lines.length) {
          this.activeTarget = this.findFirstIncompleteTarget();
        }
        this.renderSyncListOnly();
      });
      actions.append(playBtn, clearBtn, delIntBtn);
    } else {
      actions.append(playBtn, clearBtn);
    }
    row.append(num, timePill, textWrap, actions);
    return row;
  },

  buildWordSyncRow(line, lineIdx) {
    const isLineActive = this.activeTarget?.lineIdx === lineIdx;
    const isLineComplete = isDraftLineComplete(line, "word");
    const firstStart = line.tokens[0]?.start ?? line.start ?? null;

    const card = el(
      "div",
      `fr-creator-sync-row fr-creator-word-row${isLineActive ? " fr-active" : ""}${
        isLineComplete ? " fr-done" : ""
      }${line.isDuet ? " fr-is-duet" : ""}`
    );

    // Header
    const head = el("div", "fr-creator-word-row-head");
    const leftMeta = el("div", "fr-creator-word-row-meta");
    leftMeta.style.cursor = "pointer";
    leftMeta.title = "Bu satıra git ve oynat";
    leftMeta.append(
      el("span", "fr-creator-line-num", `#${lineIdx + 1}`),
      el(
        "span",
        "fr-creator-time-pill",
        `${formatCueTime(firstStart)} → ${formatCueTime(line.end)}`
      )
    );
    leftMeta.addEventListener("click", (e) => {
      e.stopPropagation();
      this.activeTarget = { type: "token", lineIdx, tokenIdx: 0, bgIdx: 0 };
      if (firstStart != null) {
        this.seek(firstStart, true);
      }
      this.renderSyncListOnly();
    });

    const actions = el("div", "fr-creator-row-actions");
    actions.addEventListener("click", (e) => e.stopPropagation());

    const duetBtn = el(
      "button",
      `fr-creator-mini-btn${line.isDuet ? " fr-active-duet" : ""}`,
      "v2 Düet"
    );
    duetBtn.type = "button";
    duetBtn.addEventListener("click", () => {
      line.isDuet = !line.isDuet;
      this.renderSyncListOnly();
    });

    const addWordInlineBtn = el("button", "fr-creator-mini-btn", "+ Kelime");
    addWordInlineBtn.type = "button";
    addWordInlineBtn.title = "Bu satıra yeni kelime ekle";
    addWordInlineBtn.addEventListener("click", () => {
      const w = prompt("Eklenecek kelimeyi yazın:", "");
      if (w && w.trim()) {
        const parts = w.trim().split(/\s+/).filter(Boolean);
        for (const p of parts) {
          line.tokens.push({ text: p, start: null, end: null });
        }
        line.text = line.tokens.map((t) => t.text).join(" ");
        this.renderSyncListOnly();
      }
    });

    const addIntInlineBtn = el("button", "fr-creator-mini-btn", "+ Ara");
    addIntInlineBtn.type = "button";
    addIntInlineBtn.title = "Bu satırın hemen altına enstrümantal ara (• • •) ekle";
    addIntInlineBtn.addEventListener("click", () => {
      const nowMs = Math.round(this.getAccurateProgressMs());
      this.draft.lines.splice(lineIdx + 1, 0, createInterludeDraftLine(nowMs > 0 ? nowMs : null));
      this.activeTarget = { type: "line", lineIdx: lineIdx + 1, tokenIdx: 0, bgIdx: 0 };
      this.renderSyncListOnly();
      this.scrollActiveTargetIntoView();
    });

    for (const d of [-100, 100]) {
      const b = el("button", "fr-creator-mini-btn", d > 0 ? "+100ms" : "-100ms");
      b.type = "button";
      b.addEventListener("click", () => this.nudgeLineTime(lineIdx, d));
      actions.appendChild(b);
    }

    const playBtn = el("button", "fr-creator-mini-icon-btn");
    playBtn.type = "button";
    playBtn.innerHTML = Icons.play;
    playBtn.disabled = firstStart == null;
    playBtn.title = "Bu satırdan oynat";
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (firstStart != null) this.seek(firstStart, true);
    });

    const clearLineBtn = el("button", "fr-creator-mini-icon-btn fr-danger", "×");
    clearLineBtn.type = "button";
    clearLineBtn.title = "Satırdaki tüm kelime zamanlarını temizle";
    clearLineBtn.addEventListener("click", () => {
      line.start = null;
      line.end = null;
      line.tokens.forEach((t) => {
        t.start = null;
        t.end = null;
      });
      (line.backgrounds || []).forEach((b) => {
        b.start = null;
        b.end = null;
        b.tokens.forEach((bt) => {
          bt.start = null;
          bt.end = null;
        });
      });
      this.renderSyncListOnly();
    });

    actions.prepend(duetBtn, addWordInlineBtn, addIntInlineBtn);
    actions.append(playBtn, clearLineBtn);
    head.append(leftMeta, actions);
    card.appendChild(head);

    // Lead Word Tokens + Line End Flag
    const tokensWrap = el("div", "fr-creator-tokens-wrap");
    line.tokens.forEach((tok, tokIdx) => {
      const tTarget = { type: "token", lineIdx, tokenIdx: tokIdx, bgIdx: 0 };
      const isTokActive = this.isTargetEqual(this.activeTarget, tTarget);
      const isTokDone = tok.start != null;

      const chip = el(
        "button",
        `fr-creator-token${isTokActive ? " fr-active" : ""}${isTokDone ? " fr-done" : ""}`
      );
      chip.type = "button";
      chip.title = "Tıkla: Bu kelimeye git ve hedef seç | Çift tıkla: Kelimeyi düzenle veya böl";
      chip.append(
        el("span", "fr-creator-token-word", tok.text),
        el("span", "fr-creator-token-time", formatCueTime(tok.start))
      );

      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        this.activeTarget = tTarget;
        if (tok.start != null) {
          this.seek(tok.start, true);
        } else if (firstStart != null) {
          this.seek(firstStart, true);
        }
        this.renderSyncListOnly();
      });

      chip.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        const edited = prompt(
          "Kelimeyi düzenleyin (boşluk bırakırsanız iki kelimeye bölünür, boş bırakırsanız silinir):",
          tok.text
        );
        if (edited === null) return;
        const clean = edited.trim();
        if (!clean) {
          line.tokens.splice(tokIdx, 1);
        } else if (clean.includes(" ")) {
          const parts = clean.split(/\s+/).filter(Boolean);
          line.tokens.splice(
            tokIdx,
            1,
            ...parts.map((p, pIdx) => ({
              text: p,
              start: pIdx === 0 ? tok.start : null,
              end: null,
            }))
          );
        } else {
          tok.text = clean;
        }
        line.text = line.tokens.map((t) => t.text).join(" ");
        this.renderSyncListOnly();
      });

      tokensWrap.appendChild(chip);
    });

    // Line End Flag Chip
    const endTarget = {
      type: "lineEnd",
      lineIdx,
      tokenIdx: line.tokens.length,
      bgIdx: 0,
    };
    const isEndActive = this.isTargetEqual(this.activeTarget, endTarget);
    const endChip = el(
      "button",
      `fr-creator-token fr-creator-token-end${isEndActive ? " fr-active" : ""}${
        line.end != null ? " fr-done" : ""
      }`
    );
    endChip.type = "button";
    endChip.title = "Satır bitiş zamanı (isteğe bağlı)";
    const flagIcon = el("span", "fr-creator-token-flag");
    flagIcon.innerHTML = Icons.flag;
    endChip.append(
      flagIcon,
      el(
        "span",
        "fr-creator-token-time",
        line.end != null ? formatCueTime(line.end) : "Bitiş"
      )
    );
    endChip.addEventListener("click", (e) => {
      e.stopPropagation();
      this.activeTarget = endTarget;
      if (line.end != null) {
        this.seek(line.end, true);
      }
      this.renderSyncListOnly();
    });
    tokensWrap.appendChild(endChip);
    card.appendChild(tokensWrap);

    // Background Vocals Tokens
    if (Array.isArray(line.backgrounds) && line.backgrounds.length > 0) {
      line.backgrounds.forEach((bg, bgIdx) => {
        const bgRow = el("div", "fr-creator-tokens-wrap fr-creator-bg-tokens");
        bgRow.appendChild(el("span", "fr-creator-bg-tag", "Arka Vokal"));

        bg.tokens.forEach((bt, btIdx) => {
          const bgTarget = { type: "bgToken", lineIdx, tokenIdx: btIdx, bgIdx };
          const isBgActive = this.isTargetEqual(this.activeTarget, bgTarget);
          const bgChip = el(
            "button",
            `fr-creator-token fr-creator-token-bg${isBgActive ? " fr-active" : ""}${
              bt.start != null ? " fr-done" : ""
            }`
          );
          bgChip.type = "button";
          bgChip.title = "Tıkla: Bu arka vokale git ve hedef seç";
          bgChip.append(
            el("span", "fr-creator-token-word", bt.text),
            el("span", "fr-creator-token-time", formatCueTime(bt.start))
          );
          bgChip.addEventListener("click", (e) => {
            e.stopPropagation();
            this.activeTarget = bgTarget;
            if (bt.start != null) {
              this.seek(bt.start, true);
            } else if (bg.start != null) {
              this.seek(bg.start, true);
            }
            this.renderSyncListOnly();
          });
          bgRow.appendChild(bgChip);
        });

        const bgEndTarget = {
          type: "bgEnd",
          lineIdx,
          tokenIdx: bg.tokens.length,
          bgIdx,
        };
        const isBgEndActive = this.isTargetEqual(this.activeTarget, bgEndTarget);
        const bgEndChip = el(
          "button",
          `fr-creator-token fr-creator-token-end${isBgEndActive ? " fr-active" : ""}${
            bg.end != null ? " fr-done" : ""
          }`
        );
        bgEndChip.type = "button";
        const fIcon = el("span", "fr-creator-token-flag");
        fIcon.innerHTML = Icons.flag;
        bgEndChip.append(
          fIcon,
          el(
            "span",
            "fr-creator-token-time",
            bg.end != null ? formatCueTime(bg.end) : "Bitiş"
          )
        );
        bgEndChip.addEventListener("click", (e) => {
          e.stopPropagation();
          this.activeTarget = bgEndTarget;
          if (bg.end != null) {
            this.seek(bg.end, true);
          }
          this.renderSyncListOnly();
        });
        bgRow.appendChild(bgEndChip);
        card.appendChild(bgRow);
      });
    }

    return card;
  },

  // ==========================================================================
  // STEP 3: Live Interactive Preview
  // ==========================================================================

  renderPreviewStep(container) {
    const wrap = el("div", "fr-creator-preview-step");
    const compiled = compileDraftToSpicyLyrics(this.draft);
    const resolved = spicyLyricsToFullscreenLines(compiled, "FullLyrics Preview");

    if (!resolved || !resolved.lines || !resolved.lines.length) {
      wrap.appendChild(
        el(
          "div",
          "fr-creator-empty-box",
          "Önizleme için en az bir satırı zamanlayın veya 'Statik' modunu seçin."
        )
      );
      container.appendChild(wrap);
      this._previewLines = [];
      this._previewLineEls = [];
      return;
    }

    this._previewLines = resolved.lines;
    this._previewType = resolved.type;
    this._previewLineEls = [];

    const scrollBox = el("div", "fr-creator-preview-scroll");
    this.previewScrollEl = scrollBox;

    resolved.lines.forEach((line) => {
      const row = el(
        "div",
        `fr-creator-preview-line${line.isDuet ? " fr-duet-right" : ""}`
      );

      if (resolved.type !== "unsynced") {
        row.addEventListener("click", () => {
          this.seek(line.startMs || 0, true);
        });
      }

      const mainWrap = el("div", "fr-creator-preview-words");
      line._wordEls = (line.words || []).map((w) => {
        const span = el("span", "fr-creator-preview-word", w.text || "");
        if (resolved.type !== "unsynced" && w.startMs != null) {
          span.style.cursor = "pointer";
          span.addEventListener("click", (e) => {
            e.stopPropagation();
            this.seek(w.startMs, true);
          });
        }
        mainWrap.appendChild(span);
        return { ...w, el: span };
      });
      row.appendChild(mainWrap);

      if (line.bgVocal && line.bgVocal.text) {
        const bgWrap = el("div", "fr-creator-preview-bg", line.bgVocal.text);
        if (resolved.type !== "unsynced" && line.bgVocal.startMs != null) {
          bgWrap.style.cursor = "pointer";
          bgWrap.addEventListener("click", (e) => {
            e.stopPropagation();
            this.seek(line.bgVocal.startMs, true);
          });
        }
        row.appendChild(bgWrap);
      }

      scrollBox.appendChild(row);
      this._previewLineEls.push(row);
    });

    wrap.appendChild(scrollBox);
    container.appendChild(wrap);
    this.updateLivePreview(this.getAccurateProgressMs());
  },

  updateLivePreview(progressMs) {
    if (this.step !== "preview" || !this._previewLines.length) return;
    let activeIdx = -1;

    for (let i = 0; i < this._previewLines.length; i++) {
      const l = this._previewLines[i];
      const nextStart = this._previewLines[i + 1]?.startMs ?? (l.endMs || l.startMs + 4000);
      const endMs = Math.max(l.endMs || 0, nextStart);
      if (progressMs >= l.startMs && progressMs < endMs) {
        activeIdx = i;
        break;
      }
    }

    for (let i = 0; i < this._previewLineEls.length; i++) {
      const rowEl = this._previewLineEls[i];
      const l = this._previewLines[i];
      const isCurrent = i === activeIdx;
      const isPast = activeIdx > i || (activeIdx === -1 && progressMs > (l.endMs || 0));

      rowEl.classList.toggle("fr-active", isCurrent);
      rowEl.classList.toggle("fr-past", isPast);

      if (Array.isArray(l._wordEls)) {
        for (const w of l._wordEls) {
          const wDone = isPast || (isCurrent && progressMs >= (w.endMs || l.endMs || 0));
          const wActive =
            isCurrent && progressMs >= (w.startMs || 0) && progressMs < (w.endMs || l.endMs || 0);
          w.el.classList.toggle("fr-w-active", wActive);
          w.el.classList.toggle("fr-w-done", wDone);
        }
      }
    }

    if (activeIdx >= 0 && this._previewLineEls[activeIdx] && this._lastPreviewIdx !== activeIdx) {
      this._lastPreviewIdx = activeIdx;
      this._previewLineEls[activeIdx].scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }
  },

  seek(ms, autoPlay = true) {
    const safeMs = Math.max(0, Math.round(Number(ms) || 0));
    this._lastKnownProgress = safeMs;
    this._lastKnownTime = performance.now();
    this._lastKnownPlaying = SpotiKitBridge.isPlaying() || autoPlay;

    SpotiKitBridge.seek(safeMs);

    if (autoPlay && !SpotiKitBridge.isPlaying()) {
      SpotiKitBridge.togglePlay();
    }

    if (this.transportCurEl) {
      this.transportCurEl.textContent = formatTransportTime(safeMs);
    }
    const dur = SpotiKitBridge.getDuration() || this.draft?.durationMs || 1;
    if (this.transportFillEl && dur > 0) {
      const pct = Math.max(0, Math.min(100, (safeMs / dur) * 100));
      this.transportFillEl.style.width = `${pct.toFixed(2)}%`;
    }
    if (this.step === "preview") {
      this.updateLivePreview(safeMs);
    }
  },

  // ==========================================================================
  // Bottom Studio Transport Bar & High-Precision Progress Loop
  // ==========================================================================

  buildTransportFooter() {
    const footer = el("div", "fr-creator-transport");

    const playBtn = el("button", "fr-creator-play-btn");
    playBtn.type = "button";
    playBtn.innerHTML = SpotiKitBridge.isPlaying() ? Icons.pause : Icons.play;
    playBtn.addEventListener("click", () => SpotiKitBridge.togglePlay());
    this.transportPlayBtn = playBtn;

    const back5Btn = el("button", "fr-creator-mini-btn", "-3s");
    back5Btn.type = "button";
    back5Btn.addEventListener("click", () => {
      this.seek(Math.max(0, this.getAccurateProgressMs() - 3000), false);
    });

    const fwd5Btn = el("button", "fr-creator-mini-btn", "+3s");
    fwd5Btn.type = "button";
    fwd5Btn.addEventListener("click", () => {
      const dur = SpotiKitBridge.getDuration() || this.draft?.durationMs || 180000;
      this.seek(Math.min(dur, this.getAccurateProgressMs() + 3000), false);
    });

    const curTimeEl = el("span", "fr-creator-transport-time", "0:00.0");
    this.transportCurEl = curTimeEl;

    const seekWrap = el("div", "fr-creator-seek-bar");
    const seekFill = el("div", "fr-creator-seek-fill");
    this.transportFillEl = seekFill;
    seekWrap.appendChild(seekFill);

    const seekFromMouse = (e) => {
      const rect = seekWrap.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / (rect.width || 1)));
      const dur = SpotiKitBridge.getDuration() || this.draft?.durationMs || 180000;
      this.seek(Math.round(pct * dur), false);
    };

    seekWrap.addEventListener("mousedown", (e) => {
      this._dragAbortController?.abort();
      const ac = new AbortController();
      this._dragAbortController = ac;
      this._scrubbing = true;
      seekFromMouse(e);
      const onMove = (ev) => seekFromMouse(ev);
      const onUp = () => {
        this._scrubbing = false;
        ac.abort();
        if (this._dragAbortController === ac) {
          this._dragAbortController = null;
        }
      };
      window.addEventListener("mousemove", onMove, { signal: ac.signal });
      window.addEventListener("mouseup", onUp, { signal: ac.signal });
    });

    const durTimeEl = el(
      "span",
      "fr-creator-transport-time",
      formatTransportTime(SpotiKitBridge.getDuration() || this.draft?.durationMs || 0)
    );
    this.transportDurEl = durTimeEl;

    footer.append(playBtn, back5Btn, fwd5Btn, curTimeEl, seekWrap, durTimeEl);
    return footer;
  },

  getAccurateProgressMs() {
    const raw = SpotiKitBridge.getProgress();
    const playing = SpotiKitBridge.isPlaying();
    const now = performance.now();

    if (raw !== this._lastKnownProgress || playing !== this._lastKnownPlaying) {
      this._lastKnownProgress = raw;
      this._lastKnownTime = now;
      this._lastKnownPlaying = playing;
    }

    const dur = SpotiKitBridge.getDuration() || this.draft?.durationMs || Infinity;
    return playing
      ? Math.min(dur, this._lastKnownProgress + (now - this._lastKnownTime))
      : raw;
  },

  startTransportLoop() {
    this.stopTransportLoop();
    const tick = () => {
      if (!this.isOpen) return;
      const progress = this.getAccurateProgressMs();
      const dur = SpotiKitBridge.getDuration() || this.draft?.durationMs || 1;
      const playing = SpotiKitBridge.isPlaying();

      if (this.transportPlayBtn && this._wasTransportPlaying !== playing) {
        this._wasTransportPlaying = playing;
        this.transportPlayBtn.innerHTML = playing ? Icons.pause : Icons.play;
      }

      if (this.transportCurEl) {
        this.transportCurEl.textContent = formatTransportTime(progress);
      }
      if (this.transportDurEl) {
        this.transportDurEl.textContent = formatTransportTime(dur);
      }
      if (this.transportFillEl) {
        const pct = Math.max(0, Math.min(100, (progress / dur) * 100));
        this.transportFillEl.style.width = `${pct.toFixed(2)}%`;
      }

      if (this.step === "preview") {
        this.updateLivePreview(progress);
      }

      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  },

  stopTransportLoop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
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
