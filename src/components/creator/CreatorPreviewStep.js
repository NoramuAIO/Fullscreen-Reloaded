/**
 * FullLyrics Creator Step 3: Live interactive preview and transport footer.
 */
import { el } from "../../utils/dom.js";
import { Icons } from "../../utils/icons.js";
import { SpotiKitBridge } from "../../services/SpotiKitBridge.js";
import {
  compileDraftToSpicyLyrics,
  spicyLyricsToFullscreenLines,
} from "../../services/CustomSyncStorage.js";
import { formatTransportTime } from "./CreatorUtils.js";

export const CreatorPreviewStep = {
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
};
