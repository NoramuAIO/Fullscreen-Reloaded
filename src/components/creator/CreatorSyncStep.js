/**
 * FullLyrics Creator Step 2: Block & Karaoke word-by-word sync studio.
 */
import { el } from "../../utils/dom.js";
import { Icons } from "../../utils/icons.js";
import { t } from "../../utils/i18n.js";
import {
  isDraftLineComplete,
  createLyricDraftLine,
  createInterludeDraftLine,
} from "../../services/CustomSyncStorage.js";
import { formatCueTime } from "./CreatorUtils.js";

export const CreatorSyncStep = {
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
};
