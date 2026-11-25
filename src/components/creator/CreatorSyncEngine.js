/**
 * FullLyrics Creator actions (pull online, auto-spread, save/delete) and cue stamping engine.
 */
import { t } from "../../utils/i18n.js";
import { SpotiKitBridge } from "../../services/SpotiKitBridge.js";
import { LyricsService } from "../../services/LyricsService.js";
import { LyricsView } from "../LyricsView.js";
import {
  saveCustomSync,
  deleteCustomSync,
  extractTrackId,
  normalizeTrackUri,
  compileDraftToSpicyLyrics,
  fullscreenLinesToDraft,
  importFileToDraft,
  serializeDraftLinesToText,
} from "../../services/CustomSyncStorage.js";
import { formatCueTime } from "./CreatorUtils.js";

export const CreatorSyncEngine = {
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
};
