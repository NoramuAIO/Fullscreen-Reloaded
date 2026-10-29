/**
 * Liquid Glass Bottom Dock component (Playback Controls, Progress, Volume, Queue).
 */
import { el, iconBtn } from "../utils/dom.js";
import { Icons } from "../utils/icons.js";
import { formatMs } from "../utils/formatters.js";
import { SpicetifyBridge } from "../services/SpicetifyBridge.js";

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

  _lastKnownProgress: 0,
  _lastKnownTime: 0,
  _lastKnownPlaying: false,
  _lastKnownVolume: -1,
  _lastKnownCurSec: -1,
  _lastKnownDurSec: -1,
  _wasPlaying: null,
  _wasShuffle: null,
  _wasRepeat: null,

  build(app) {
    this.root = el("div", "fr-bottom-bar");

    // --- Left: Playback Controls ---
    const left = el("div", "fr-controls-left");
    this.shuffleBtn = iconBtn(Icons.shuffle, () => SpicetifyBridge.toggleShuffle());
    const prevBtn = iconBtn(Icons.prev, () => SpicetifyBridge.back());
    this.playBtn = iconBtn(Icons.play, () => SpicetifyBridge.togglePlay(), "fr-btn-play");
    const nextBtn = iconBtn(Icons.next, () => SpicetifyBridge.next());
    this.repeatBtn = iconBtn(Icons.repeat, () => SpicetifyBridge.toggleRepeat());
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

    progBar.addEventListener("mousedown", (e) => {
      this.seeking = true;
      this.seekFromEvent(e, progBar);
      const move = (ev) => this.seekFromEvent(ev, progBar);
      const up = () => {
        this.seeking = false;
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    });

    // --- Right: Volume & Queue ---
    const right = el("div", "fr-controls-right");
    const volRow = el("div", "fr-volume-row");
    const volIcon = iconBtn(Icons.volume, () => SpicetifyBridge.toggleMute());
    const volBar = el("div", "fr-volume-bar");
    this.volFill = el("div", "fr-volume-fill");
    this.volHandle = el("div", "fr-volume-handle");
    volBar.append(this.volFill, this.volHandle);
    volRow.append(volIcon, volBar);

    volBar.addEventListener("mousedown", (e) => {
      this.volSeeking = true;
      this.volFromEvent(e, volBar);
      const move = (ev) => this.volFromEvent(ev, volBar);
      const up = () => {
        this.volSeeking = false;
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    });

    volRow.addEventListener("wheel", (e) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      let vol = SpicetifyBridge.getVolume() + dir * 0.05;
      vol = Math.max(0, Math.min(1, vol));
      SpicetifyBridge.setVolume(vol);

      this._lastKnownVolume = vol;
      const volPct = vol * 100;
      this.volFill.style.width = volPct + "%";
      this.volHandle.style.left = volPct + "%";
    });

    const queueBtn = iconBtn(Icons.queue, () => {
      app.close();
      SpicetifyBridge.openQueue();
    });
    right.append(volRow, queueBtn);

    this.root.append(left, center, right);
    return this.root;
  },

  seekFromEvent(e, bar) {
    const rect = bar.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const duration = SpicetifyBridge.getDuration();
    SpicetifyBridge.seek(pct * duration);
  },

  volFromEvent(e, bar) {
    const rect = bar.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    SpicetifyBridge.setVolume(pct);

    this._lastKnownVolume = pct;
    const volPct = pct * 100;
    this.volFill.style.width = volPct + "%";
    this.volHandle.style.left = volPct + "%";
  },

  tick() {
    // Progress Sync
    const rawProgress = SpicetifyBridge.getProgress();
    const duration = SpicetifyBridge.getDuration();
    const isPlaying = SpicetifyBridge.isPlaying();
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
    const shuffle = SpicetifyBridge.getShuffle();
    if (this._wasShuffle !== shuffle) {
      this._wasShuffle = shuffle;
      this.shuffleBtn.classList.toggle("fr-active", shuffle);
    }

    // Repeat state sync
    const repeat = SpicetifyBridge.getRepeat();
    if (this._wasRepeat !== repeat) {
      this._wasRepeat = repeat;
      this.repeatBtn.classList.toggle("fr-active", repeat);
    }

    // Volume state sync
    if (!this.volSeeking) {
      const vol = SpicetifyBridge.getMute() ? 0 : SpicetifyBridge.getVolume();
      if (this._lastKnownVolume !== vol) {
        this._lastKnownVolume = vol;
        const volPct = vol * 100;
        this.volFill.style.width = volPct + "%";
        this.volHandle.style.left = volPct + "%";
      }
    }

    return progress;
  },
};
