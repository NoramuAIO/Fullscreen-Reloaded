/**
 * Hover-only Apple Music Liquid Cover Overlay Player (Switch to New Player).
 * - Appears smoothly when hovering the album cover (or dragging), hides immediately on leave
 *   so 100% of the artwork stays unobstructed during playback.
 * - Clean borderless bottom fade scrim + transport & scrubber, with vertical liquid volume slider
 *   tucked on the right edge of the artwork.
 */
import { el, iconBtn } from "../utils/dom.js";
import { Icons } from "../utils/icons.js";
import { formatMs } from "../utils/formatters.js";
import { SpotiKitBridge } from "../services/SpotiKitBridge.js";

export const CoverPlayer = {
  root: null,
  progressFill: null,
  timeCur: null,
  timeRem: null,
  playBtn: null,
  shuffleBtn: null,
  repeatBtn: null,
  volFill: null,
  seeking: false,
  volSeeking: false,
  _dragAbortController: null,
  _lastCurSec: -1,
  _lastRemSec: -1,
  _wasPlaying: null,
  _wasShuffle: null,
  _wasRepeat: null,
  _lastVolume: -1,

  _resetCache() {
    this._lastCurSec = -1;
    this._lastRemSec = -1;
    this._wasPlaying = null;
    this._wasShuffle = null;
    this._wasRepeat = null;
    this._lastVolume = -1;
  },

  _bindDrag(bar, flagKey, onSample) {
    bar.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      this._dragAbortController?.abort();
      this.seeking = false;
      this.volSeeking = false;
      const ac = new AbortController();
      this._dragAbortController = ac;
      this[flagKey] = true;
      this.root?.parentElement?.classList.add("fr-cp-dragging");
      onSample(e, bar);

      const move = (ev) => onSample(ev, bar);
      const up = () => {
        this[flagKey] = false;
        this.root?.parentElement?.classList.remove("fr-cp-dragging");
        ac.abort();
        if (this._dragAbortController === ac) this._dragAbortController = null;
      };
      window.addEventListener("mousemove", move, { signal: ac.signal });
      window.addEventListener("mouseup", up, { signal: ac.signal });
    });
  },

  build() {
    this._resetCache();
    this.seeking = false;
    this.volSeeking = false;

    const root = el("div", "fr-cover-player");

    // 1. Right-Edge Vertical Liquid Volume Rail (Apple Control Center style)
    const volRail = el("div", "fr-cp-vol-vertical");
    const volTrack = el("div", "fr-cp-vol-track");
    this.volFill = el("div", "fr-cp-vol-fill");
    volTrack.appendChild(this.volFill);
    const volIcon = iconBtn(Icons.volume, () => SpotiKitBridge.toggleMute(), "fr-cp-btn fr-cp-btn-xs");
    volRail.append(volTrack, volIcon);

    this._bindDrag(volTrack, "volSeeking", (ev, bar) => {
      const rect = bar.getBoundingClientRect();
      const height = rect.height || 1;
      const pct = Math.min(1, Math.max(0, (rect.bottom - ev.clientY) / height));
      SpotiKitBridge.setVolume(pct);
      this._lastVolume = pct;
      if (this.volFill) this.volFill.style.height = `${(pct * 100).toFixed(1)}%`;
    });

    volRail.addEventListener("wheel", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dir = e.deltaY < 0 ? 1 : -1;
      const vol = Math.max(0, Math.min(1, SpotiKitBridge.getVolume() + dir * 0.05));
      SpotiKitBridge.setVolume(vol);
      this._lastVolume = vol;
      if (this.volFill) this.volFill.style.height = `${(vol * 100).toFixed(1)}%`;
    });

    // 2. Bottom Borderless Scrim HUD (Transport + Slim Scrubber)
    const bottomHud = el("div", "fr-cp-bottom");

    const transport = el("div", "fr-cp-transport");
    this.shuffleBtn = iconBtn(Icons.shuffle, () => SpotiKitBridge.toggleShuffle(), "fr-cp-btn fr-cp-btn-sm");
    const prevBtn = iconBtn(Icons.prev, () => SpotiKitBridge.back(), "fr-cp-btn");
    this.playBtn = iconBtn(Icons.play, () => SpotiKitBridge.togglePlay(), "fr-cp-btn fr-cp-btn-play");
    const nextBtn = iconBtn(Icons.next, () => SpotiKitBridge.next(), "fr-cp-btn");
    this.repeatBtn = iconBtn(Icons.repeat, () => SpotiKitBridge.toggleRepeat(), "fr-cp-btn fr-cp-btn-sm");
    transport.append(this.shuffleBtn, prevBtn, this.playBtn, nextBtn, this.repeatBtn);

    const scrubWrap = el("div", "fr-cp-scrubber-wrap");
    const progBar = el("div", "fr-cp-progress-bar");
    this.progressFill = el("div", "fr-cp-progress-fill");
    progBar.appendChild(this.progressFill);

    const timesRow = el("div", "fr-cp-times");
    this.timeCur = el("span", "fr-cp-time-cur", "0:00");
    this.timeRem = el("span", "fr-cp-time-rem", "-0:00");
    timesRow.append(this.timeCur, this.timeRem);
    scrubWrap.append(progBar, timesRow);

    this._bindDrag(progBar, "seeking", (ev, bar) => {
      const rect = bar.getBoundingClientRect();
      const width = rect.width || 1;
      const pct = Math.min(1, Math.max(0, (ev.clientX - rect.left) / width));
      const dur = SpotiKitBridge.getDuration();
      SpotiKitBridge.seek(pct * dur);
      if (this.progressFill) this.progressFill.style.width = `${(pct * 100).toFixed(2)}%`;
    });

    bottomHud.append(transport, scrubWrap);
    root.append(volRail, bottomHud);
    this.root = root;
    return root;
  },

  tick(progressMs, durationMs) {
    if (!this.root) return;
    const isPlaying = SpotiKitBridge.isPlaying();
    const dur = Math.max(0, Number(durationMs) || 0);
    const prog = Math.max(0, Math.min(dur || progressMs, Number(progressMs) || 0));

    if (!this.seeking && dur > 0 && this.progressFill) {
      const pct = Math.max(0, Math.min(100, (prog / dur) * 100));
      this.progressFill.style.width = `${pct.toFixed(2)}%`;
    }

    const curSec = Math.floor(prog / 1000);
    if (curSec !== this._lastCurSec && this.timeCur) {
      this._lastCurSec = curSec;
      this.timeCur.textContent = formatMs(prog);
    }

    const remMs = Math.max(0, dur - prog);
    const remSec = Math.floor(remMs / 1000);
    if (remSec !== this._lastRemSec && this.timeRem) {
      this._lastRemSec = remSec;
      this.timeRem.textContent = `-${formatMs(remMs)}`;
    }

    if (isPlaying !== this._wasPlaying && this.playBtn) {
      this._wasPlaying = isPlaying;
      this.playBtn.innerHTML = isPlaying ? Icons.pause : Icons.play;
    }

    const shuf = SpotiKitBridge.getShuffle();
    if (shuf !== this._wasShuffle && this.shuffleBtn) {
      this._wasShuffle = shuf;
      this.shuffleBtn.classList.toggle("fr-active", shuf);
    }

    const rep = SpotiKitBridge.getRepeat();
    if (rep !== this._wasRepeat && this.repeatBtn) {
      this._wasRepeat = rep;
      this.repeatBtn.classList.toggle("fr-active", rep !== "off");
      this.repeatBtn.innerHTML = rep === "track" ? Icons.repeatOne : Icons.repeat;
    }

    if (!this.volSeeking && this.volFill) {
      const vol = SpotiKitBridge.getMute() ? 0 : SpotiKitBridge.getVolume();
      if (Math.abs(vol - this._lastVolume) > 0.005) {
        this._lastVolume = vol;
        this.volFill.style.height = `${(vol * 100).toFixed(1)}%`;
      }
    }
  },

  destroy() {
    this._dragAbortController?.abort();
    this._dragAbortController = null;
    this.root?.parentElement?.classList.remove("fr-cp-dragging");
    this.seeking = false;
    this.volSeeking = false;
    this._resetCache();
    this.root?.remove();
    this.root = null;
    this.progressFill = null;
    this.timeCur = null;
    this.timeRem = null;
    this.playBtn = null;
    this.shuffleBtn = null;
    this.repeatBtn = null;
    this.volFill = null;
  },
};
