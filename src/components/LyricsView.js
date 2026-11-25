/**
 * Synchronized & Waterfall ("Şelale") Scrolling Lyrics View component.
 * - Uses per-line GPU translate3d(--fr-cascade-y) with top-to-bottom staggered delays
 *   so lines ripple like a true waterfall instead of moving as a rigid scrollTop block.
 * - Words flow from top (-10px) -> center (0px) -> bottom (+8px) with a 180deg top-to-bottom
 *   light sweep (staggered per word on line-synced tracks, and exact millisecond-synced on word-synced tracks).
 * - Configurable via Settings ("waterfallMode": "normal" | "intense" | "off").
 */
import { el } from "../utils/dom.js";
import { t } from "../utils/i18n.js";
import { Settings } from "../utils/settings.js";
import { LyricsService } from "../services/LyricsService.js";
import { SpotiKitBridge } from "../services/SpotiKitBridge.js";
import { AudioMoodEngine } from "../services/AudioMoodEngine.js";
import {
  buildCharTimeline,
  canAnimateLetters,
  clamp01,
  computeWordWaveParams,
  computeWrappedRowRatios,
  normalizeWordTimings,
} from "../utils/letterTiming.js";

export const LyricsView = {
  panel: null,
  scrollEl: null,
  resumeBtn: null,
  instrPanel: null,
  providerBadge: null,
  providerPrefixEl: null,
  providerNameEl: null,
  providerTagEl: null,

  lines: [],
  lineEls: [],
  activeIndex: -1,
  syncType: "none",
  providerSource: "",
  hasLyrics: true,
  _isLoading: false,

  userScrolling: false,
  userScrollTimer: null,
  requestId: 0,
  _currentTrackUri: null,
  _lastUnsyncedTime: null,
  _providerTimer: null,
  _shownStartBadgeForUri: null,
  _resizeObserver: null,
  _revealRafId: null,
  _cascadeRafId: null,

  // Per-line cascade offset state
  _cascadeY: 0,
  _manualOffsetY: 0,
  _unsyncedScrollPos: 0,
  _currentTrackDurationMs: 180000,

  build() {
    this.panel = el("div", "fr-lyrics-panel");
    this.scrollEl = el("div", "fr-lyrics-scroll");

    // "Provided by: <Provider>" floating badge (visible for first 3s)
    this.providerBadge = el("div", "fr-provider-badge");
    const dot = el("span", "fr-provider-dot");
    this.providerPrefixEl = el("span", "fr-provider-prefix", `${t("providedBy")}:`);
    this.providerNameEl = el("span", "fr-provider-name", "");
    this.providerTagEl = el("span", "fr-provider-tag", "");
    this.providerBadge.append(dot, this.providerPrefixEl, this.providerNameEl, this.providerTagEl);

    // Instrumental / no-lyrics state
    this.instrPanel = el("div", "fr-instrumental");
    const bars = el("div", "fr-instrumental-bars");
    for (let i = 0; i < 7; i++) {
      bars.appendChild(el("div", "fr-instrumental-bar"));
    }
    this.instrPanel.append(bars, el("div", "fr-instrumental-label", t("instrumental")));

    // Resume sync button when user manually scrolls
    this.resumeBtn = el("button", "fr-resume-sync", t("resumeSync"));
    this.resumeBtn.addEventListener("click", () => {
      this.userScrolling = false;
      this._manualOffsetY = 0;
      this.scrollEl.classList.remove("fr-user-scrolling");
      this.resumeBtn.classList.remove("fr-show");
      if (this.syncType === "synced" || this.syncType === "word-synced") {
        this.applyCascadePosition(false);
      }
    });

    this.panel.append(this.providerBadge, this.scrollEl, this.instrPanel, this.resumeBtn);

    this.scrollEl.addEventListener(
      "wheel",
      (e) => {
        if (this.syncType === "synced" || this.syncType === "word-synced") {
          e.preventDefault();
          this.onUserWheel(e.deltaY);
        } else {
          this.onUserScroll();
        }
      },
      { passive: false }
    );
    this.scrollEl.addEventListener("touchmove", () => this.onUserScroll(), { passive: true });

    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver = new ResizeObserver(() => {
        if (this.syncType === "synced" && this.lines.length) {
          this._measureSyncedRows();
        }
        if (!this.userScrolling && (this.syncType === "synced" || this.syncType === "word-synced")) {
          this.applyCascadePosition(true);
        }
      });
      this._resizeObserver.observe(this.scrollEl);
    }

    this.applyWaterfallMode();
    return this.panel;
  },

  applyWaterfallMode() {
    if (!this.scrollEl) return;
    const mode = Settings.get("waterfallMode") || "normal";
    this.scrollEl.setAttribute("data-waterfall", mode);
    if (this.lines.length && (this.syncType === "synced" || this.syncType === "word-synced")) {
      this.applyCascadePosition(false);
    }
  },

  showProviderBadge(durationMs = 3000) {
    if (this._isLoading || !this.providerBadge || !this.providerSource || !this.hasLyrics) return;
    if (this.providerPrefixEl) {
      this.providerPrefixEl.textContent = `${t("providedBy")}:`;
    }
    this.providerNameEl.textContent = this.providerSource;

    const tagText =
      this.syncType === "word-synced"
        ? t("badgeWordSync")
        : this.syncType === "synced"
        ? t("badgeSynced")
        : t("badgeUnsynced");
    this.providerTagEl.textContent = tagText;

    this.providerBadge.classList.add("fr-show");
    clearTimeout(this._providerTimer);
    this._providerTimer = setTimeout(() => {
      if (this.providerBadge) {
        this.providerBadge.classList.remove("fr-show");
      }
    }, durationMs);
  },

  onUserWheel(deltaY) {
    this.userScrolling = true;
    this.scrollEl.classList.add("fr-user-scrolling");
    this.resumeBtn.classList.add("fr-show");

    const panelH = this.scrollEl.clientHeight || 500;
    const lastEl = this.lineEls[this.lineEls.length - 1];
    const totalH = lastEl ? lastEl.offsetTop + lastEl.offsetHeight : panelH;
    const minOffset = -Math.max(0, totalH - panelH * 0.45);
    const maxOffset = panelH * 0.25;

    const currentTotal = this._cascadeY + this._manualOffsetY;
    const nextTotal = Math.max(minOffset, Math.min(maxOffset, currentTotal - deltaY * 0.85));
    this._manualOffsetY = nextTotal - this._cascadeY;

    for (let i = 0; i < this.lineEls.length; i++) {
      this.lineEls[i].style.setProperty("--fr-cascade-y", `${nextTotal.toFixed(1)}px`);
    }

    clearTimeout(this.userScrollTimer);
    this.userScrollTimer = setTimeout(() => {
      this.userScrolling = false;
      this._manualOffsetY = 0;
      if (!this.scrollEl || !this.resumeBtn) return;
      this.scrollEl.classList.remove("fr-user-scrolling");
      this.resumeBtn.classList.remove("fr-show");
      this.applyCascadePosition(false);
    }, 6000);
  },

  onUserScroll() {
    this.userScrolling = true;
    this.resumeBtn?.classList.add("fr-show");
    clearTimeout(this.userScrollTimer);
    this.userScrollTimer = setTimeout(() => {
      this.userScrolling = false;
      this.resumeBtn?.classList.remove("fr-show");
    }, 8000);
  },

  async loadForTrack(track, app, force = false) {
    if (!track || !this.scrollEl) return;
    if (!force && this._currentTrackUri === track.uri && this.lines.length > 0) {
      this.revealLyrics();
      if (app?.open) this.showProviderBadge(3000);
      if (app?.applyLayoutSettings) app.applyLayoutSettings();
      return;
    }

    this._currentTrackUri = track.uri;
    this._currentTrackDurationMs = Number(track.metadata?.duration) || 180000;
    this._shownStartBadgeForUri = null;
    const myRequest = ++this.requestId;

    // Immediately clear stale previous-track provider/sync state before awaiting resolve
    this._isLoading = true;
    this.providerSource = "";
    this.syncType = "none";
    this.lines = [];
    this.lineEls = [];
    this.activeIndex = -1;
    this.hasLyrics = true;
    if (this.providerBadge) this.providerBadge.classList.remove("fr-show");
    if (this.instrPanel) this.instrPanel.classList.remove("fr-show");
    if (app?.applyLayoutSettings) app.applyLayoutSettings();

    this.scrollEl.innerHTML = "";
    this.scrollEl.classList.remove("fr-ready", "fr-user-scrolling", "fr-unsynced", "fr-mode-word", "fr-mode-line", "fr-letter-mode");
    this.scrollEl.scrollTop = 0;
    this._cascadeY = 0;
    this._manualOffsetY = 0;
    this._unsyncedScrollPos = 0;
    this.userScrolling = false;
    this._lastUnsyncedTime = null;

    const data = await LyricsService.resolve(track);
    if (myRequest !== this.requestId || !this.scrollEl || SpotiKitBridge.isStopped()) return;
    this._isLoading = false;

    if (!data || !data.lines || !data.lines.length) {
      this.hasLyrics = false;
      this._currentTrackUri = null;
      if (this.instrPanel) this.instrPanel.classList.add("fr-show");
      if (app?.applyLayoutSettings) app.applyLayoutSettings();
      return;
    }

    this.hasLyrics = true;
    this.providerSource = data.source || "Spotify";
    this.lines = Array.isArray(data.lines) ? data.lines : [];
    this.syncType = data.type;

    if (this.syncType === "synced" || this.syncType === "word-synced") {
      this.lines.sort((a, b) => (Number(a.startMs) || 0) - (Number(b.startMs) || 0));
    }

    AudioMoodEngine.updateLyricsMetrics(this.lines, this.syncType, this._currentTrackDurationMs);

    if (this.instrPanel) this.instrPanel.classList.remove("fr-show");
    if (app?.applyLayoutSettings) app.applyLayoutSettings();

    this.applyWaterfallMode();
    this._renderLines();
    this.revealLyrics();
    if (app?.open) {
      this.showProviderBadge(3000);
      this._shownStartBadgeForUri = track.uri;
    }

    this.update(SpotiKitBridge.getProgress(), true);
  },

  setLetterByLetter() {
    if (!this.scrollEl) return;
    const useLetterMode = this.syncType === "word-synced" && Settings.get("letterByLetter") !== false;
    this.scrollEl.classList.toggle("fr-letter-mode", useLetterMode);
    if (!this.lines.length || this.syncType !== "word-synced") return;
    this.userScrolling = false;
    this._manualOffsetY = 0;
    this.scrollEl.classList.remove("fr-user-scrolling");
    this.resumeBtn?.classList.remove("fr-show");
    this._renderLines();
    this.scrollEl.classList.add("fr-ready");
    this.update(SpotiKitBridge.getProgress(), true);
  },

  _renderLines() {
    if (!this.scrollEl) return;
    this.scrollEl.innerHTML = "";
    this.scrollEl.classList.remove("fr-unsynced", "fr-mode-word", "fr-mode-line", "fr-letter-mode");
    this.lineEls = [];
    this.activeIndex = -1;

    const useLetterMode = this.syncType === "word-synced" && Settings.get("letterByLetter") !== false;

    if (this.syncType === "unsynced") {
      this.scrollEl.classList.add("fr-unsynced");
    } else if (this.syncType === "word-synced") {
      this.scrollEl.classList.add("fr-mode-word");
      if (useLetterMode) this.scrollEl.classList.add("fr-letter-mode");
    } else {
      this.scrollEl.classList.add("fr-mode-line");
    }

    const isSyncedAny = this.syncType === "word-synced" || this.syncType === "synced";
    const enableBgDuet = Settings.get("bgVocalsDuet") !== false;
    let prevVocalEndMs = 0;

    this.lines.forEach((line, lineIdx) => {
      line._interlude = null;
      line._sentenceEl = null;
      line._bgSentenceEl = null;

      let fullText = "";
      if (!Array.isArray(line.words) || !line.words.length) {
        fullText = String(line.text || "");
        const parts = fullText.trim().split(/\s+/).filter(Boolean);
        line.words = parts.map((p, wIdx) => ({
          text: wIdx < parts.length - 1 ? p + " " : p,
          startMs: line.startMs,
        }));
      } else {
        fullText = line.words.map((w) => (typeof w === "string" ? w : w.text || "")).join("");
      }

      // If BgVocals & Duet view is disabled, merge bgVocal inline into fullText / words
      if (!enableBgDuet && line.bgVocal?.text) {
        fullText = `${fullText.trim()} ${line.bgVocal.text}`.trim();
      }

      const textClean = fullText.trim().toLowerCase();
      const isMusicSymbol =
        textClean === "♪" ||
        textClean === "🎵" ||
        textClean === "🎶" ||
        textClean === "instrumental" ||
        textClean === "[instrumental]" ||
        Boolean(line._isMusic);
      line._isMusic = isMusicSymbol;

      let extraCls = "";
      if (enableBgDuet) {
        if (line.isDuet) extraCls += " fr-duet-right";
        if (line.isBgOnly) extraCls += " fr-bg-only-line";
      }
      if (isMusicSymbol) {
        extraCls += " fr-is-music";
      }
      line._extraCls = extraCls;

      const lineEl = el("div", `fr-lyric-line fr-future fr-far${extraCls}`);

      // Compute full-bar duration so the waterfall flows continuously right until the end of the bar/sentence
      const lineStart = Number(line.startMs) || 0;
      const nextLine = this.lines[lineIdx + 1];
      const nextStart = nextLine ? Number(nextLine.startMs) : lineStart + 3600;
      const rawBarMs = Math.max(600, nextStart - lineStart);
      const wordCount = Math.max(1, line.words.length);

      // For normal vocal bars (< 5.5s), span 98% of the full bar so the sweep finishes right as the sentence ends.
      // Only cap when an instrumental interlude (>= 5.5s gap) follows the line.
      const maxVocalBarMs = Math.max(3400, wordCount * 1250 + 1000);
      const barSpanMs = rawBarMs >= 5500 ? Math.min(rawBarMs * 0.88, maxVocalBarMs) : rawBarMs * 0.98;
      line._barSpanMs = barSpanMs;

      // Check if an Apple Music Interlude (• • •) precedes this line (intro >= 3s or instrumental gap >= 5s)
      if (isSyncedAny && !isMusicSymbol) {
        const gapDuration = lineStart - prevVocalEndMs;
        const minGap = lineIdx === 0 ? 3000 : 5000;
        if (gapDuration >= minGap) {
          const dotsWrap = el("div", "fr-interlude-dots");
          const d1 = el("span", "fr-interlude-dot");
          const d2 = el("span", "fr-interlude-dot");
          const d3 = el("span", "fr-interlude-dot");
          dotsWrap.append(d1, d2, d3);
          lineEl.appendChild(dotsWrap);
          line._interlude = {
            wrap: dotsWrap,
            dots: [d1, d2, d3],
            startMs: prevVocalEndMs,
            endMs: lineStart,
          };
        }
      }

      prevVocalEndMs = isMusicSymbol ? nextStart : lineStart + barSpanMs + 350;

      if (isMusicSymbol) {
        lineEl.classList.add("fr-is-music");
        const dotsWrap = el("div", "fr-interlude-dots fr-inline-music-dots");
        const d1 = el("span", "fr-interlude-dot");
        const d2 = el("span", "fr-interlude-dot");
        const d3 = el("span", "fr-interlude-dot");
        dotsWrap.append(d1, d2, d3);
        lineEl.appendChild(dotsWrap);
        line.words = [];
        line._interlude = {
          wrap: dotsWrap,
          dots: [d1, d2, d3],
          startMs: lineStart,
          endMs: nextStart,
          isInline: true,
        };
      } else if (this.syncType === "synced") {
        // Line-synced mode: store clean raw text so _measureSyncedRows() can split wrapped visual lines
        const cleanSentence = fullText.trim();
        const sentenceEl = el("span", "fr-lyric-sentence", cleanSentence);
        lineEl.appendChild(sentenceEl);
        line._sentenceEl = sentenceEl;
        line._sentenceText = cleanSentence;
        line._sentenceRows = null;

        if (enableBgDuet && line.bgVocal?.text) {
          const bgWrap = el("div", "fr-bg-vocal-sub");
          const bgSentenceEl = el("span", "fr-lyric-sentence fr-bg-sentence", line.bgVocal.text);
          bgWrap.appendChild(bgSentenceEl);
          lineEl.appendChild(bgWrap);
          line._bgSentenceEl = bgSentenceEl;
        }
      } else {
        // Word-synced or unsynced mode: render individual word spans
        const buildWordSpans = (wordsArr, containerEl, startBaseMs, spanDurMs, isBg = false) => {
          const normalizedWords = normalizeWordTimings(wordsArr, startBaseMs, spanDurMs);

          return normalizedWords.map((wObj, wIdx) => {
            const wordText = wObj.text != null ? String(wObj.text) : "";

            let wordEl;
            wObj.chars = null;
            if (useLetterMode && canAnimateLetters(wordText)) {
              const timeline = buildCharTimeline(wObj);
              if (timeline.visible.length > 0) {
                wordEl = el("span", isBg ? "fr-lyric-word fr-bg-word fr-word-letters" : "fr-lyric-word fr-word-letters");
                wordEl.setAttribute("aria-label", wordText);
                const frag = document.createDocumentFragment();
                const charRecords = [];
                for (let cIdx = 0; cIdx < timeline.entries.length; cIdx++) {
                  const entry = timeline.entries[cIdx];
                  if (entry.isSpace) {
                    frag.appendChild(document.createTextNode(entry.text));
                  } else {
                    const charEl = el("span", "fr-char", entry.text);
                    frag.appendChild(charEl);
                    charRecords.push({
                      el: charEl,
                      fillStartMs: entry.fillStartMs,
                      fillEndMs: entry.fillEndMs,
                      rawStart: entry.rawStart,
                      rawEnd: entry.rawEnd,
                      normCenter: entry.normCenter,
                      _state: 0,
                      _pct: "",
                      _lift: "",
                      _scale: "",
                      _glow: "",
                    });
                  }
                }
                wordEl.appendChild(frag);
                wObj.chars = charRecords;
              }
            }
            if (!wordEl) {
              wordEl = el("span", isBg ? "fr-lyric-word fr-bg-word" : "fr-lyric-word", wordText);
            }
            wordEl.style.setProperty("--w-idx", String(wIdx));
            wObj._wordState = 0;
            wObj.el = wordEl;
            containerEl.appendChild(wordEl);
            return wObj;
          });
        };

        line.words = buildWordSpans(line.words, lineEl, lineStart, barSpanMs, false);

        if (enableBgDuet && line.bgVocal && Array.isArray(line.bgVocal.words) && line.bgVocal.words.length) {
          const bgWrap = el("div", "fr-bg-vocal-sub");
          const bgStart = line.bgVocal.startMs ?? lineStart + Math.round(barSpanMs * 0.4);
          const bgEnd = line.bgVocal.endMs ?? lineStart + barSpanMs;
          const bgSpan = Math.max(400, bgEnd - bgStart);
          line.bgVocal.words = buildWordSpans(line.bgVocal.words, bgWrap, bgStart, bgSpan, true);
          lineEl.appendChild(bgWrap);
        }
      }

      if (isSyncedAny) {
        lineEl.classList.add("fr-synced");
        lineEl.addEventListener("click", () => {
          this.userScrolling = false;
          this._manualOffsetY = 0;
          this.scrollEl.classList.remove("fr-user-scrolling");
          this.resumeBtn.classList.remove("fr-show");
          SpotiKitBridge.seek(line.startMs);
        });
      }

      this.scrollEl.appendChild(lineEl);
      this.lineEls.push(lineEl);
    });
  },

  revealLyrics() {
    if (this._revealRafId) {
      cancelAnimationFrame(this._revealRafId);
      this._revealRafId = null;
    }
    this._revealRafId = requestAnimationFrame(() => {
      this._revealRafId = null;
      if (this.syncType === "synced" && this.lines.length) {
        this._measureSyncedRows();
      }
      if (this.scrollEl) this.scrollEl.classList.add("fr-ready");
    });
  },

  /**
   * Splits wrapped line-synced sentences into per-visual-row `.fr-s-row` spans
   * so Row 1 fills left-to-right completely before wrapped Row 2 begins.
   */
  _measureSyncedRows() {
    if (this.syncType !== "synced" || !this.lines.length) return;
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const sentenceEl = line?._sentenceEl;
      const rawText = line?._sentenceText;
      if (!sentenceEl || !rawText) continue;

      const words = rawText.split(/\s+/).filter(Boolean);
      if (words.length < 2) {
        line._sentenceRows = null;
        continue;
      }

      // Temporarily render inline word probes to detect exact visual line wraps
      sentenceEl.classList.remove("fr-sentence-multirow");
      sentenceEl.innerHTML = "";
      const probeFrag = document.createDocumentFragment();
      const probes = [];
      for (let w = 0; w < words.length; w++) {
        const span = document.createElement("span");
        span.textContent = w < words.length - 1 ? words[w] + " " : words[w];
        probeFrag.appendChild(span);
        probes.push(span);
      }
      sentenceEl.appendChild(probeFrag);

      const rowsText = [];
      let currentTop = null;
      let currentRowWords = [];
      let hasLayoutMetrics = false;

      for (let w = 0; w < probes.length; w++) {
        const rect = typeof probes[w].getBoundingClientRect === "function"
          ? probes[w].getBoundingClientRect()
          : null;
        const top = rect && rect.height > 0 ? rect.top : probes[w].offsetTop;
        if ((rect && rect.height > 0) || probes[w].offsetHeight > 0) {
          hasLayoutMetrics = true;
        }
        if (currentTop === null) {
          currentTop = top;
          currentRowWords.push(words[w]);
        } else if (Math.abs(top - currentTop) > 4) {
          rowsText.push(currentRowWords.join(" "));
          currentRowWords = [words[w]];
          currentTop = top;
        } else {
          currentRowWords.push(words[w]);
        }
      }
      if (currentRowWords.length) {
        rowsText.push(currentRowWords.join(" "));
      }

      if (!hasLayoutMetrics || rowsText.length <= 1) {
        sentenceEl.textContent = rawText;
        line._sentenceRows = null;
        continue;
      }

      const ratios = computeWrappedRowRatios(rowsText);
      sentenceEl.innerHTML = "";
      sentenceEl.classList.add("fr-sentence-multirow");
      const rowFrag = document.createDocumentFragment();
      const rowEntries = ratios.map((r) => {
        const rowEl = el("span", "fr-s-row", r.text);
        rowFrag.appendChild(rowEl);
        return {
          el: rowEl,
          startRatio: r.startRatio,
          endRatio: r.endRatio,
        };
      });
      sentenceEl.appendChild(rowFrag);
      line._sentenceRows = rowEntries;
    }
  },

  getActiveLineSnapshot() {
    if (!this.hasLyrics || !this.lines.length) return null;
    const idx = this.activeIndex;
    const getLineText = (line) => {
      if (!line) return "";
      if (line._sentenceText) return line._sentenceText;
      if (Array.isArray(line.words) && line.words.length) {
        return line.words.map((w) => (typeof w === "string" ? w : w?.text || "")).join("").trim();
      }
      return String(line.text || "").trim();
    };
    const activeLine = idx >= 0 ? this.lines[idx] : null;
    const nextLine = this.lines[idx + 1] || null;
    return {
      syncType: this.syncType,
      activeIndex: idx,
      activeText: getLineText(activeLine),
      nextText: getLineText(nextLine),
      isMusic: Boolean(activeLine?._isMusic),
    };
  },

  _clearLineWordState(lineIdx, asPast = false) {
    if (lineIdx < 0 || lineIdx >= this.lines.length) return;
    const line = this.lines[lineIdx];
    if (!line) return;
    if (line._sentenceEl) {
      line._sentenceEl.style.removeProperty("--bar-pct");
      line._sentenceEl.style.removeProperty("--bar-flow-y");
    }
    if (Array.isArray(line._sentenceRows)) {
      for (let r = 0; r < line._sentenceRows.length; r++) {
        line._sentenceRows[r].el?.style.removeProperty("--row-pct");
      }
    }
    if (line._bgSentenceEl) {
      line._bgSentenceEl.style.removeProperty("--bar-pct");
      line._bgSentenceEl.style.removeProperty("--bar-flow-y");
    }
    const clearChars = (chars) => {
      if (!Array.isArray(chars)) return;
      for (let j = 0; j < chars.length; j++) {
        const c = chars[j];
        if (!c || !c.el) continue;
        c.el.classList.remove("fr-c-active", "fr-c-done");
        c.el.style.removeProperty("--c-pct");
        c.el.style.removeProperty("--c-lift");
        c.el.style.removeProperty("--c-scale");
        c.el.style.removeProperty("--c-glow");
        c._state = 0;
        c._pct = "";
        c._lift = "";
        c._scale = "";
        c._glow = "";
      }
    };
    const clearWords = (arr) => {
      if (!Array.isArray(arr)) return;
      for (let k = 0; k < arr.length; k++) {
        const w = arr[k];
        if (!w || !w.el) continue;
        w.el.classList.remove("fr-w-active", "fr-w-done");
        w.el.style.removeProperty("--w-pct");
        w.el.style.removeProperty("--w-lift");
        w.el.style.removeProperty("--w-scale");
        w._wordState = 0;
        clearChars(w.chars);
        if (asPast) w.el.classList.add("fr-w-done");
      }
    };
    clearWords(line.words);
    if (line.bgVocal?.words) clearWords(line.bgVocal.words);
  },

  update(progressMs, instant = false) {
    if (!this.lines.length || !this.scrollEl) return;

    // Show "Provided by" badge during the first 3s of a song
    if (
      progressMs >= 0 &&
      progressMs <= 3000 &&
      this._currentTrackUri &&
      this._shownStartBadgeForUri !== this._currentTrackUri
    ) {
      this._shownStartBadgeForUri = this._currentTrackUri;
      this.showProviderBadge(3000);
    }

    // --- 1. Unsynced Lyrics Auto-Scroll (Slow, Calm Reading Pace) ---
    if (this.syncType !== "synced" && this.syncType !== "word-synced") {
      const mode = Settings.get("unsyncedScrollMode") || "track";
      if (mode === "off") return;

      const maxScroll = Math.max(0, this.scrollEl.scrollHeight - this.scrollEl.clientHeight);
      if (maxScroll <= 0) return;

      if (!this.userScrolling) {
        if (mode === "track") {
          const bridgeDur = SpotiKitBridge.getDuration();
          const duration = bridgeDur > 15000 ? bridgeDur : this._currentTrackDurationMs || 180000;
          const rawPct = Math.max(0, Math.min(1, progressMs / duration));
          // Wait until 12% into the track before starting to scroll down, finishing around 90%
          const effectivePct = Math.max(0, Math.min(1, (rawPct - 0.12) / 0.78));
          const targetTop = effectivePct * maxScroll;
          const diff = targetTop - this._unsyncedScrollPos;
          if (Math.abs(diff) > 0.2) {
            this._unsyncedScrollPos += diff * 0.018;
            this.scrollEl.scrollTop = this._unsyncedScrollPos;
          }
        } else {
          const now = performance.now();
          const dt = this._lastUnsyncedTime ? Math.min(0.1, (now - this._lastUnsyncedTime) / 1000) : 0.016;
          this._lastUnsyncedTime = now;

          if (SpotiKitBridge.isPlaying()) {
            // Natural slow reading speeds in px/sec (slow: 3.5, normal: 6.0, fast: 10.5)
            const speed = mode === "slow" ? 3.5 : mode === "fast" ? 10.5 : 6.0;
            this._unsyncedScrollPos = Math.min(maxScroll, this._unsyncedScrollPos + speed * dt);
            this.scrollEl.scrollTop = this._unsyncedScrollPos;
          }
        }
      } else {
        this._unsyncedScrollPos = this.scrollEl.scrollTop;
      }
      return;
    }

    // --- 2. Find Active Synced Line ---
    let idx = -1;
    if (this.lines[0] && progressMs >= this.lines[0].startMs) {
      idx = this.activeIndex < 0 ? 0 : this.activeIndex;
      while (idx + 1 < this.lines.length && this.lines[idx + 1].startMs <= progressMs) idx++;
      while (idx > 0 && this.lines[idx].startMs > progressMs) idx--;
    }

    // --- 3. Line Transition with Top-to-Bottom Waterfall Cascade ---
    if (idx !== this.activeIndex || instant) {
      const prevIdx = this.activeIndex;
      if (prevIdx >= 0 && prevIdx !== idx) {
        this._clearLineWordState(prevIdx, idx > prevIdx);
      }
      this.activeIndex = idx;

      for (let i = 0; i < this.lineEls.length; i++) {
        const lineEl = this.lineEls[i];
        const dist = idx < 0 ? i + 1 : i - idx;
        const absDist = Math.abs(dist);
        const extraCls = this.lines[i]?._extraCls || "";

        let cls = `fr-lyric-line fr-synced${extraCls}`;
        if (i === idx) {
          cls += " fr-active";
        } else if (dist < 0) {
          cls += " fr-past";
          if (absDist === 1) cls += " fr-near-1";
          else if (absDist === 2) cls += " fr-near-2";
          else cls += " fr-far";
        } else {
          cls += " fr-future";
          if (absDist === 1) cls += " fr-near-1";
          else if (absDist === 2) cls += " fr-near-2";
          else cls += " fr-far";
        }

        if (lineEl.className !== cls) {
          lineEl.className = cls;
        }
      }

      if (!this.userScrolling) {
        this.applyCascadePosition(instant);
      }
    }

    // --- 3b. Apple Music Interlude Dots (• • •) Countdown Animation ---
    const showDots = Settings.get("interludeDots") !== false;
    const checkIndices = [this.activeIndex, this.activeIndex + 1];
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const inter = line?._interlude;
      if (!inter) continue;

      const isRelevant = showDots && checkIndices.includes(i);
      const inWindow = isRelevant && progressMs >= inter.startMs && progressMs < inter.endMs;

      if (inWindow) {
        inter.wrap.classList.add("fr-interlude-active");
        const total = Math.max(200, inter.endMs - inter.startMs);
        const p = Math.max(0, Math.min(1, (progressMs - inter.startMs) / total));

        for (let d = 0; d < 3; d++) {
          const dotProgress = Math.max(0, Math.min(1, (p - d / 3) * 3));
          const pulse = Math.sin(progressMs / 280 + d * 0.9) * 1.8;
          const scale = 0.85 + dotProgress * 0.38;
          const opacity = 0.25 + dotProgress * 0.75;
          inter.dots[d].style.opacity = opacity.toFixed(2);
          inter.dots[d].style.transform = `translate3d(0, ${pulse.toFixed(1)}px, 0) scale(${scale.toFixed(2)})`;
        }
      } else if (inter.wrap.classList.contains("fr-interlude-active")) {
        inter.wrap.classList.remove("fr-interlude-active");
      }
    }

    // --- 4a. Full-Sentence Sweep & Waterfall Flow (on line-synced 'synced' tracks — NOT word-by-word) ---
    if (this.syncType === "synced" && this.activeIndex >= 0) {
      const activeLine = this.lines[this.activeIndex];
      const wfMode = Settings.get("waterfallMode") || "normal";
      const dropPx = wfMode === "intense" ? -12 : wfMode === "normal" ? -8 : 0;

      const sentenceEl = activeLine?._sentenceEl;
      if (sentenceEl) {
        const lineStart = Number(activeLine.startMs) || 0;
        const barSpan = Math.max(600, Number(activeLine._barSpanMs) || 2500);
        const rawProgress = Math.max(0, Math.min(1, (progressMs - lineStart) / barSpan));
        const flowY = dropPx * (1 - rawProgress);

        sentenceEl.style.setProperty("--bar-flow-y", `${flowY.toFixed(2)}px`);

        if (Array.isArray(activeLine._sentenceRows) && activeLine._sentenceRows.length > 1) {
          for (let r = 0; r < activeLine._sentenceRows.length; r++) {
            const row = activeLine._sentenceRows[r];
            let rowPct;
            if (wfMode === "off") {
              rowPct = 118;
            } else if (rawProgress <= row.startRatio) {
              rowPct = 0;
            } else if (rawProgress >= row.endRatio) {
              rowPct = 118;
            } else {
              const span = Math.max(0.001, row.endRatio - row.startRatio);
              rowPct = ((rawProgress - row.startRatio) / span) * 118;
            }
            row.el.style.setProperty("--row-pct", `${rowPct.toFixed(1)}%`);
          }
        } else {
          const sweptPct = wfMode === "off" ? 118 : rawProgress * 118;
          sentenceEl.style.setProperty("--bar-pct", `${sweptPct.toFixed(1)}%`);
        }
      }

      const bgSentenceEl = activeLine?._bgSentenceEl;
      if (bgSentenceEl && activeLine.bgVocal) {
        const bgStart = Number(activeLine.bgVocal.startMs) || Number(activeLine.startMs) || 0;
        const bgEnd = Number(activeLine.bgVocal.endMs) || bgStart + 1800;
        const bgSpan = Math.max(400, bgEnd - bgStart);
        const bgProg = Math.max(0, Math.min(1, (progressMs - bgStart) / bgSpan));
        const bgPct = wfMode === "off" ? 118 : bgProg * 118;
        const bgFlowY = dropPx * 0.65 * (1 - bgProg);

        bgSentenceEl.style.setProperty("--bar-pct", `${bgPct.toFixed(1)}%`);
        bgSentenceEl.style.setProperty("--bar-flow-y", `${bgFlowY.toFixed(2)}px`);
      }
    }

    // --- 4b. 60fps Word-by-Word & Letter-by-Letter Waterfall / Karaoke Sweep (ONLY on word-synced tracks) ---
    if (this.syncType === "word-synced" && this.activeIndex >= 0) {
      const activeLine = this.lines[this.activeIndex];
      if (activeLine) {
        const wfMode = Settings.get("waterfallMode") || "normal";
        const useLetterMode = Settings.get("letterByLetter") !== false;
        const dropPx = wfMode === "intense" ? -12 : wfMode === "normal" ? -8 : 0;

        const resetWordChars = (chars, isDone) => {
          if (!Array.isArray(chars)) return;
          const targetState = isDone ? 2 : 0;
          for (let j = 0; j < chars.length; j++) {
            const c = chars[j];
            if (!c || !c.el) continue;
            if (c._state !== targetState || c._pct || c._lift || c._scale || c._glow) {
              c.el.classList.remove("fr-c-active", "fr-c-done");
              if (isDone) c.el.classList.add("fr-c-done");
              if (c._pct) c.el.style.removeProperty("--c-pct");
              if (c._lift) c.el.style.removeProperty("--c-lift");
              if (c._scale) c.el.style.removeProperty("--c-scale");
              if (c._glow) c.el.style.removeProperty("--c-glow");
              c._state = targetState;
              c._pct = "";
              c._lift = "";
              c._scale = "";
              c._glow = "";
            }
          }
        };

        const animateWordList = (words, dropScale = 1) => {
          if (!Array.isArray(words)) return;
          for (let k = 0; k < words.length; k++) {
            const w = words[k];
            const elWord = w?.el;
            if (!elWord) continue;

            const wStart = w.startMs ?? activeLine.startMs ?? 0;
            const wEnd = w.endMs ?? wStart + 350;
            const hasChars = useLetterMode && Array.isArray(w.chars) && w.chars.length > 0;

            if (progressMs <= wStart) {
              if (elWord.classList.contains("fr-w-active") || elWord.classList.contains("fr-w-done")) {
                elWord.classList.remove("fr-w-active", "fr-w-done");
                elWord.style.removeProperty("--w-pct");
                elWord.style.removeProperty("--w-lift");
                elWord.style.removeProperty("--w-scale");
                w._wordState = 0;
              }
              if (hasChars) resetWordChars(w.chars, false);
            } else if (progressMs >= wEnd) {
              if (!elWord.classList.contains("fr-w-done")) {
                elWord.classList.remove("fr-w-active");
                elWord.classList.add("fr-w-done");
                if (hasChars) {
                  elWord.style.removeProperty("--w-pct");
                  elWord.style.removeProperty("--w-scale");
                } else {
                  elWord.style.setProperty("--w-pct", "118%");
                  elWord.style.setProperty("--w-scale", "1");
                }
                elWord.style.setProperty("--w-lift", "0px");
                w._wordState = 2;
              }
              if (hasChars) resetWordChars(w.chars, true);
            } else {
              if (!elWord.classList.contains("fr-w-active")) {
                elWord.classList.remove("fr-w-done");
                elWord.classList.add("fr-w-active");
                w._wordState = 1;
              }
              const dur = Math.max(40, wEnd - wStart);
              const ratio = clamp01((progressMs - wStart) / dur);
              const lift = dropPx * dropScale * 0.5 * (1 + Math.cos(ratio * Math.PI));

              elWord.style.setProperty("--w-lift", `${lift.toFixed(2)}px`);

              if (hasChars) {
                const wave = computeWordWaveParams(w.chars, progressMs, wStart, wEnd, {
                  wfMode,
                  dropScale,
                });
                for (let j = 0; j < w.chars.length; j++) {
                  const c = w.chars[j];
                  const elChar = c.el;
                  const cSpan = Math.max(20, c.fillEndMs - c.fillStartMs);
                  const cRatio = clamp01((progressMs - c.fillStartMs) / cSpan);

                  const dist = (wave.focalNorm - c.normCenter) / wave.sigma;
                  const bell = Math.exp(-(dist * dist) * 1.45);
                  const cLiftVal = wave.maxLiftPx * bell;
                  const cScaleVal = 1 + wave.maxScaleDelta * bell;
                  const cGlowVal = clamp01(bell * wave.glowEnv * 1.15);

                  const liftStr = Math.abs(cLiftVal) < 0.02 ? "0px" : `${cLiftVal.toFixed(2)}px`;
                  const scaleStr = Math.abs(cScaleVal - 1) < 0.002 ? "1" : cScaleVal.toFixed(3);
                  const glowStr = cGlowVal < 0.02 ? "0" : cGlowVal.toFixed(2);

                  if (c._lift !== liftStr) {
                    c._lift = liftStr;
                    elChar.style.setProperty("--c-lift", liftStr);
                  }
                  if (c._scale !== scaleStr) {
                    c._scale = scaleStr;
                    elChar.style.setProperty("--c-scale", scaleStr);
                  }
                  if (c._glow !== glowStr) {
                    c._glow = glowStr;
                    elChar.style.setProperty("--c-glow", glowStr);
                  }

                  if (cRatio <= 0) {
                    if (c._state !== 0) {
                      elChar.classList.remove("fr-c-active", "fr-c-done");
                      c._state = 0;
                    }
                    if (c._pct) {
                      c._pct = "";
                      elChar.style.removeProperty("--c-pct");
                    }
                  } else if (cRatio >= 1) {
                    if (c._state !== 2) {
                      elChar.classList.remove("fr-c-active");
                      elChar.classList.add("fr-c-done");
                      c._state = 2;
                    }
                    if (c._pct) {
                      c._pct = "";
                      elChar.style.removeProperty("--c-pct");
                    }
                  } else {
                    if (c._state !== 1) {
                      elChar.classList.remove("fr-c-done");
                      elChar.classList.add("fr-c-active");
                      c._state = 1;
                    }
                    const pctStr = `${(-18 + cRatio * 136).toFixed(1)}%`;
                    if (c._pct !== pctStr) {
                      c._pct = pctStr;
                      elChar.style.setProperty("--c-pct", pctStr);
                    }
                  }
                }
              } else {
                const swept = -16 + ratio * 132;
                const scale = 1 + 0.03 * dropScale * Math.sin(ratio * Math.PI);
                elWord.style.setProperty("--w-pct", `${swept.toFixed(1)}%`);
                elWord.style.setProperty("--w-scale", `${scale.toFixed(3)}`);
              }
            }
          }
        };

        animateWordList(activeLine.words, 1.0);
        if (activeLine.bgVocal?.words) {
          animateWordList(activeLine.bgVocal.words, 0.7);
        }
      }
    }
  },

  /**
   * Positions all lyric lines using per-line GPU translate3d(--fr-cascade-y)
   * with a liquid spring stagger (--fr-stagger) so bar-to-bar transitions flow smoothly.
   */
  applyCascadePosition(instant = false) {
    if (!this.scrollEl || !this.lineEls.length) return;
    const targetIdx = this.activeIndex >= 0 ? this.activeIndex : 0;
    const activeEl = this.lineEls[targetIdx];
    if (!activeEl) return;

    const wfMode = Settings.get("waterfallMode") || "normal";
    const lineStepMs = wfMode === "intense" ? 65 : wfMode === "normal" ? 45 : 0;

    const panelHeight = this.scrollEl.clientHeight || 600;
    const isPortrait =
      (typeof window !== "undefined" &&
        (window.innerHeight > window.innerWidth * 0.8 || window.innerWidth <= 900));
    const anchorY = isPortrait ? Math.min(panelHeight * 0.16, 130) : panelHeight * 0.34;
    // Do NOT clamp with Math.min(0, ...) so even the first 3 lines of a song glide smoothly bar-to-bar
    this._cascadeY = -(activeEl.offsetTop - anchorY + activeEl.offsetHeight / 2);

    if (instant) {
      this.scrollEl.classList.add("fr-no-transition");
    }

    // Exiting line (targetIdx - 1) moves at 0ms, new active line (targetIdx) at ~30ms,
    // and upcoming lines below ripple downward in a smooth wave.
    const waveStartIdx = Math.max(0, targetIdx - 1);

    for (let i = 0; i < this.lineEls.length; i++) {
      const lineEl = this.lineEls[i];
      let staggerMs = 0;
      if (!instant && lineStepMs > 0 && i >= waveStartIdx && i <= targetIdx + 8) {
        staggerMs = (i - waveStartIdx) * lineStepMs;
      }
      lineEl.style.setProperty("--fr-stagger", `${staggerMs}ms`);
      lineEl.style.setProperty("--fr-cascade-y", `${this._cascadeY.toFixed(1)}px`);
    }

    if (instant) {
      if (this._cascadeRafId) {
        cancelAnimationFrame(this._cascadeRafId);
        this._cascadeRafId = null;
      }
      this._cascadeRafId = requestAnimationFrame(() => {
        this._cascadeRafId = null;
        if (this.scrollEl) this.scrollEl.classList.remove("fr-no-transition");
      });
    }
  },

  scrollActiveIntoView(instant = false) {
    this.applyCascadePosition(instant);
  },

  destroy() {
    this.requestId++;
    clearTimeout(this._providerTimer);
    this._providerTimer = null;
    clearTimeout(this.userScrollTimer);
    this.userScrollTimer = null;

    if (this._revealRafId) {
      cancelAnimationFrame(this._revealRafId);
      this._revealRafId = null;
    }
    if (this._cascadeRafId) {
      cancelAnimationFrame(this._cascadeRafId);
      this._cascadeRafId = null;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    this.lines = [];
    this.lineEls = [];
    this.activeIndex = -1;
    this.syncType = "none";
    this.providerSource = "";
    this.hasLyrics = true;
    this._isLoading = false;
    this.userScrolling = false;
    this._currentTrackUri = null;
    this._lastUnsyncedTime = null;
    this._shownStartBadgeForUri = null;
    this._cascadeY = 0;
    this._manualOffsetY = 0;
    this._unsyncedScrollPos = 0;

    this.panel?.remove();
    this.panel = null;
    this.scrollEl = null;
    this.resumeBtn = null;
    this.instrPanel = null;
    this.providerBadge = null;
    this.providerPrefixEl = null;
    this.providerNameEl = null;
    this.providerTagEl = null;
  },
};
