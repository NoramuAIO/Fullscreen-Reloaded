/**
 * Liquid Glass Bottom Dock component (Playback Controls, Progress, Volume, Queue).
 */
import { el, iconBtn } from "../utils/dom.js";
import { Icons } from "../utils/icons.js";
import { formatMs } from "../utils/formatters.js";
import { SpotiKitBridge } from "../services/SpotiKitBridge.js";

export const BottomDock = {
  root: null,
  progressFill: null,
  progressHandle: null,
  timeCur: null,
  timeDur: null,
  playBtn: null,
  shuffleBtn: null,
  repeatBtn: null,
  volFill: null,
  volHandle: null,
  seeking: false,
  volSeeking: false,
  _dragAbortController: null,

  _lastKnownProgress: 0,
  _lastKnownTime: 0,
  _lastKnownPlaying: false,
  _lastKnownVolume: -1,
  _lastKnownCurSec: -1,
  _lastKnownDurSec: -1,
  _wasPlaying: null,
  _wasShuffle: null,
  _wasRepeat: null,

  _resetSyncCache() {
    this._lastKnownProgress = 0;
    this._lastKnownTime = 0;
    this._lastKnownPlaying = false;
    this._lastKnownVolume = -1;
    this._lastKnownCurSec = -1;
    this._lastKnownDurSec = -1;
    this._wasPlaying = null;
    this._wasShuffle = null;
    this._wasRepeat = null;
  },

  _bindDrag(bar, flagKey, onMoveSample) {
    bar.addEventListener("mousedown", (e) => {
      this._dragAbortController?.abort();
      this.seeking = false;
      this.volSeeking = false;
      const ac = new AbortController();
      this._dragAbortController = ac;

      this[flagKey] = true;
      onMoveSample(e, bar);

      const move = (ev) => onMoveSample(ev, bar);
      const up = () => {
        this[flagKey] = false;
        ac.abort();
        if (this._dragAbortController === ac) {
          this._dragAbortController = null;
        }
      };

      window.addEventListener("mousemove", move, { signal: ac.signal });
      window.addEventListener("mouseup", up, { signal: ac.signal });
    });
  },

  build(app) {
    this._resetSyncCache();
    this.seeking = false;
    this.volSeeking = false;
    this.root = el("div", "fr-bottom-bar");

    // --- Left: Playback Controls ---
    const left = el("div", "fr-controls-left");
    this.shuffleBtn = iconBtn(Icons.shuffle, () => SpotiKitBridge.toggleShuffle());
    const prevBtn = iconBtn(Icons.prev, () => SpotiKitBridge.back());
    this.playBtn = iconBtn(Icons.play, () => SpotiKitBridge.togglePlay(), "fr-btn-play");
    const nextBtn = iconBtn(Icons.next, () => SpotiKitBridge.next());
    this.repeatBtn = iconBtn(Icons.repeat, () => SpotiKitBridge.toggleRepeat());
    left.append(this.shuffleBtn, prevBtn, this.playBtn, nextBtn, this.repeatBtn);

    // --- Center: Progress ---
    const center = el("div", "fr-controls-center");
    this.timeCur = el("span", null, "0:00");
    const progBar = el("div", "fr-progress-bar");
    this.progressFill = el("div", "fr-progress-fill");
    this.progressHandle = el("div", "fr-progress-handle");
    progBar.append(this.progressFill, this.progressHandle);
    this.timeDur = el("span", null, "0:00");
    center.append(this.timeCur, progBar, this.timeDur);

    this._bindDrag(progBar, "seeking", (ev, bar) => this.seekFromEvent(ev, bar));

    // --- Right: Volume & Queue ---
    const right = el("div", "fr-controls-right");
    const volRow = el("div", "fr-volume-row");
    const volIcon = iconBtn(Icons.volume, () => SpotiKitBridge.toggleMute());
    const volBar = el("div", "fr-volume-bar");
    this.volFill = el("div", "fr-volume-fill");
    this.volHandle = el("div", "fr-volume-handle");
    volBar.append(this.volFill, this.volHandle);
    volRow.append(volIcon, volBar);

    this._bindDrag(volBar, "volSeeking", (ev, bar) => this.volFromEvent(ev, bar));

    volRow.addEventListener("wheel", (e) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      let vol = SpotiKitBridge.getVolume() + dir * 0.05;
      vol = Math.max(0, Math.min(1, vol));
      SpotiKitBridge.setVolume(vol);

      this._lastKnownVolume = vol;
      const volPct = vol * 100;
      this.volFill.style.width = volPct + "%";
      this.volHandle.style.left = volPct + "%";
    });

    const queueBtn = iconBtn(Icons.queue, () => {
      app.close();
      SpotiKitBridge.openQueue();
    });
    right.append(volRow, queueBtn);

    this.root.append(left, center, right);
    return this.root;
  },

  seekFromEvent(e, bar) {
    const rect = bar.getBoundingClientRect();
    const width = rect.width || 1;
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / width));
    const duration = SpotiKitBridge.getDuration();
    SpotiKitBridge.seek(pct * duration);
    const pctStr = pct * 100 + "%";
    if (this.progressFill) this.progressFill.style.width = pctStr;
    if (this.progressHandle) this.progressHandle.style.left = pctStr;
  },

  volFromEvent(e, bar) {
    const rect = bar.getBoundingClientRect();
    const width = rect.width || 1;
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / width));
    SpotiKitBridge.setVolume(pct);

    this._lastKnownVolume = pct;
    const volPct = pct * 100;
    this.volFill.style.width = volPct + "%";
    this.volHandle.style.left = volPct + "%";
  },

  tick() {
    if (!this.root) return 0;

    // Progress Sync
    const rawProgress = SpotiKitBridge.getProgress();
    const duration = SpotiKitBridge.getDuration();
    const isPlaying = SpotiKitBridge.isPlaying();
    const now = Date.now();

    if (rawProgress !== this._lastKnownProgress || isPlaying !== this._lastKnownPlaying) {
      this._lastKnownProgress = rawProgress;
      this._lastKnownTime = now;
      this._lastKnownPlaying = isPlaying;
    }

    const progress = isPlaying
      ? Math.min(duration || Infinity, this._lastKnownProgress + (now - this._lastKnownTime))
      : rawProgress;

    if (!this.seeking) {
      const pct = duration ? (progress / duration) * 100 : 0;
      this.progressFill.style.width = pct + "%";
      this.progressHandle.style.left = pct + "%";

      const curSec = Math.floor(progress / 1000);
      if (this._lastKnownCurSec !== curSec) {
        this._lastKnownCurSec = curSec;
        this.timeCur.textContent = formatMs(progress);
      }

      const durSec = Math.floor(duration / 1000);
      if (this._lastKnownDurSec !== durSec) {
        this._lastKnownDurSec = durSec;
        this.timeDur.textContent = formatMs(duration);
      }
    }

    // Play/Pause button sync
    if (this._wasPlaying !== isPlaying) {
      this._wasPlaying = isPlaying;
      this.playBtn.innerHTML = isPlaying ? Icons.pause : Icons.play;
    }

    // Shuffle state sync
    const shuffle = SpotiKitBridge.getShuffle();
    if (this._wasShuffle !== shuffle) {
      this._wasShuffle = shuffle;
      this.shuffleBtn.classList.toggle("fr-active", shuffle);
    }

    // Repeat state sync
    const repeatMode = SpotiKitBridge.getRepeatMode();
    const repeat = SpotiKitBridge.getRepeat();
    if (this._wasRepeat !== repeatMode) {
      this._wasRepeat = repeatMode;
      this.repeatBtn.classList.toggle("fr-active", repeat);
      this.repeatBtn.setAttribute("data-repeat", repeatMode);
      this.repeatBtn.title = `Repeat: ${repeatMode}`;
    }

    // Volume state sync
    if (!this.volSeeking) {
      const vol = SpotiKitBridge.getMute() ? 0 : SpotiKitBridge.getVolume();
      if (this._lastKnownVolume !== vol) {
        this._lastKnownVolume = vol;
        const volPct = vol * 100;
        this.volFill.style.width = volPct + "%";
        this.volHandle.style.left = volPct + "%";
      }
    }

    return progress;
  },

  destroy() {
    this._dragAbortController?.abort();
    this._dragAbortController = null;
    this.seeking = false;
    this.volSeeking = false;
    this._resetSyncCache();
    this.root?.remove();
    this.root = null;
    this.progressFill = null;
    this.progressHandle = null;
    this.timeCur = null;
    this.timeDur = null;
    this.playBtn = null;
    this.shuffleBtn = null;
    this.repeatBtn = null;
    this.volFill = null;
    this.volHandle = null;
  },
};
