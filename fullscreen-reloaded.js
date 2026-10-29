// ==========================================================================
// Fullscreen Reloaded (Spotify 1.3.6 compatible)
// A cinematic, modern fullscreen replacement for Spicetify.
// Generated on: 2026-10-29T09:33:50.639Z
// ==========================================================================

(function FullscreenReloaded() {
  "use strict";

  const __modules = {
    "./App.js": function(require, exports, module) {
// --- ./App.js ---
/**
 * Main application coordinator for Fullscreen Reloaded.
 */
const {  el  } = require("./utils/dom.js");
const {  resolveImageUrl, rgb, rgba  } = require("./utils/formatters.js");
const {  t  } = require("./utils/i18n.js");
const {  Settings  } = require("./utils/settings.js");
const {  SpicetifyBridge  } = require("./services/SpicetifyBridge.js");
const {  BackgroundManager  } = require("./components/BackgroundManager.js");
const {  AmbientManager  } = require("./components/AmbientManager.js");
const {  Clock  } = require("./components/Clock.js");
const {  UpNextCard  } = require("./components/UpNextCard.js");
const {  SettingsModal  } = require("./components/SettingsModal.js");
const {  TopBar  } = require("./components/TopBar.js");
const {  BottomDock  } = require("./components/BottomDock.js");
const {  LyricsView  } = require("./components/LyricsView.js");
const {  LyricsService  } = require("./services/LyricsService.js");

const App = exports.App = {
  root: null,
  stage: null,
  artImg: null,
  artImgAlt: null,
  artActiveIsImg: true,
  artWrap: null,
  ringRect: null,
  metaWrap: null,
  titleEl: null,
  artistEl: null,
  albumEl: null,
  open: false,
  tickHandle: null,
  songChangeListener: null,
  currentTrack: null,
  currentImage: null,
  _metaGen: 0,
  idleTimer: null,

  mount() {
    const root = el("div", "");
    root.id = "fullscreen-reloaded-root";

    root.appendChild(BackgroundManager.build());
    root.appendChild(AmbientManager.build());
    root.appendChild(Clock.build());

    this.stage = el("div", "fr-stage");

    // Album art + progress ring + metadata
    const artPanel = el("div", "fr-art-panel");
    const artColumn = el("div", "");
    artColumn.style.display = "flex";
    artColumn.style.flexDirection = "column";
    artColumn.style.alignItems = "flex-start";

    this.artWrap = el("div", "fr-art-wrap fr-glow");

    // SVG progress ring around artwork
    const ringSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ringSvg.setAttribute("class", "fr-progress-ring");
    const ringRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    ringRect.setAttribute("class", "fr-progress-ring-rect");
    ringRect.setAttribute("x", "-16");
    ringRect.setAttribute("y", "-16");
    ringRect.style.width = "calc(100% + 32px)";
    ringRect.style.height = "calc(100% + 32px)";
    ringRect.style.rx = "calc(var(--fr-radius) + 16px)";
    ringRect.setAttribute("pathLength", "100");
    ringSvg.appendChild(ringRect);
    this.ringRect = ringRect;

    this.artImg = document.createElement("img");
    this.artImg.className = "fr-art-img";
    this.artImgAlt = document.createElement("img");
    this.artImgAlt.className = "fr-art-img";

    this.artWrap.append(ringSvg, this.artImg, this.artImgAlt);

    const meta = el("div", "fr-meta");
    this.metaWrap = meta;
    this.titleEl = el("h1", "fr-title", "—");
    this.artistEl = el("p", "fr-artist", "—");
    this.albumEl = el("p", "fr-album", "—");
    meta.append(this.titleEl, this.artistEl, this.albumEl);

    artColumn.append(this.artWrap, meta);
    artPanel.appendChild(artColumn);

    // Lyrics panel
    const lyricsPanel = LyricsView.build(this);

    this.stage.append(artPanel, lyricsPanel);
    root.appendChild(this.stage);

    // Bottom dock
    root.appendChild(BottomDock.build(this));

    // Up Next card
    root.appendChild(UpNextCard.build());

    // Top bar
    root.appendChild(TopBar.build(this));

    // Settings panel
    root.appendChild(SettingsModal.build());

    document.body.appendChild(root);
    this.root = root;

    this.applyLayoutSettings();

    // Listen to track changes
    this.songChangeListener = () => this.onTrackChange();
    SpicetifyBridge.addPlayerListener("songchange", this.songChangeListener);

    // Listen to settings changes
    Settings.onChange((key) => this.onSettingsChanged(key));

    // Register idle and hotkeys
    this.registerIdleTracker();
    this.registerHotkeys();
  },

  registerIdleTracker() {
    const reset = () => this.resetIdle();
    window.addEventListener("mousemove", reset);
    window.addEventListener("mousedown", reset);
    window.addEventListener("keydown", reset);
    window.addEventListener("wheel", reset);
    window.addEventListener("mouseleave", () => this.setIdle(true));
  },

  resetIdle() {
    if (!this.open) return;
    if (this.root && this.root.classList.contains("fr-idle")) {
      this.root.classList.remove("fr-idle");
    }
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.setIdle(true), 4000);
  },

  setIdle(isIdle) {
    if (!this.root || !this.open) return;
    if (SettingsModal.root && SettingsModal.root.classList.contains("fr-show")) return;
    this.root.classList.toggle("fr-idle", isIdle);
    AmbientManager.setIdle(isIdle);
  },

  registerHotkeys() {
    // Intercept clicks on Spotify's native fullscreen button
    document.addEventListener(
      "click",
      (e) => {
        if (SpicetifyBridge.isSpotifyFullscreenButton(e.target)) {
          e.preventDefault();
          e.stopPropagation();
          this.toggleOpen();
        }
      },
      true
    );

    // Keyboard shortcuts
    document.addEventListener(
      "keydown",
      (e) => {
        const target = e.target;
        const isTyping =
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable);

        if (isTyping) return;

        // F11 support
        if (e.key === "F11") {
          e.preventDefault();
          this.toggleOpen();
          return;
        }

        if (!this.open && (e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          this.launch();
        } else if (this.open && e.key === "Escape") {
          e.preventDefault();
          this.close();
        }
      },
      true
    );
  },

  async onTrackChange() {
    const track = SpicetifyBridge.getCurrentTrack();
    if (!track) return;

    const isSameTrack = this.currentTrack && this.currentTrack.uri === track.uri;
    this.currentTrack = track;

    const meta = track.metadata || {};
    const artists =
      track.artists && track.artists.length
        ? track.artists.map((a) => a.name || a.displayName || "").filter(Boolean).join(", ")
        : meta.artist_name || track.name || t("unknownArtist");

    const updateMeta = () => {
      this.titleEl.textContent = meta.title || track.name || t("unknownTitle");
      this.artistEl.textContent = artists;
      this.albumEl.textContent = meta.album_title || track.album?.name || "";
      this._applyMetaVisibility();
    };

    if (!isSameTrack) {
      const gen = ++this._metaGen;
      this.metaWrap.classList.add("fr-meta-animating");
      setTimeout(() => {
        if (gen !== this._metaGen) return;
        updateMeta();
        this.metaWrap.classList.remove("fr-meta-animating");
      }, 150);
    } else {
      updateMeta();
    }

    const image = resolveImageUrl(
      meta.image_xlarge_url ||
        meta.image_large_url ||
        meta.image_url ||
        track.album?.images?.[0]?.url ||
        track.images?.[0]?.url
    );
    this.currentImage = image;

    if (!isSameTrack) {
      UpNextCard.reset();
      TopBar.updatePiPImage(image);

      // Start fetching lyrics immediately without waiting for background color extraction
      LyricsView.loadForTrack(track, this);

      // Crossfade album art between dual stacked layers
      const showing = this.artActiveIsImg ? this.artImg : this.artImgAlt;
      const incoming = this.artActiveIsImg ? this.artImgAlt : this.artImg;
      incoming.src = image;
      incoming.onload = () => {
        incoming.classList.add("fr-art-active");
        showing.classList.remove("fr-art-active");
        this.artActiveIsImg = !this.artActiveIsImg;
      };

      const colors = await BackgroundManager.update(image);
      AmbientManager.updateColors(colors);
      this.root.style.setProperty("--fr-word-accent", rgb(colors.accent));
      this.artWrap.style.setProperty("--fr-art-glow", rgba(colors.accent, 0.65));
    } else if (LyricsView._currentTrackUri !== track.uri) {
      LyricsView.loadForTrack(track, this);
    }
  },

  startTicking() {
    if (this.tickHandle) return;
    const loop = () => {
      const progress = BottomDock.tick();
      const duration = SpicetifyBridge.getDuration();
      if (typeof progress === "number") {
        LyricsView.update(progress);
        UpNextCard.update(duration, progress);

        if (duration && this.ringRect) {
          const pct = Math.max(0, Math.min(1, progress / duration));
          this.ringRect.style.strokeDashoffset = 100 - pct * 100;
        }
      }
      this.tickHandle = requestAnimationFrame(loop);
    };
    this.tickHandle = requestAnimationFrame(loop);
  },

  stopTicking() {
    if (this.tickHandle) {
      cancelAnimationFrame(this.tickHandle);
      this.tickHandle = null;
    }
  },

  async toggleOpen() {
    if (this.open) this.close();
    else await this.launch();
  },

  async launch() {
    this.open = true;
    this.root.classList.add("fr-open");
    document.body.style.overflow = "hidden";
    Clock.start();

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      // browser may require user gesture
    }

    await this.onTrackChange();
    LyricsView.showProviderBadge(3000);
    this.startTicking();
  },

  close() {
    this.open = false;
    this.root.classList.remove("fr-open");
    SettingsModal.close();
    document.body.style.overflow = "";
    Clock.stop();

    try {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    } catch (e) {
      // ignore
    }

    this.stopTicking();
  },

  toggleLyricsVisible() {
    Settings.set("showLyrics", !Settings.get("showLyrics"));
  },

  onSettingsChanged(key) {
    if (
      [
        "showLyrics",
        "albumArtGlow",
        "albumArtShadow",
        "albumArtRadius",
        "albumArtSize",
        "clockPosition",
        "idleLyrics",
        "metaPosition",
        "showArtist",
        "showAlbum",
        "showAlbumArt",
        "showTitle",
      ].includes(key)
    ) {
      this.applyLayoutSettings();
    }
    if (["backgroundMode", "customColor"].includes(key) && this.currentTrack) {
      BackgroundManager.update(this.currentImage);
    }
    if (key === "lyricsProvider" && this.currentTrack) {
      LyricsService.clearCache();
      LyricsView.loadForTrack(this.currentTrack, this, true);
    }
    if (key === "waterfallMode") {
      LyricsView.applyWaterfallMode();
    }
  },

  applyLayoutSettings() {
    const forceCenter = !Settings.get("showLyrics") || LyricsView.hasLyrics === false;
    this.stage.classList.toggle("fr-centered", forceCenter);

    this.artWrap.classList.toggle("fr-glow", !!Settings.get("albumArtGlow"));
    this.artWrap.classList.toggle("fr-no-shadow", !Settings.get("albumArtShadow"));
    this.artWrap.style.setProperty("--fr-radius", Settings.get("albumArtRadius") + "px");

    this.stage.classList.remove("fr-size-small", "fr-size-medium", "fr-size-large");
    this.stage.classList.add("fr-size-" + (Settings.get("albumArtSize") || "large"));

    const clockPos = Settings.get("clockPosition") || "top";
    this.root.setAttribute("data-clock", clockPos);
    const clockEl = this.root.querySelector(".fr-clock");
    if (clockEl) {
      clockEl.classList.remove("fr-pos-top", "fr-pos-bottom");
      clockEl.classList.add("fr-pos-" + clockPos);
    }

    const idleLyrics = Settings.get("idleLyrics") === true;
    this.root.setAttribute("data-idle-lyrics", idleLyrics ? "true" : "false");

    this._applyMetaVisibility();
  },

  _applyMetaVisibility() {
    if (!this.metaWrap) return;
    const pos = Settings.get("metaPosition") || "left";
    const showArt = Settings.get("showAlbumArt") !== false;
    const showTitle = Settings.get("showTitle") !== false;
    const showArtist = Settings.get("showArtist") !== false;
    const showAlbum = Settings.get("showAlbum") !== false;

    this.metaWrap.style.textAlign = pos;
    this.metaWrap.style.marginLeft = pos === "center" || pos === "right" ? "auto" : "0";
    this.metaWrap.style.marginRight = pos === "center" || pos === "left" ? "auto" : "0";

    if (this.artWrap) this.artWrap.style.display = showArt ? "" : "none";
    this.titleEl.style.display = showTitle ? "" : "none";
    this.artistEl.style.display = showArtist ? "" : "none";
    this.albumEl.style.display = showAlbum ? "" : "none";
  },
};

    },

    "./components/AmbientManager.js": function(require, exports, module) {
// --- ./components/AmbientManager.js ---
/**
 * Ambient light orbs and floating particles manager.
 */
const {  el  } = require("./utils/dom.js");
const {  rgb  } = require("./utils/formatters.js");

const AmbientManager = exports.AmbientManager = {
  root: null,
  orbs: [],
  particles: [],

  build() {
    this.root = el("div", "fr-ambient fr-show");

    const orbsCont = el("div", "");
    this.orbs = [];
    for (let i = 0; i < 3; i++) {
      const orb = el("div", "fr-orb");
      orb.style.width = orb.style.height = 40 + Math.random() * 40 + "vh";
      orb.style.top = 10 + Math.random() * 50 + "%";
      orb.style.left = 10 + Math.random() * 50 + "%";
      orb.style.animationDelay = "-" + Math.random() * 15 + "s";
      orb.style.animationDuration = 15 + Math.random() * 10 + "s";
      this.orbs.push(orb);
      orbsCont.appendChild(orb);
    }

    const partsCont = el("div", "");
    this.particles = [];
    for (let i = 0; i < 25; i++) {
      const p = el("div", "fr-particle");
      p.style.width = p.style.height = 3 + Math.random() * 4 + "px";
      p.style.left = Math.random() * 100 + "%";
      p.style.animationDuration = 12 + Math.random() * 15 + "s";
      p.style.animationDelay = "-" + Math.random() * 25 + "s";
      this.particles.push(p);
      partsCont.appendChild(p);
    }

    this.root.append(orbsCont, partsCont);
    return this.root;
  },

  updateColors(colors) {
    if (!this.root || !this.orbs.length) return;
    this.orbs[0].style.backgroundColor = rgb(colors.dominant);
    this.orbs[1].style.backgroundColor = rgb(colors.accent);
    this.orbs[2].style.backgroundColor = rgb(colors.dark);
  },

  setIdle(isIdle) {
    if (this.root) {
      this.root.classList.toggle("fr-show", !isIdle);
    }
  },
};

    },

    "./components/BackgroundManager.js": function(require, exports, module) {
// --- ./components/BackgroundManager.js ---
/**
 * Dual-layer crossfading background manager.
 */
const {  el  } = require("./utils/dom.js");
const {  rgb, rgba  } = require("./utils/formatters.js");
const {  Settings  } = require("./utils/settings.js");
const {  ColorExtractor  } = require("./services/ColorExtractor.js");

const BackgroundManager = exports.BackgroundManager = {
  root: null,
  layerA: null,
  layerB: null,
  activeIsA: true,

  build() {
    const root = el("div", "fr-bg-root");
    this.layerA = el("div", "fr-bg-layer fr-bg-active");
    this.layerB = el("div", "fr-bg-layer");
    root.append(this.layerA, this.layerB, el("div", "fr-bg-tint"), el("div", "fr-bg-scrim"));
    this.root = root;
    return root;
  },

  async update(imageUrl) {
    const colors = await ColorExtractor.extract(imageUrl);
    const mode = Settings.get("backgroundMode");
    const next = this.activeIsA ? this.layerB : this.layerA;
    const prev = this.activeIsA ? this.layerA : this.layerB;

    next.style.backgroundImage = "";
    next.style.backgroundColor = "";
    next.style.filter = "";

    switch (mode) {
      case "solid":
        next.style.backgroundColor = rgb(colors.dark);
        break;
      case "gradient":
        next.style.backgroundImage = `linear-gradient(160deg, ${rgb(colors.dominant)}, ${rgb(colors.dark)})`;
        break;
      case "dynamic-gradient":
        next.style.backgroundImage = `radial-gradient(ellipse at 20% 15%, ${rgba(
          colors.accent,
          0.55
        )}, transparent 60%), linear-gradient(160deg, ${rgb(colors.dominant)}, ${rgb(colors.dark)})`;
        break;
      case "blurred-artwork":
        next.style.backgroundImage = `url("${imageUrl}")`;
        next.style.filter = "blur(60px) saturate(1.3) brightness(0.6)";
        break;
      case "artwork":
        next.style.backgroundImage = `url("${imageUrl}")`;
        break;
      case "darkened-artwork":
        next.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.75)), url("${imageUrl}")`;
        break;
      case "custom-color":
        next.style.backgroundColor = Settings.get("customColor");
        break;
      default:
        next.style.backgroundColor = rgb(colors.dark);
    }

    const transitionMs = Settings.get("transitionMs") || 900;
    next.style.transitionDuration = transitionMs + "ms";
    prev.style.transitionDuration = transitionMs + "ms";

    // Force layout so opacity transition runs cleanly
    void next.offsetHeight;
    next.classList.add("fr-bg-active");
    prev.classList.remove("fr-bg-active");
    this.activeIsA = !this.activeIsA;

    return colors;
  },
};

    },

    "./components/BottomDock.js": function(require, exports, module) {
// --- ./components/BottomDock.js ---
/**
 * Liquid Glass Bottom Dock component (Playback Controls, Progress, Volume, Queue).
 */
const {  el, iconBtn  } = require("./utils/dom.js");
const {  Icons  } = require("./utils/icons.js");
const {  formatMs  } = require("./utils/formatters.js");
const {  SpicetifyBridge  } = require("./services/SpicetifyBridge.js");

const BottomDock = exports.BottomDock = {
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

    },

    "./components/Clock.js": function(require, exports, module) {
// --- ./components/Clock.js ---
/**
 * Large digital clock for cinema idle mode.
 */
const {  el  } = require("./utils/dom.js");

const Clock = exports.Clock = {
  root: null,
  timer: null,

  build() {
    this.root = el("div", "fr-clock", "00:00");
    return this.root;
  },

  start() {
    const tick = () => {
      if (!this.root) return;
      const d = new Date();
      const h = d.getHours().toString().padStart(2, "0");
      const m = d.getMinutes().toString().padStart(2, "0");
      this.root.textContent = `${h}:${m}`;
    };
    tick();
    this.stop();
    this.timer = setInterval(tick, 1000);
  },

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },
};

    },

    "./components/CustomColorPicker.js": function(require, exports, module) {
// --- ./components/CustomColorPicker.js ---
/**
 * Custom Liquid Glass Color Picker component.
 * Replaces ugly native OS color popups with Apple TV / visionOS aesthetic presets,
 * an interactive rainbow hue slider, hex input, and native color wheel trigger.
 */
const {  el  } = require("./utils/dom.js");

// Vibrant & distinguishable presets + elegant atmospheric darks
const VIBRANT_PRESETS = [
  { name: "Spotify Green", hex: "#1ed760" },
  { name: "Cyan Sky", hex: "#06b6d4" },
  { name: "Electric Blue", hex: "#3b82f6" },
  { name: "Royal Violet", hex: "#8b5cf6" },
  { name: "Neon Fuchsia", hex: "#d946ef" },
  { name: "Coral Red", hex: "#ef4444" },
  { name: "Sunset Orange", hex: "#f97316" },
  { name: "Warm Amber", hex: "#f59e0b" },
];

const DARK_PRESETS = [
  { name: "OLED Siyah", hex: "#000000" },
  { name: "Gece Mavisi", hex: "#0f172a" },
  { name: "Derin İndigo", hex: "#1e1b4b" },
  { name: "Koyu Mürdüm", hex: "#3b0764" },
  { name: "Bordo Noir", hex: "#450a0a" },
  { name: "Zümrüt Gece", hex: "#064e3b" },
  { name: "Duman Grisi", hex: "#1e293b" },
  { name: "Saf Beyaz", hex: "#ffffff" },
];

let initializedGlobalColorListener = false;
const activeColorPickers = new Set();

function initGlobalListener() {
  if (initializedGlobalColorListener) return;
  initializedGlobalColorListener = true;

  document.addEventListener("click", (e) => {
    for (const close of activeColorPickers) {
      close(e);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      for (const close of activeColorPickers) {
        close(null, true);
      }
    }
  });
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex) {
  let c = (hex || "#101014").replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  if (c.length !== 6) return { h: 0, s: 70, l: 50 };

  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h = Math.round(h * 60);
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Creates a custom Liquid Glass Color Picker element.
 * @param {Object} config
 * @param {string} config.value Initial hex color (e.g. "#1ed760")
 * @param {(hex: string) => void} config.onChange Callback on color change
 * @returns {HTMLElement}
 */
function createCustomColorPicker({ value = "#101014", onChange }) {
  initGlobalListener();

  const wrap = el("div", "fr-color-picker-wrap");
  let currentColor = (value || "#101014").toLowerCase();
  if (!currentColor.startsWith("#")) currentColor = "#" + currentColor;

  // Swatch trigger button
  const triggerBtn = document.createElement("button");
  triggerBtn.setAttribute("type", "button");
  triggerBtn.className = "fr-color-swatch-btn";

  const swatchInner = el("span", "fr-color-swatch-inner");
  swatchInner.style.backgroundColor = currentColor;

  const hexLabel = el("span", "fr-color-hex-label", currentColor.toUpperCase());

  triggerBtn.append(swatchInner, hexLabel);

  // Popup dialog
  const popup = el("div", "fr-color-popup");

  const close = (e, force = false) => {
    if (force || (e && !wrap.contains(e.target))) {
      wrap.classList.remove("fr-open");
    }
  };
  activeColorPickers.add(close);

  // Preset container
  const createPresetGroup = (titleText, presets) => {
    const title = el("div", "fr-color-popup-title", titleText);
    const grid = el("div", "fr-color-preset-grid");

    presets.forEach((p) => {
      const item = el("button", "fr-color-preset-item");
      item.setAttribute("type", "button");
      item.setAttribute("title", p.name);
      item.setAttribute("data-hex", p.hex);
      item.style.backgroundColor = p.hex;

      // Checkmark icon
      const checkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      checkSvg.setAttribute("class", "fr-check-sm");
      checkSvg.setAttribute("viewBox", "0 0 24 24");
      const checkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      checkPath.setAttribute("d", "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z");
      checkSvg.appendChild(checkPath);
      item.appendChild(checkSvg);

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        setColor(p.hex);
      });

      grid.appendChild(item);
    });

    return [title, grid];
  };

  const [vibrantTitle, vibrantGrid] = createPresetGroup("Canlı Renkler", VIBRANT_PRESETS);
  const [darkTitle, darkGrid] = createPresetGroup("Koyu & Zarif", DARK_PRESETS);

  popup.append(vibrantTitle, vibrantGrid, darkTitle, darkGrid);

  // Rainbow Hue Slider
  const sliderWrap = el("div", "fr-hue-slider-wrap");
  const sliderTitle = el("div", "fr-color-popup-title", "Renk Skalası");
  const hueSlider = document.createElement("input");
  hueSlider.type = "range";
  hueSlider.min = "0";
  hueSlider.max = "360";
  hueSlider.value = String(hexToHsl(currentColor).h);
  hueSlider.className = "fr-hue-slider";

  hueSlider.addEventListener("input", (e) => {
    const h = parseInt(e.target.value, 10);
    const currentHsl = hexToHsl(currentColor);
    const s = currentHsl.s < 20 ? 80 : currentHsl.s;
    const l = currentHsl.l < 15 || currentHsl.l > 85 ? 50 : currentHsl.l;
    setColor(hslToHex(h, s, l), false);
  });

  sliderWrap.append(sliderTitle, hueSlider);
  popup.appendChild(sliderWrap);

  // Custom Hex Input row with hidden native color picker trigger
  const hexRow = el("div", "fr-color-custom-row");

  const previewBtn = el("button", "fr-color-wheel-btn");
  previewBtn.setAttribute("type", "button");
  previewBtn.setAttribute("title", "Renk Çarkı / Damlalık Aç");

  const preview = el("span", "fr-color-preview-circle");
  preview.style.backgroundColor = currentColor;

  const nativePicker = document.createElement("input");
  nativePicker.type = "color";
  nativePicker.className = "fr-hidden-native-picker";
  nativePicker.value = currentColor;
  nativePicker.style.display = "none";

  previewBtn.appendChild(preview);

  previewBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    nativePicker.click();
  });

  nativePicker.addEventListener("input", (e) => {
    setColor(e.target.value);
  });

  const hexInput = document.createElement("input");
  hexInput.type = "text";
  hexInput.className = "fr-color-text-input";
  hexInput.maxLength = 7;
  hexInput.value = currentColor.toUpperCase();

  hexInput.addEventListener("input", (e) => {
    let val = e.target.value.trim();
    if (!val.startsWith("#")) val = "#" + val;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setColor(val, false);
    }
  });

  hexRow.append(previewBtn, nativePicker, hexInput);
  popup.appendChild(hexRow);

  const updateSwatches = () => {
    swatchInner.style.backgroundColor = currentColor;
    hexLabel.textContent = currentColor.toUpperCase();
    preview.style.backgroundColor = currentColor;
    nativePicker.value = currentColor;

    if (document.activeElement !== hexInput) {
      hexInput.value = currentColor.toUpperCase();
    }
    if (document.activeElement !== hueSlider) {
      hueSlider.value = String(hexToHsl(currentColor).h);
    }

    popup.querySelectorAll(".fr-color-preset-item").forEach((item) => {
      const itemHex = item.getAttribute("data-hex");
      const isSelected = itemHex.toLowerCase() === currentColor.toLowerCase();
      item.classList.toggle("fr-selected", isSelected);
    });
  };

  const setColor = (hex, updateSlider = true) => {
    currentColor = hex.toLowerCase();
    updateSwatches();
    if (onChange) onChange(currentColor);
  };

  // Toggle popup on click
  triggerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !wrap.classList.contains("fr-open");
    for (const other of activeColorPickers) {
      other(null, true);
    }
    if (willOpen) {
      wrap.classList.add("fr-open");
      updateSwatches();
    }
  });

  wrap.append(triggerBtn, popup);

  return wrap;
}

// Exported functions
exports.createCustomColorPicker = createCustomColorPicker;

    },

    "./components/CustomSelect.js": function(require, exports, module) {
// --- ./components/CustomSelect.js ---
/**
 * Custom Liquid Glass Select Dropdown component.
 * Replaces ugly native HTML <select> popups with Apple TV / visionOS frosted glass styling.
 */
const {  el  } = require("./utils/dom.js");

// Global document click listener to close all dropdowns when clicking outside
let initializedGlobalListener = false;
const activeSelects = new Set();

function initGlobalListener() {
  if (initializedGlobalListener) return;
  initializedGlobalListener = true;

  document.addEventListener("click", (e) => {
    for (const closeMenu of activeSelects) {
      closeMenu(e);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      for (const closeMenu of activeSelects) {
        closeMenu(null, true);
      }
    }
  });
}

/**
 * Creates a custom dropdown element.
 * @param {Object} config
 * @param {Array<{value: string, label: string}>} config.options
 * @param {string} config.value
 * @param {(val: string) => void} config.onChange
 * @returns {HTMLElement}
 */
function createCustomSelect({ options, value, onChange }) {
  initGlobalListener();

  const wrap = el("div", "fr-select-wrap");
  let currentValue = value;

  // Selected label lookup (prefers shortLabel for the compact trigger button)
  const getButtonLabel = (v) => {
    const found = options.find((o) => o.value === v);
    return found ? found.shortLabel || found.label : v;
  };

  // Button trigger
  const btn = document.createElement("button");
  btn.setAttribute("type", "button");
  btn.className = "fr-select-btn";

  const labelSpan = el("span", "fr-select-label", getButtonLabel(currentValue));
  const arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  arrowSvg.setAttribute("class", "fr-select-arrow");
  arrowSvg.setAttribute("viewBox", "0 0 24 24");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z");
  arrowSvg.appendChild(path);

  btn.append(labelSpan, arrowSvg);

  // Menu popup
  const menu = el("div", "fr-select-menu");

  const close = (e, force = false) => {
    if (force || (e && !wrap.contains(e.target))) {
      wrap.classList.remove("fr-open");
    }
  };
  activeSelects.add(close);

  // Render items
  const renderItems = () => {
    menu.innerHTML = "";
    options.forEach((opt) => {
      const isSelected = opt.value === currentValue;
      const item = el("div", "fr-select-item" + (isSelected ? " fr-selected" : ""));

      const leftCol = el("div", "fr-select-item-left");
      const text = el("span", "fr-select-item-title", opt.label);
      leftCol.appendChild(text);
      if (opt.sublabel) {
        leftCol.appendChild(el("span", "fr-select-item-sub", opt.sublabel));
      }

      const rightCol = el("div", "fr-select-item-right");
      if (opt.badge) {
        rightCol.appendChild(el("span", "fr-select-item-badge", opt.badge));
      }

      // Checkmark icon
      const checkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      checkSvg.setAttribute("class", "fr-check");
      checkSvg.setAttribute("viewBox", "0 0 24 24");
      const checkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      checkPath.setAttribute("d", "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z");
      checkSvg.appendChild(checkPath);
      rightCol.appendChild(checkSvg);

      item.append(leftCol, rightCol);

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        currentValue = opt.value;
        labelSpan.textContent = getButtonLabel(opt.value);
        wrap.classList.remove("fr-open");
        renderItems();
        if (onChange) onChange(opt.value);
      });

      menu.appendChild(item);
    });
  };

  renderItems();

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !wrap.classList.contains("fr-open");
    // Close other open selects
    for (const closeOther of activeSelects) {
      closeOther(null, true);
    }
    if (willOpen) {
      wrap.classList.add("fr-open");
    }
  });

  wrap.append(btn, menu);

  // Method to programmatically set value
  wrap.setValue = (newVal) => {
    currentValue = newVal;
    labelSpan.textContent = getButtonLabel(newVal);
    renderItems();
  };

  return wrap;
}

// Exported functions
exports.createCustomSelect = createCustomSelect;

    },

    "./components/LyricsView.js": function(require, exports, module) {
// --- ./components/LyricsView.js ---
/**
 * Synchronized & Waterfall ("Şelale") Scrolling Lyrics View component.
 * - Uses per-line GPU translate3d(--fr-cascade-y) with top-to-bottom staggered delays
 *   so lines ripple like a true waterfall instead of moving as a rigid scrollTop block.
 * - Words flow from top (-10px) -> center (0px) -> bottom (+8px) with a 180deg top-to-bottom
 *   light sweep (staggered per word on line-synced tracks, and exact millisecond-synced on word-synced tracks).
 * - Configurable via Settings ("waterfallMode": "normal" | "intense" | "off").
 */
const {  el  } = require("./utils/dom.js");
const {  t  } = require("./utils/i18n.js");
const {  Settings  } = require("./utils/settings.js");
const {  LyricsService  } = require("./services/LyricsService.js");
const {  SpicetifyBridge  } = require("./services/SpicetifyBridge.js");

const LyricsView = exports.LyricsView = {
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

  userScrolling: false,
  userScrollTimer: null,
  requestId: 0,
  _currentTrackUri: null,
  _lastUnsyncedTime: null,
  _providerTimer: null,
  _shownStartBadgeForUri: null,

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
    if (!this.providerBadge || !this.providerSource || !this.hasLyrics) return;
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
      this.scrollEl.classList.remove("fr-user-scrolling");
      this.resumeBtn.classList.remove("fr-show");
      this.applyCascadePosition(false);
    }, 6000);
  },

  onUserScroll() {
    this.userScrolling = true;
    this.resumeBtn.classList.add("fr-show");
    clearTimeout(this.userScrollTimer);
    this.userScrollTimer = setTimeout(() => {
      this.userScrolling = false;
      this.resumeBtn.classList.remove("fr-show");
    }, 8000);
  },

  async loadForTrack(track, app, force = false) {
    if (!track) return;
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

    this.hasLyrics = true;
    if (this.providerBadge) this.providerBadge.classList.remove("fr-show");
    if (this.instrPanel) this.instrPanel.classList.remove("fr-show");
    if (app?.applyLayoutSettings) app.applyLayoutSettings();

    this.scrollEl.classList.remove("fr-ready", "fr-user-scrolling");
    this.scrollEl.scrollTop = 0;
    this._cascadeY = 0;
    this._manualOffsetY = 0;
    this._unsyncedScrollPos = 0;
    this.userScrolling = false;
    this._lastUnsyncedTime = null;

    const data = await LyricsService.resolve(track);
    if (myRequest !== this.requestId) return;

    this.scrollEl.innerHTML = "";
    this.scrollEl.classList.remove("fr-unsynced", "fr-mode-word", "fr-mode-line");
    this.lines = [];
    this.lineEls = [];
    this.activeIndex = -1;
    this.providerSource = "";

    if (!data || !data.lines || !data.lines.length) {
      this.hasLyrics = false;
      this._currentTrackUri = null;
      if (this.instrPanel) this.instrPanel.classList.add("fr-show");
      if (app?.applyLayoutSettings) app.applyLayoutSettings();
      return;
    }

    this.hasLyrics = true;
    this.providerSource = data.source || "Spotify";
    this.lines = data.lines;
    this.syncType = data.type;

    if (this.instrPanel) this.instrPanel.classList.remove("fr-show");
    if (app?.applyLayoutSettings) app.applyLayoutSettings();

    this.applyWaterfallMode();

    if (this.syncType === "unsynced") {
      this.scrollEl.classList.add("fr-unsynced");
    } else if (this.syncType === "word-synced") {
      this.scrollEl.classList.add("fr-mode-word");
    } else {
      this.scrollEl.classList.add("fr-mode-line");
    }

    const isSyncedAny = this.syncType === "word-synced" || this.syncType === "synced";
    let prevVocalEndMs = 0;

    this.lines.forEach((line, lineIdx) => {
      const lineEl = el("div", "fr-lyric-line fr-future fr-far");

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

      const textClean = fullText.trim().toLowerCase();
      const isMusicSymbol =
        textClean === "♪" ||
        textClean === "🎵" ||
        textClean === "🎶" ||
        textClean === "instrumental" ||
        textClean === "[instrumental]";

      // Compute full-bar duration so the waterfall flows continuously until the end of the bar/sentence
      const lineStart = Number(line.startMs) || 0;
      const nextLine = this.lines[lineIdx + 1];
      const nextStart = nextLine ? Number(nextLine.startMs) : lineStart + 3600;
      const rawBarMs = Math.max(800, nextStart - lineStart);
      const wordCount = Math.max(1, line.words.length);

      // Span 95% of the bar (capped only for long instrumental gaps so vocal bars fill 100% of their bar)
      const maxVocalBarMs = Math.max(1600, wordCount * 1200 + 600);
      const barSpanMs = Math.min(rawBarMs * 0.95, maxVocalBarMs);
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
        // Line-synced mode: render the entire sentence as a single unified block so the waterfall
        // flows continuously from the top of the first letter ('b') down to the bottom of the last letter ('m').
        const sentenceEl = el("span", "fr-lyric-sentence", fullText.trim());
        lineEl.appendChild(sentenceEl);
        line._sentenceEl = sentenceEl;
      } else {
        // Word-synced or unsynced mode: render individual word spans
        const weights = line.words.map((w) => {
          const clean = (typeof w === "string" ? w : w.text || "").trim();
          return Math.pow(Math.max(2, clean.length), 0.72);
        });
        const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

        let cursorMs = 0;
        line.words.forEach((w, wIdx) => {
          const wordText = typeof w === "string" ? w : w.text != null ? String(w.text) : "";
          const wordEl = el("span", "fr-lyric-word", wordText);
          wordEl.style.setProperty("--w-idx", String(wIdx));

          const sliceMs = (weights[wIdx] / totalWeight) * barSpanMs;
          const realWordDur =
            w && typeof w === "object" && w.startMs != null && w.endMs != null && w.endMs > w.startMs
              ? (w.endMs - w.startMs) * 1.65
              : sliceMs * 1.75;
          const wDurMs = Math.round(Math.max(720, Math.min(1650, realWordDur)));
          const wDelayMs = Math.round(Math.max(0, Math.min(barSpanMs - wDurMs * 0.35, cursorMs)));
          cursorMs += sliceMs * 0.88;

          wordEl.style.setProperty("--w-delay", `${wDelayMs}ms`);
          wordEl.style.setProperty("--w-dur", `${wDurMs}ms`);

          lineEl.appendChild(wordEl);
          if (w && typeof w === "object") w.el = wordEl;
        });
      }

      if (isSyncedAny) {
        lineEl.classList.add("fr-synced");
        lineEl.addEventListener("click", () => {
          this.userScrolling = false;
          this._manualOffsetY = 0;
          this.scrollEl.classList.remove("fr-user-scrolling");
          this.resumeBtn.classList.remove("fr-show");
          SpicetifyBridge.seek(line.startMs);
        });
      }

      this.scrollEl.appendChild(lineEl);
      this.lineEls.push(lineEl);
    });

    this.revealLyrics();
    if (app?.open) {
      this.showProviderBadge(3000);
      this._shownStartBadgeForUri = track.uri;
    }

    this.update(SpicetifyBridge.getProgress(), true);
  },

  revealLyrics() {
    requestAnimationFrame(() => {
      if (this.scrollEl) this.scrollEl.classList.add("fr-ready");
    });
  },

  _clearLineWordState(lineIdx, asPast = false) {
    if (lineIdx < 0 || lineIdx >= this.lines.length) return;
    const line = this.lines[lineIdx];
    if (!line) return;
    if (line._sentenceEl) {
      line._sentenceEl.style.removeProperty("--bar-pct");
      line._sentenceEl.style.removeProperty("--bar-flow-y");
    }
    if (!Array.isArray(line.words)) return;
    for (let k = 0; k < line.words.length; k++) {
      const w = line.words[k];
      if (!w.el) continue;
      w.el.classList.remove("fr-w-active", "fr-w-done");
      if (asPast) w.el.classList.add("fr-w-done");
    }
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
          const bridgeDur = SpicetifyBridge.getDuration();
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

          if (SpicetifyBridge.isPlaying()) {
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
        const dist = idx < 0 ? i : i - idx;
        const absDist = Math.abs(dist);

        let cls = "fr-lyric-line fr-synced";
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

    // --- 4a. Full-Sentence Top-to-Bottom Waterfall Flow (on line-synced 'synced' tracks) ---
    if (this.syncType === "synced" && this.activeIndex >= 0) {
      const activeLine = this.lines[this.activeIndex];
      const sentenceEl = activeLine?._sentenceEl;
      if (sentenceEl) {
        const wfMode = Settings.get("waterfallMode") || "normal";
        const lineStart = Number(activeLine.startMs) || 0;
        const barSpan = Math.max(600, Number(activeLine._barSpanMs) || 2500);
        const rawProgress = Math.max(0, Math.min(1, (progressMs - lineStart) / barSpan));
        // Smooth sine-eased progress across the entire bar from top of first letter ('b') to bottom of last ('m')
        const eased = 0.5 * (1 - Math.cos(rawProgress * Math.PI));
        const sweptPct = wfMode === "off" ? 115 : -14 + eased * 128;
        const dropPx = wfMode === "intense" ? -12 : wfMode === "normal" ? -8 : 0;
        const flowY = dropPx * (1 - eased);

        sentenceEl.style.setProperty("--bar-pct", `${sweptPct.toFixed(1)}%`);
        sentenceEl.style.setProperty("--bar-flow-y", `${flowY.toFixed(2)}px`);
      }
    }

    // --- 4b. Word-by-Word Waterfall Flow (on word-synced tracks) ---
    if (this.syncType === "word-synced" && this.activeIndex >= 0) {
      const activeLine = this.lines[this.activeIndex];
      if (activeLine && activeLine.isWordSynced && Array.isArray(activeLine.words)) {
        const words = activeLine.words;
        for (let k = 0; k < words.length; k++) {
          const w = words[k];
          const elWord = w.el;
          if (!elWord) continue;

          const wStart = w.startMs ?? activeLine.startMs ?? 0;
          const wEnd = w.endMs ?? wStart + 350;

          if (progressMs < wStart) {
            if (elWord.classList.contains("fr-w-active") || elWord.classList.contains("fr-w-done")) {
              elWord.classList.remove("fr-w-active", "fr-w-done");
            }
          } else if (progressMs >= wEnd) {
            if (!elWord.classList.contains("fr-w-done")) {
              elWord.classList.remove("fr-w-active");
              elWord.classList.add("fr-w-done");
            }
          } else {
            if (!elWord.classList.contains("fr-w-active")) {
              elWord.classList.remove("fr-w-done");
              elWord.classList.add("fr-w-active");
            }
          }
        }
      }
    }
  },

  /**
   * Positions all lyric lines using per-line GPU translate3d(--fr-cascade-y)
   * with a top-to-bottom staggered delay (--fr-stagger) so lines cascade like a waterfall.
   */
  applyCascadePosition(instant = false) {
    if (!this.scrollEl || !this.lineEls.length) return;
    const targetIdx = this.activeIndex >= 0 ? this.activeIndex : 0;
    const activeEl = this.lineEls[targetIdx];
    if (!activeEl) return;

    const wfMode = Settings.get("waterfallMode") || "normal";
    const lineStepMs = wfMode === "intense" ? 115 : wfMode === "normal" ? 80 : 0;

    const panelHeight = this.scrollEl.clientHeight || 600;
    const anchorY = panelHeight * 0.34;
    const rawOffset = -(activeEl.offsetTop - anchorY + activeEl.offsetHeight / 2);
    this._cascadeY = Math.min(0, rawOffset);

    if (instant) {
      this.scrollEl.classList.add("fr-no-transition");
    }

    // Stagger from topmost visible line (targetIdx - 3) down to bottom visible line (targetIdx + 7)
    const topVisibleIdx = targetIdx - 3;

    for (let i = 0; i < this.lineEls.length; i++) {
      const lineEl = this.lineEls[i];
      let staggerMs = 0;
      if (!instant && lineStepMs > 0 && i >= topVisibleIdx && i <= targetIdx + 8) {
        const orderFromTop = i - topVisibleIdx; // 0, 1, 2, 3 (active), 4, 5, 6...
        staggerMs = orderFromTop * lineStepMs;
      }
      lineEl.style.setProperty("--fr-stagger", `${staggerMs}ms`);
      lineEl.style.setProperty("--fr-cascade-y", `${this._cascadeY.toFixed(1)}px`);
    }

    if (instant) {
      requestAnimationFrame(() => {
        if (this.scrollEl) this.scrollEl.classList.remove("fr-no-transition");
      });
    }
  },

  scrollActiveIntoView(instant = false) {
    this.applyCascadePosition(instant);
  },
};

    },

    "./components/SettingsModal.js": function(require, exports, module) {
// --- ./components/SettingsModal.js ---
/**
 * Settings Panel Modal component with Custom Liquid Glass Dropdowns.
 */
const {  el, toggle  } = require("./utils/dom.js");
const {  t  } = require("./utils/i18n.js");
const {  Settings  } = require("./utils/settings.js");
const {  createCustomSelect  } = require("./components/CustomSelect.js");
const {  createCustomColorPicker  } = require("./components/CustomColorPicker.js");

const SettingsModal = exports.SettingsModal = {
  root: null,

  build() {
    const panel = el("div", "fr-settings-panel");

    // ================= Section 1: Background =================
    const sec1 = el("div", "fr-settings-section");
    sec1.appendChild(el("div", "fr-settings-title", t("background")));

    // Background mode dropdown
    const bgRow = el("div", "fr-settings-row");
    const bgSelect = createCustomSelect({
      options: [
        { value: "solid", label: t("solidColor") },
        { value: "gradient", label: t("gradient") },
        { value: "dynamic-gradient", label: t("dynamicGradient") },
        { value: "blurred-artwork", label: t("blurredArtwork") },
        { value: "artwork", label: t("artwork") },
        { value: "darkened-artwork", label: t("darkenedArtwork") },
        { value: "custom-color", label: t("customColor") },
      ],
      value: Settings.get("backgroundMode"),
      onChange: (val) => Settings.set("backgroundMode", val),
    });
    bgRow.append(el("label", null, t("mode")), bgSelect);
    sec1.appendChild(bgRow);

    // Custom color picker (Liquid Glass)
    const colorRow = el("div", "fr-settings-row");
    const colorPicker = createCustomColorPicker({
      value: Settings.get("customColor") || "#101014",
      onChange: (hex) => Settings.set("customColor", hex),
    });
    colorRow.append(el("label", null, t("customColor")), colorPicker);
    sec1.appendChild(colorRow);

    panel.appendChild(sec1);
    panel.appendChild(el("div", "fr-settings-divider"));

    // ================= Section 2: Appearance =================
    const sec2 = el("div", "fr-settings-section");
    sec2.appendChild(el("div", "fr-settings-title", t("appearance")));

    // Show Lyrics Toggle
    const lyricsRow = el("div", "fr-settings-row");
    const lyricsToggle = toggle(Settings.get("showLyrics"), (v) => Settings.set("showLyrics", v));
    lyricsRow.append(el("label", null, t("showLyrics")), lyricsToggle);
    sec2.appendChild(lyricsRow);

    // Idle Mode Lyrics Toggle
    const idleLyricsRow = el("div", "fr-settings-row");
    const idleLyricsToggle = toggle(Settings.get("idleLyrics"), (v) => Settings.set("idleLyrics", v));
    idleLyricsRow.append(el("label", null, t("idleLyrics")), idleLyricsToggle);
    sec2.appendChild(idleLyricsRow);

    // Waterfall Flow Mode Dropdown (Şelale Akışı)
    const waterfallRow = el("div", "fr-settings-row");
    const waterfallSelect = createCustomSelect({
      options: [
        { value: "normal", label: t("waterfallNormal"), shortLabel: t("waterfallNormal") },
        { value: "intense", label: t("waterfallIntense"), shortLabel: t("waterfallIntense") },
        { value: "off", label: t("waterfallOff"), shortLabel: t("waterfallOff") },
      ],
      value: Settings.get("waterfallMode") || "normal",
      onChange: (val) => Settings.set("waterfallMode", val),
    });
    waterfallRow.append(el("label", null, t("waterfallFlow")), waterfallSelect);
    sec2.appendChild(waterfallRow);

    // Interlude Dots Toggle (Apple Music • • •)
    const interludeRow = el("div", "fr-settings-row");
    const interludeToggle = toggle(Settings.get("interludeDots") !== false, (v) => Settings.set("interludeDots", v));
    interludeRow.append(el("label", null, t("interludeDots")), interludeToggle);
    sec2.appendChild(interludeRow);

    // Lyrics Provider Dropdown (Apple Music / LRCLIB / Genius / Spotify)
    const providerRow = el("div", "fr-settings-row");
    const providerSelect = createCustomSelect({
      options: [
        {
          value: "auto",
          label: t("providerAuto"),
          shortLabel: t("providerAutoShort"),
          sublabel: t("providerAutoSub"),
          badge: t("badgeSmart"),
        },
        {
          value: "applemusic",
          label: t("providerApple"),
          shortLabel: "Apple Music",
          badge: t("badgeWordSync"),
        },
        {
          value: "lrclib",
          label: t("providerLrclib"),
          shortLabel: "LRCLIB",
          badge: t("badgeSynced"),
        },
        {
          value: "genius",
          label: t("providerGenius"),
          shortLabel: "Genius",
          badge: t("badgeUnsynced"),
        },
        {
          value: "spotify",
          label: t("providerSpotify"),
          shortLabel: "Spotify",
          badge: t("badgeOfficial"),
        },
      ],
      value: Settings.get("lyricsProvider") || "auto",
      onChange: (val) => Settings.set("lyricsProvider", val),
    });
    providerRow.append(el("label", null, t("lyricsProvider")), providerSelect);
    sec2.appendChild(providerRow);

    // Ambient Glow Toggle
    const glowRow = el("div", "fr-settings-row");
    const glowToggle = toggle(Settings.get("albumArtGlow"), (v) => Settings.set("albumArtGlow", v));
    glowRow.append(el("label", null, t("ambientGlow")), glowToggle);
    sec2.appendChild(glowRow);

    // Shadow Toggle
    const shadowRow = el("div", "fr-settings-row");
    const shadowToggle = toggle(Settings.get("albumArtShadow"), (v) => Settings.set("albumArtShadow", v));
    shadowRow.append(el("label", null, t("glowShadow")), shadowToggle);
    sec2.appendChild(shadowRow);

    // Artwork Size Dropdown
    const sizeRow = el("div", "fr-settings-row");
    const sizeSelect = createCustomSelect({
      options: [
        { value: "small", label: t("small") },
        { value: "medium", label: t("medium") },
        { value: "large", label: t("large") },
      ],
      value: Settings.get("albumArtSize") || "large",
      onChange: (val) => Settings.set("albumArtSize", val),
    });
    sizeRow.append(el("label", null, t("artworkSize")), sizeSelect);
    sec2.appendChild(sizeRow);

    // Idle Clock Position Dropdown
    const clockRow = el("div", "fr-settings-row");
    const clockSelect = createCustomSelect({
      options: [
        { value: "top", label: t("top") },
        { value: "bottom", label: t("bottom") },
        { value: "none", label: t("none") },
      ],
      value: Settings.get("clockPosition") || "top",
      onChange: (val) => Settings.set("clockPosition", val),
    });
    clockRow.append(el("label", null, t("idleClockPos")), clockSelect);
    sec2.appendChild(clockRow);

    // Unsynced Lyrics Auto-Scroll Speed Dropdown (NEW!)
    const scrollRow = el("div", "fr-settings-row");
    const scrollSelect = createCustomSelect({
      options: [
        { value: "track", label: t("trackProgress") },
        { value: "slow", label: t("slow") },
        { value: "normal", label: t("normal") },
        { value: "fast", label: t("fast") },
        { value: "off", label: t("off") },
      ],
      value: Settings.get("unsyncedScrollMode") || "track",
      onChange: (val) => Settings.set("unsyncedScrollMode", val),
    });
    scrollRow.append(el("label", null, t("unsyncedScroll")), scrollSelect);
    sec2.appendChild(scrollRow);

    // Language Dropdown
    const langRow = el("div", "fr-settings-row");
    const langSelect = createCustomSelect({
      options: [
        { value: "auto", label: t("auto") },
        { value: "en", label: "English" },
        { value: "tr", label: "Türkçe" },
      ],
      value: Settings.get("language") || "auto",
      onChange: (val) => {
        Settings.set("language", val);
        location.reload();
      },
    });
    langRow.append(el("label", null, t("language")), langSelect);
    sec2.appendChild(langRow);

    panel.appendChild(sec2);
    panel.appendChild(el("div", "fr-settings-divider"));

    // ================= Section 3: Track Info =================
    const sec3 = el("div", "fr-settings-section");
    sec3.appendChild(el("div", "fr-settings-title", t("trackInfo")));

    // Metadata Position Dropdown
    const metaPosRow = el("div", "fr-settings-row");
    const metaPosSelect = createCustomSelect({
      options: [
        { value: "left", label: t("left") },
        { value: "center", label: t("center") },
        { value: "right", label: t("right") },
      ],
      value: Settings.get("metaPosition") || "left",
      onChange: (val) => Settings.set("metaPosition", val),
    });
    metaPosRow.append(el("label", null, t("position")), metaPosSelect);
    sec3.appendChild(metaPosRow);

    // Toggle: Show Album Art
    const showArtRow = el("div", "fr-settings-row");
    const showArtToggle = toggle(Settings.get("showAlbumArt") !== false, (v) => Settings.set("showAlbumArt", v));
    showArtRow.append(el("label", null, t("albumArt")), showArtToggle);
    sec3.appendChild(showArtRow);

    // Toggle: Show Track Title
    const showTitleRow = el("div", "fr-settings-row");
    const showTitleToggle = toggle(Settings.get("showTitle") !== false, (v) => Settings.set("showTitle", v));
    showTitleRow.append(el("label", null, t("trackTitle")), showTitleToggle);
    sec3.appendChild(showTitleRow);

    // Toggle: Show Artists
    const showArtistRow = el("div", "fr-settings-row");
    const showArtistToggle = toggle(Settings.get("showArtist") !== false, (v) => Settings.set("showArtist", v));
    showArtistRow.append(el("label", null, t("artists")), showArtistToggle);
    sec3.appendChild(showArtistRow);

    // Toggle: Show Album Name
    const showAlbumRow = el("div", "fr-settings-row");
    const showAlbumToggle = toggle(Settings.get("showAlbum") !== false, (v) => Settings.set("showAlbum", v));
    showAlbumRow.append(el("label", null, t("albumName")), showAlbumToggle);
    sec3.appendChild(showAlbumRow);

    panel.appendChild(sec3);

    this.root = panel;
    return panel;
  },

  toggleOpen() {
    if (this.root) {
      this.root.classList.toggle("fr-show");
    }
  },

  close() {
    if (this.root) {
      this.root.classList.remove("fr-show");
    }
  },
};

    },

    "./components/TopBar.js": function(require, exports, module) {
// --- ./components/TopBar.js ---
/**
 * Liquid Glass Top Bar component (Lyrics, Picture-in-Picture, Settings, Close).
 */
const {  el, iconBtn  } = require("./utils/dom.js");
const {  Icons  } = require("./utils/icons.js");
const {  SettingsModal  } = require("./components/SettingsModal.js");

const TopBar = exports.TopBar = {
  root: null,
  lyricsBtn: null,
  pipBtn: null,
  pipImg: null,

  build(app) {
    const topbar = el("div", "fr-topbar");

    // 1. Lyrics Toggle
    this.lyricsBtn = iconBtn(Icons.lyrics, () => app.toggleLyricsVisible());

    // 2. Picture-in-Picture
    this.pipBtn = iconBtn(Icons.pip, async () => {
      await this.togglePiP(app);
    });

    const sep = el("div", "fr-topbar-sep");

    // 3. Settings Gear
    const gearBtn = iconBtn(Icons.gear, () => SettingsModal.toggleOpen());

    // 4. Close Button
    const closeBtn = iconBtn(Icons.close, () => app.close());

    topbar.append(this.lyricsBtn, this.pipBtn, sep, gearBtn, closeBtn);
    this.root = topbar;
    return topbar;
  },

  updatePiPImage(imageUrl) {
    if (this.pipImg && imageUrl) {
      this.pipImg.src = imageUrl;
    }
  },

  async togglePiP(app) {
    try {
      // If Document PiP is open, close it
      if (window.documentPictureInPicture && window.documentPictureInPicture.window) {
        window.documentPictureInPicture.window.close();
        this.pipBtn.classList.remove("fr-active");
        this.pipImg = null;
        return;
      }

      // If Legacy Video PiP is open, close it
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        this.pipBtn.classList.remove("fr-active");
        return;
      }

      // Modern Document PiP API (Available in Chromium-based Spotify Desktop)
      if (window.documentPictureInPicture) {
        const pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 400,
          height: 400,
        });
        pipWindow.document.body.style.margin = "0";
        pipWindow.document.body.style.backgroundColor = "#121212";
        pipWindow.document.body.style.overflow = "hidden";

        const img = document.createElement("img");
        img.src = app.currentImage || "";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";

        this.pipImg = img;
        pipWindow.document.body.appendChild(img);

        pipWindow.addEventListener("pagehide", () => {
          this.pipBtn.classList.remove("fr-active");
          this.pipImg = null;
        });
        this.pipBtn.classList.add("fr-active");
      }
      // Fallback for older Chromium versions: Legacy Canvas Video PiP
      else {
        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = 800;
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = app.currentImage || "";
        img.onload = async () => {
          ctx.fillStyle = "#121212";
          ctx.fillRect(0, 0, 800, 800);
          ctx.drawImage(img, 0, 0, 800, 800);
          const stream = canvas.captureStream();
          const video = document.createElement("video");
          video.srcObject = stream;
          video.muted = true;
          await video.play();
          await video.requestPictureInPicture();
          video.addEventListener("leavepictureinpicture", () => {
            this.pipBtn.classList.remove("fr-active");
          });
        };
        this.pipBtn.classList.add("fr-active");
      }
    } catch (e) {
      console.warn("[Fullscreen Reloaded] PiP error:", e);
    }
  },
};

    },

    "./components/UpNextCard.js": function(require, exports, module) {
// --- ./components/UpNextCard.js ---
/**
 * Up Next preview card displaying the next song in the queue.
 */
const {  el  } = require("./utils/dom.js");
const {  t  } = require("./utils/i18n.js");
const {  resolveImageUrl  } = require("./utils/formatters.js");
const {  SpicetifyBridge  } = require("./services/SpicetifyBridge.js");

const UpNextCard = exports.UpNextCard = {
  root: null,
  img: null,
  title: null,
  artist: null,
  shown: false,

  build() {
    this.root = el("div", "fr-up-next");
    this.img = document.createElement("img");
    this.img.className = "fr-up-next-img";

    const info = el("div", "fr-up-next-info");
    info.appendChild(el("div", "fr-up-next-label", t("upNext")));
    this.title = el("h4", "fr-up-next-title", "");
    this.artist = el("p", "fr-up-next-artist", "");
    info.append(this.title, this.artist);

    this.root.append(this.img, info);
    this.root.addEventListener("click", () => SpicetifyBridge.next());
    return this.root;
  },

  async update(duration, progress) {
    if (!this.root) return;
    const remaining = duration - progress;
    const shouldShow = duration > 40000 && remaining > 0 && remaining < 20000;

    if (shouldShow && !this.shown) {
      const nextTrack = await SpicetifyBridge.getNextTrack();
      if (nextTrack) {
        const meta = nextTrack.metadata || nextTrack.contextTrack?.metadata || {};
        this.title.textContent = meta.title || nextTrack.name || t("unknownTitle");
        this.artist.textContent =
          meta.artist_name || (nextTrack.artists && nextTrack.artists[0]?.name) || t("unknownArtist");
        this.img.src = resolveImageUrl(
          meta.image_xlarge_url || meta.image_large_url || meta.image_url || nextTrack.album?.images?.[0]?.url
        );
        this.root.classList.add("fr-show");
        this.shown = true;
      }
    } else if (!shouldShow && this.shown) {
      this.root.classList.remove("fr-show");
      this.shown = false;
    }
  },

  reset() {
    this.shown = false;
    if (this.root) this.root.classList.remove("fr-show");
  },
};

    },

    "./index.js": function(require, exports, module) {
// --- ./index.js ---
/**
 * Fullscreen Reloaded
 * Premium Apple TV / visionOS-inspired Spotify fullscreen experience.
 * Entry point & lifecycle initialization.
 */
const {  Settings  } = require("./utils/settings.js");
const {  SpicetifyBridge  } = require("./services/SpicetifyBridge.js");
const {  App  } = require("./App.js");

// CSS placeholder replaced at build time with bundled styles from src/styles/*.css
const STYLES = "\n/* --- variables.css --- */\n:root {\n  --fr-bg: #060607;\n  --fr-fg: #ffffff;\n  --fr-fg-dim: rgba(255, 255, 255, 0.78);\n  --fr-fg-faint: rgba(255, 255, 255, 0.52);\n  --fr-accent: #ffffff;\n  --fr-accent-2: #101014;\n  --fr-radius: 18px;\n  --fr-font: \"Spotify Circular\", \"Circular Std\", -apple-system, \"Segoe UI\", Helvetica, Arial, sans-serif;\n  --fr-transition: 900ms;\n}\n\n#fullscreen-reloaded-root {\n  position: fixed;\n  inset: 0;\n  z-index: 999999;\n  font-family: var(--fr-font);\n  color: var(--fr-fg);\n  visibility: hidden;\n  opacity: 0;\n  transition: opacity 600ms cubic-bezier(0.2, 0.8, 0.2, 1), visibility 600ms;\n  overflow: hidden;\n  user-select: none;\n}\n\n#fullscreen-reloaded-root.fr-open {\n  visibility: visible;\n  opacity: 1;\n}\n\n#fullscreen-reloaded-root * {\n  box-sizing: border-box;\n}\n\n/* --- background.css --- */\n/* ---------------- Background ---------------- */\n.fr-bg-root {\n  position: absolute;\n  inset: 0;\n  overflow: hidden;\n  z-index: 0;\n}\n\n.fr-bg-layer {\n  position: absolute;\n  inset: -5%;\n  width: 110%;\n  height: 110%;\n  background-position: center;\n  background-size: cover;\n  opacity: 0;\n  transition: opacity var(--fr-transition) ease;\n  will-change: opacity;\n}\n\n.fr-bg-layer.fr-bg-active {\n  opacity: 1;\n}\n\n.fr-bg-tint {\n  position: absolute;\n  inset: 0;\n  background: radial-gradient(ellipse at 30% 20%, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.55) 75%);\n  pointer-events: none;\n}\n\n.fr-bg-scrim {\n  position: absolute;\n  inset: 0;\n  background: linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.05) 30%, rgba(0, 0, 0, 0.55) 100%);\n  pointer-events: none;\n}\n\n/* --- stage.css --- */\n/* ---------------- Layout & Album Art ---------------- */\n.fr-stage {\n  position: relative;\n  z-index: 2;\n  height: 100%;\n  display: grid;\n  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);\n  grid-template-rows: 1fr;\n  grid-template-areas: \"art lyrics\";\n  padding: clamp(24px, 3.2vw, 64px);\n  padding-bottom: clamp(100px, 14vh, 160px);\n  gap: clamp(16px, 2vw, 40px);\n  opacity: 0;\n  transform: translateY(24px) scale(0.98);\n  transition: grid-template-columns 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), gap 0.8s, opacity 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms, transform 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms;\n}\n\n#fullscreen-reloaded-root.fr-open .fr-stage {\n  opacity: 1;\n  transform: translateY(0) scale(1);\n}\n\n.fr-stage.fr-centered {\n  grid-template-columns: 1fr;\n  grid-template-areas: \"art\";\n}\n\n.fr-stage.fr-centered .fr-lyrics-panel {\n  display: none;\n}\n\n/* ---------------- Album art ---------------- */\n.fr-art-panel {\n  grid-area: art;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 0;\n  min-width: 0;\n}\n\n.fr-art-wrap {\n  position: relative;\n  width: min(58vh, 44vw, 640px);\n  aspect-ratio: 1 / 1;\n  transition: width 300ms ease;\n}\n\n.fr-stage.fr-size-medium .fr-art-wrap { width: min(48vh, 35vw, 520px); }\n.fr-stage.fr-size-small .fr-art-wrap { width: min(38vh, 28vw, 420px); }\n.fr-stage.fr-centered .fr-art-wrap { width: min(62vh, 40vw, 720px); }\n\n.fr-art-img {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  border-radius: var(--fr-radius);\n  box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.65);\n  opacity: 0;\n  transform: scale(0.985);\n  transition: opacity 520ms ease, transform 520ms cubic-bezier(.2, .8, .2, 1), box-shadow 300ms ease;\n}\n\n.fr-art-img.fr-art-active {\n  opacity: 1;\n  transform: scale(1);\n}\n\n.fr-art-wrap.fr-no-shadow .fr-art-img {\n  box-shadow: none;\n}\n\n.fr-art-wrap.fr-glow::after {\n  content: \"\";\n  position: absolute;\n  inset: -6%;\n  border-radius: calc(var(--fr-radius) + 10px);\n  background: var(--fr-art-glow, transparent);\n  filter: blur(48px);\n  opacity: 0.55;\n  z-index: -1;\n  transition: background 700ms ease;\n}\n\n.fr-art-wrap:hover .fr-art-img {\n  transform: scale(1.012);\n}\n\n.fr-meta {\n  margin-top: clamp(18px, 2vw, 32px);\n  text-align: left;\n  max-width: min(58vh, 44vw, 640px);\n  transition: opacity 300ms ease, transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n\n.fr-meta.fr-meta-animating {\n  opacity: 0;\n  transform: translateY(8px);\n}\n\n.fr-stage.fr-centered .fr-meta {\n  text-align: center;\n  margin-left: auto;\n  margin-right: auto;\n}\n\n.fr-title {\n  font-size: clamp(22px, 2.4vw, 38px);\n  font-weight: 700;\n  letter-spacing: -0.01em;\n  line-height: 1.15;\n  margin: 0 0 6px 0;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.fr-artist {\n  font-size: clamp(14px, 1.2vw, 18px);\n  color: var(--fr-fg-dim);\n  margin: 0 0 2px 0;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.fr-album {\n  font-size: clamp(12px, 1vw, 15px);\n  color: var(--fr-fg-faint);\n  margin: 0;\n}\n\n/* ---------------- Progress Ring ---------------- */\n.fr-progress-ring {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  overflow: visible;\n  pointer-events: none;\n  z-index: 3;\n  transform: rotate(-90deg);\n  transform-origin: center;\n  opacity: 0;\n  transition: opacity 400ms ease;\n}\n\n#fullscreen-reloaded-root.fr-open .fr-progress-ring {\n  opacity: 0.75;\n}\n\n.fr-progress-ring-rect {\n  fill: transparent;\n  stroke: var(--fr-word-accent, #fff);\n  stroke-width: 4;\n  stroke-linecap: round;\n  stroke-dasharray: 100;\n  stroke-dashoffset: 100;\n  transition: stroke-dashoffset 0.1s linear, stroke 0.3s ease;\n}\n\n/* --- lyrics.css --- */\n/* ---------------- Lyrics Panel (True Per-Line & Per-Word Waterfall Engine) ---------------- */\n.fr-lyrics-panel {\n  grid-area: lyrics;\n  position: relative;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n}\n\n/* ---------------- \"Provided by\" 3-Second Startup Badge ---------------- */\n.fr-provider-badge {\n  position: absolute;\n  top: 10px;\n  left: 14px;\n  z-index: 8;\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  padding: 6px 14px;\n  border-radius: 999px;\n  background: rgba(18, 18, 24, 0.74);\n  backdrop-filter: blur(28px) saturate(1.8);\n  -webkit-backdrop-filter: blur(28px) saturate(1.8);\n  border: 1px solid rgba(255, 255, 255, 0.15);\n  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42), inset 0 1px 1px rgba(255, 255, 255, 0.16);\n  pointer-events: none;\n  opacity: 0;\n  transform: translate3d(0, -10px, 0) scale(0.96);\n  transition: opacity 400ms cubic-bezier(0.22, 1, 0.36, 1),\n              transform 400ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n\n.fr-provider-badge.fr-show {\n  opacity: 1;\n  transform: translate3d(0, 0, 0) scale(1);\n}\n\n.fr-provider-dot {\n  width: 6px;\n  height: 6px;\n  border-radius: 50%;\n  background: #30d158;\n  box-shadow: 0 0 8px rgba(48, 209, 88, 0.85);\n  flex-shrink: 0;\n}\n\n.fr-provider-prefix {\n  font-size: 11.5px;\n  font-weight: 500;\n  color: rgba(255, 255, 255, 0.58);\n}\n\n.fr-provider-name {\n  font-size: 12px;\n  font-weight: 700;\n  color: #ffffff;\n}\n\n.fr-provider-tag {\n  font-size: 9.5px;\n  font-weight: 700;\n  text-transform: uppercase;\n  letter-spacing: 0.05em;\n  padding: 2px 7px;\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.13);\n  color: rgba(255, 255, 255, 0.88);\n}\n\n/* ---------------- Scroll & Waterfall Viewport ---------------- */\n.fr-lyrics-scroll {\n  --fr-word-step: 120ms;\n  --fr-word-dur: 1050ms;\n  --fr-line-dur: 1050ms;\n  --fr-word-drop-future: -9px;\n  --fr-word-drop-past: 7px;\n  flex: 1;\n  overflow: hidden;\n  position: relative;\n  mask-image: linear-gradient(\n    180deg,\n    transparent 0%,\n    rgba(0, 0, 0, 0.45) 8%,\n    #000 20%,\n    #000 80%,\n    rgba(0, 0, 0, 0.45) 92%,\n    transparent 100%\n  );\n  -webkit-mask-image: linear-gradient(\n    180deg,\n    transparent 0%,\n    rgba(0, 0, 0, 0.45) 8%,\n    #000 20%,\n    #000 80%,\n    rgba(0, 0, 0, 0.45) 92%,\n    transparent 100%\n  );\n  padding: 6vh 14px 40vh 14px;\n  scrollbar-width: none;\n  opacity: 0;\n  transition: opacity 420ms ease;\n}\n\n.fr-lyrics-scroll[data-waterfall=\"intense\"] {\n  --fr-word-step: 165ms;\n  --fr-word-dur: 1350ms;\n  --fr-line-dur: 1280ms;\n  --fr-word-drop-future: -13px;\n  --fr-word-drop-past: 10px;\n}\n\n.fr-lyrics-scroll[data-waterfall=\"off\"] {\n  --fr-word-step: 0ms;\n  --fr-word-dur: 500ms;\n  --fr-line-dur: 550ms;\n  --fr-word-drop-future: 0px;\n  --fr-word-drop-past: 0px;\n}\n\n.fr-lyrics-scroll.fr-unsynced {\n  overflow-y: auto;\n  padding: 14vh 14px 28vh 14px;\n}\n\n.fr-lyrics-scroll.fr-ready {\n  opacity: 1;\n}\n\n.fr-lyrics-scroll::-webkit-scrollbar {\n  display: none;\n}\n\n/* ---------------- Per-Line Staggered Waterfall Positioning ---------------- */\n.fr-lyric-line {\n  --fr-scale: 0.94;\n  font-size: clamp(20px, 2.35vw, 31px);\n  font-weight: 600;\n  letter-spacing: -0.01em;\n  line-height: 1.48;\n  color: rgba(255, 255, 255, 0.32);\n  margin: 4px 0;\n  padding: 10px 14px;\n  border-radius: 16px;\n  transform-origin: left center;\n  transform: translate3d(0, var(--fr-cascade-y, 0px), 0) scale(var(--fr-scale));\n  filter: blur(0px);\n  transition:\n    transform var(--fr-line-dur, 1050ms) cubic-bezier(0.25, 0.46, 0.45, 0.94) var(--fr-stagger, 0ms),\n    color 650ms cubic-bezier(0.25, 0.46, 0.45, 0.94) var(--fr-stagger, 0ms),\n    opacity 680ms cubic-bezier(0.25, 0.46, 0.45, 0.94) var(--fr-stagger, 0ms),\n    filter 680ms cubic-bezier(0.25, 0.46, 0.45, 0.94) var(--fr-stagger, 0ms),\n    background-color 250ms ease;\n  cursor: default;\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n  will-change: transform, filter, opacity;\n}\n\n.fr-lyrics-scroll.fr-no-transition .fr-lyric-line,\n.fr-lyrics-scroll.fr-no-transition .fr-lyric-word {\n  transition: none !important;\n}\n\n.fr-lyrics-scroll.fr-user-scrolling .fr-lyric-line {\n  transition:\n    transform 90ms linear 0ms,\n    color 300ms ease 0ms,\n    filter 300ms ease 0ms !important;\n}\n\n/* Depth-of-field distance classes */\n.fr-lyric-line.fr-near-1 {\n  --fr-scale: 0.97;\n  color: rgba(255, 255, 255, 0.42);\n  filter: blur(0.5px);\n}\n\n.fr-lyric-line.fr-near-2 {\n  --fr-scale: 0.945;\n  color: rgba(255, 255, 255, 0.28);\n  filter: blur(1.3px);\n}\n\n.fr-lyric-line.fr-far {\n  --fr-scale: 0.92;\n  color: rgba(255, 255, 255, 0.18);\n  filter: blur(2.2px);\n}\n\n.fr-lyrics-scroll[data-waterfall=\"off\"] .fr-lyric-line {\n  filter: none !important;\n}\n\n.fr-lyric-line.fr-active {\n  --fr-scale: 1.02;\n  color: #ffffff;\n  filter: blur(0px);\n}\n\n/* ---------------- Top-to-Bottom Word Waterfall Flow (Line-Synced Mode) ---------------- */\n.fr-lyric-word {\n  display: inline-block;\n  white-space: pre-wrap;\n  color: inherit;\n}\n\n/* ---------------- Full-Sentence Top-to-Bottom Waterfall Flow (Line-Synced 'synced' Mode) ---------------- */\n/* Flows continuously from the top of the first letter ('b') across the whole sentence\n   down to the bottom of the last letter ('m') over the full bar duration. */\n.fr-lyric-sentence {\n  display: inline-block;\n  white-space: pre-wrap;\n  color: inherit;\n}\n\n.fr-lyrics-scroll.fr-mode-line .fr-lyric-line.fr-future .fr-lyric-sentence {\n  transform: translate3d(0, var(--fr-word-drop-future), 0);\n  opacity: 0.78;\n  transition:\n    transform var(--fr-word-dur, 1050ms) cubic-bezier(0.25, 0.46, 0.45, 0.94),\n    opacity 680ms ease;\n}\n\n.fr-lyrics-scroll.fr-mode-line .fr-lyric-line.fr-active .fr-lyric-sentence {\n  color: transparent;\n  background-image: linear-gradient(\n    168deg,\n    #ffffff 0%,\n    #ffffff calc(var(--bar-pct, -14%) - 18%),\n    rgba(255, 255, 255, 0.88) calc(var(--bar-pct, -14%) - 3%),\n    rgba(255, 255, 255, 0.32) calc(var(--bar-pct, -14%) + 16%),\n    rgba(255, 255, 255, 0.32) 100%\n  );\n  -webkit-background-clip: text;\n  background-clip: text;\n  -webkit-text-fill-color: transparent;\n  transform: translate3d(0, var(--bar-flow-y, var(--fr-word-drop-future)), 0);\n  filter: drop-shadow(0 3px 18px rgba(255, 255, 255, 0.28));\n  will-change: transform, background-image;\n}\n\n.fr-lyrics-scroll.fr-mode-line .fr-lyric-line.fr-past .fr-lyric-sentence {\n  color: inherit;\n  -webkit-text-fill-color: currentColor;\n  background-image: none;\n  transform: translate3d(0, var(--fr-word-drop-past), 0);\n  opacity: 0.65;\n  filter: none;\n  transition:\n    transform var(--fr-word-dur, 1050ms) cubic-bezier(0.25, 0.46, 0.45, 0.94),\n    opacity 720ms ease;\n}\n\n/* ---------------- Top-to-Bottom Word Waterfall Flow (Word-Synced / Karaoke Mode) ---------------- */\n/* Uses the exact same silky waterfall drop & glow aesthetic as line-synced mode,\n   triggered at each word's exact studio timestamp (w.startMs -> w.endMs). */\n.fr-lyrics-scroll.fr-mode-word .fr-lyric-line.fr-future .fr-lyric-word {\n  transform: translate3d(0, var(--fr-word-drop-future), 0);\n  opacity: 0.72;\n  transition:\n    transform var(--fr-word-dur, 1050ms) cubic-bezier(0.25, 0.46, 0.45, 0.94),\n    opacity 680ms ease,\n    color 680ms ease,\n    text-shadow 680ms ease;\n}\n\n.fr-lyrics-scroll.fr-mode-word .fr-lyric-line.fr-active {\n  color: rgba(255, 255, 255, 0.36);\n}\n\n/* Unsung word inside active line: poised above (-9px) in soft muted white, waiting for its timestamp */\n.fr-lyrics-scroll.fr-mode-word .fr-lyric-line.fr-active .fr-lyric-word {\n  color: rgba(255, 255, 255, 0.36);\n  opacity: 0.78;\n  transform: translate3d(0, var(--fr-word-drop-future), 0);\n  text-shadow: none;\n  transition:\n    transform var(--w-dur, 920ms) cubic-bezier(0.22, 0.61, 0.36, 1),\n    opacity var(--w-dur, 760ms) cubic-bezier(0.22, 0.61, 0.36, 1),\n    color var(--w-dur, 760ms) cubic-bezier(0.22, 0.61, 0.36, 1),\n    text-shadow var(--w-dur, 760ms) ease;\n}\n\n/* Word currently being sung: glides down smoothly to 0px and blooms with white light */\n.fr-lyrics-scroll.fr-mode-word .fr-lyric-line.fr-active .fr-lyric-word.fr-w-active {\n  color: #ffffff;\n  opacity: 1;\n  transform: translate3d(0, -1.5px, 0) scale(1.015);\n  text-shadow: 0 0 18px rgba(255, 255, 255, 0.52), 0 3px 22px rgba(255, 255, 255, 0.34);\n}\n\n/* Word finished being sung: rests cleanly at 0px in full bright white */\n.fr-lyrics-scroll.fr-mode-word .fr-lyric-line.fr-active .fr-lyric-word.fr-w-done {\n  color: #ffffff;\n  opacity: 1;\n  transform: translate3d(0, 0px, 0) scale(1);\n  text-shadow: 0 3px 22px rgba(255, 255, 255, 0.32);\n}\n\n/* Past line in word-synced mode: words cascade gently downward (+7px) just like line-synced mode */\n.fr-lyrics-scroll.fr-mode-word .fr-lyric-line.fr-past .fr-lyric-word {\n  transform: translate3d(0, var(--fr-word-drop-past), 0);\n  opacity: 0.65;\n  text-shadow: none;\n  transition:\n    transform var(--fr-word-dur, 1050ms) cubic-bezier(0.25, 0.46, 0.45, 0.94) calc(var(--w-idx, 0) * 75ms),\n    opacity 720ms ease calc(var(--w-idx, 0) * 75ms);\n}\n\n/* Interactive hover for synced lines */\n.fr-lyric-line.fr-synced {\n  cursor: pointer;\n}\n\n.fr-lyric-line.fr-synced:hover {\n  background-color: rgba(255, 255, 255, 0.05);\n  color: rgba(255, 255, 255, 0.85);\n  filter: blur(0px);\n}\n\n/* ---------------- Unsynced Teleprompter Mode ---------------- */\n.fr-lyrics-scroll.fr-unsynced .fr-lyric-line {\n  font-size: clamp(19px, 2.2vw, 28px);\n  font-weight: 500;\n  line-height: 1.6;\n  color: rgba(255, 255, 255, 0.84);\n  transform: none !important;\n  filter: none !important;\n  padding: 8px 14px;\n}\n\n.fr-lyrics-scroll.fr-unsynced .fr-lyric-word {\n  transform: none !important;\n  opacity: 1 !important;\n}\n\n/* ---------------- Instrumental Symbol & Apple Music Interlude Dots (• • •) ---------------- */\n.fr-lyric-line.fr-is-music {\n  padding: 16px 14px;\n}\n\n.fr-interlude-dots {\n  display: flex;\n  width: 100%;\n  align-items: center;\n  gap: 10px;\n  height: 0;\n  opacity: 0;\n  overflow: hidden;\n  margin-bottom: 0;\n  transform: translate3d(0, -6px, 0) scale(0.75);\n  transform-origin: left center;\n  pointer-events: none;\n  transition:\n    height 420ms cubic-bezier(0.22, 1, 0.36, 1),\n    margin-bottom 420ms cubic-bezier(0.22, 1, 0.36, 1),\n    opacity 380ms ease,\n    transform 420ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n\n.fr-interlude-dots.fr-inline-music-dots {\n  height: 28px;\n  opacity: 0.45;\n  overflow: visible;\n  transform: scale(0.9);\n}\n\n.fr-interlude-dots.fr-interlude-active {\n  height: 28px;\n  margin-bottom: 10px;\n  opacity: 1;\n  overflow: visible;\n  transform: translate3d(0, 0, 0) scale(1);\n}\n\n.fr-interlude-dot {\n  width: 11px;\n  height: 11px;\n  border-radius: 50%;\n  background: #ffffff;\n  opacity: 0.25;\n  box-shadow: 0 0 14px rgba(255, 255, 255, 0.55);\n  transition: opacity 150ms linear;\n  will-change: transform, opacity;\n}\n\n/* ---------------- Resume Sync Pill ---------------- */\n.fr-resume-sync {\n  position: absolute;\n  bottom: 12px;\n  left: 50%;\n  transform: translateX(-50%);\n  background: rgba(24, 24, 30, 0.78);\n  backdrop-filter: blur(20px);\n  -webkit-backdrop-filter: blur(20px);\n  border: 1px solid rgba(255, 255, 255, 0.16);\n  color: #ffffff;\n  padding: 8px 18px;\n  border-radius: 999px;\n  font-size: 12.5px;\n  font-weight: 600;\n  cursor: pointer;\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 220ms ease, transform 220ms ease;\n  z-index: 9;\n}\n\n.fr-resume-sync.fr-show {\n  opacity: 1;\n  pointer-events: auto;\n  transform: translateX(-50%) translateY(-4px);\n}\n\n.fr-resume-sync:hover {\n  background: rgba(255, 255, 255, 0.18);\n}\n\n/* ---------------- Instrumental / No-Lyrics Panel ---------------- */\n.fr-instrumental {\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  transform: translate(-50%, -50%) scale(0.85);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 20px;\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);\n  z-index: 3;\n}\n\n.fr-instrumental.fr-show {\n  opacity: 1;\n  transform: translate(-50%, -50%) scale(1);\n}\n\n.fr-instrumental-bars {\n  display: flex;\n  align-items: flex-end;\n  gap: 5px;\n  height: 44px;\n}\n\n.fr-instrumental-bar {\n  width: 5px;\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.75);\n  animation: instrBar 1.2s ease-in-out infinite alternate;\n}\n\n.fr-instrumental-bar:nth-child(1) { animation-delay: 0s;    animation-duration: 0.9s; }\n.fr-instrumental-bar:nth-child(2) { animation-delay: 0.15s; animation-duration: 1.1s; }\n.fr-instrumental-bar:nth-child(3) { animation-delay: 0.3s;  animation-duration: 0.8s; }\n.fr-instrumental-bar:nth-child(4) { animation-delay: 0.1s;  animation-duration: 1.3s; }\n.fr-instrumental-bar:nth-child(5) { animation-delay: 0.25s; animation-duration: 1.0s; }\n.fr-instrumental-bar:nth-child(6) { animation-delay: 0.4s;  animation-duration: 0.85s; }\n.fr-instrumental-bar:nth-child(7) { animation-delay: 0.05s; animation-duration: 1.2s; }\n\n@keyframes instrBar {\n  0%   { height: 6px; opacity: 0.35; }\n  100% { height: 40px; opacity: 0.95; }\n}\n\n.fr-instrumental-label {\n  font-size: 12px;\n  font-weight: 600;\n  color: rgba(255, 255, 255, 0.48);\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}\n\n/* --- controls.css --- */\n/* ---------------- Bottom Dock (Controls + Volume + Queue) ---------------- */\n.fr-bottom-bar {\n  position: absolute;\n  bottom: clamp(24px, 3.2vw, 40px);\n  left: 50%;\n  transform: translateX(-50%);\n  width: min(92vw, 1000px);\n  background: rgba(30, 30, 35, 0.35);\n  backdrop-filter: blur(60px) saturate(2.5);\n  border: none;\n  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.2), inset 0 -1px 1px rgba(0, 0, 0, 0.1);\n  border-radius: 999px;\n  padding: 12px 28px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 32px;\n  z-index: 5;\n  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n\n#fullscreen-reloaded-root.fr-idle .fr-bottom-bar {\n  opacity: 0;\n  pointer-events: none;\n  transform: translate(-50%, 40px) scale(0.95);\n}\n\n.fr-controls-left,\n.fr-controls-right {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.fr-controls-center {\n  flex: 1;\n  display: flex;\n  align-items: center;\n  gap: 16px;\n  font-size: 12px;\n  color: var(--fr-fg-dim);\n  font-variant-numeric: tabular-nums;\n}\n\n.fr-progress-bar {\n  flex: 1;\n  height: 6px;\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.12);\n  position: relative;\n  cursor: pointer;\n  overflow: hidden;\n}\n\n.fr-progress-bar:hover {\n  overflow: visible;\n}\n\n.fr-progress-fill {\n  position: absolute;\n  inset: 0 auto 0 0;\n  width: 0%;\n  border-radius: 999px;\n  background: var(--fr-fg);\n}\n\n.fr-progress-bar:hover .fr-progress-fill {\n  background: var(--fr-word-accent, #ffffff);\n}\n\n.fr-progress-handle {\n  position: absolute;\n  top: 50%;\n  width: 14px;\n  height: 14px;\n  border-radius: 50%;\n  background: var(--fr-fg);\n  left: 0%;\n  transform: translate(-50%, -50%) scale(0);\n  transition: transform 120ms ease;\n  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);\n}\n\n.fr-progress-bar:hover .fr-progress-handle {\n  transform: translate(-50%, -50%) scale(1);\n}\n\n.fr-btn {\n  background: transparent;\n  border: none;\n  color: var(--fr-fg-dim);\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 10px;\n  border-radius: 50%;\n  transition: color 150ms ease, transform 100ms ease, background 150ms ease;\n}\n\n.fr-btn:hover {\n  color: var(--fr-fg);\n  background: rgba(255, 255, 255, 0.08);\n}\n\n.fr-btn:active {\n  transform: scale(0.92);\n}\n\n.fr-btn.fr-active {\n  color: var(--fr-word-accent, #1ed760);\n}\n\n.fr-btn-play {\n  width: 48px;\n  height: 48px;\n  background: var(--fr-fg);\n  color: #000;\n}\n\n.fr-btn-play:hover {\n  background: var(--fr-fg);\n  transform: scale(1.04);\n  color: #000;\n}\n\n.fr-btn svg {\n  width: 22px;\n  height: 22px;\n}\n\n.fr-btn-play svg {\n  width: 24px;\n  height: 24px;\n}\n\n.fr-volume-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  width: 140px;\n}\n\n.fr-volume-bar {\n  flex: 1;\n  height: 6px;\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.12);\n  position: relative;\n  cursor: pointer;\n  overflow: hidden;\n}\n\n.fr-volume-bar:hover {\n  overflow: visible;\n}\n\n.fr-volume-fill {\n  position: absolute;\n  inset: 0 auto 0 0;\n  width: 100%;\n  border-radius: 999px;\n  background: var(--fr-fg);\n  transition: width 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n\n.fr-volume-bar:hover .fr-volume-fill {\n  background: var(--fr-word-accent, #ffffff);\n}\n\n.fr-volume-handle {\n  position: absolute;\n  top: 50%;\n  width: 14px;\n  height: 14px;\n  border-radius: 50%;\n  background: var(--fr-fg);\n  left: 100%;\n  transform: translate(-50%, -50%) scale(0);\n  transition: transform 150ms ease, left 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);\n  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);\n}\n\n.fr-volume-bar:hover .fr-volume-handle {\n  transform: translate(-50%, -50%) scale(1);\n}\n\n/* --- topbar.css --- */\n/* ---------------- Top bar ---------------- */\n.fr-topbar {\n  position: absolute;\n  top: clamp(18px, 2.4vw, 36px);\n  right: clamp(18px, 2.4vw, 36px);\n  z-index: 14;\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  background: rgba(30, 30, 35, 0.35);\n  backdrop-filter: blur(60px) saturate(2.5);\n  border-radius: 999px;\n  padding: 6px 8px;\n  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2), inset 0 -1px 1px rgba(0, 0, 0, 0.1);\n  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n\n#fullscreen-reloaded-root.fr-idle .fr-topbar {\n  opacity: 0;\n  pointer-events: none;\n  transform: translateY(-20px) scale(0.95);\n}\n\n.fr-topbar .fr-btn {\n  padding: 8px;\n  border-radius: 50%;\n  width: 36px;\n  height: 36px;\n}\n\n.fr-topbar .fr-btn svg {\n  width: 18px;\n  height: 18px;\n}\n\n.fr-topbar-sep {\n  width: 1px;\n  height: 20px;\n  background: rgba(255, 255, 255, 0.12);\n  margin: 0 2px;\n}\n\n.fr-topbar .fr-btn.fr-active {\n  color: var(--fr-word-accent, #1ed760);\n}\n\n.fr-topbar .fr-btn.fr-heart-active {\n  color: #ff4d6a;\n}\n\n/* --- settings.css --- */\n/* ---------------- Settings panel (Liquid Glass) ---------------- */\n.fr-settings-panel {\n  position: absolute;\n  top: clamp(60px, 6vw, 84px);\n  right: clamp(18px, 2.4vw, 36px);\n  z-index: 25;\n  width: min(360px, 92vw);\n  max-height: min(84vh, 700px);\n  overflow-y: auto;\n  overflow-x: hidden;\n  scrollbar-width: thin;\n  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;\n  background: rgba(24, 24, 30, 0.85);\n  backdrop-filter: blur(50px) saturate(2);\n  -webkit-backdrop-filter: blur(50px) saturate(2);\n  border: 1px solid rgba(255, 255, 255, 0.14);\n  border-radius: 28px;\n  padding: 22px 24px;\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.2), inset 0 -1px 1px rgba(0, 0, 0, 0.1);\n  opacity: 0;\n  pointer-events: none;\n  transform: translateY(-10px) scale(0.96);\n  transform-origin: top right;\n  transition: opacity 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n\n.fr-settings-panel::-webkit-scrollbar {\n  width: 5px;\n}\n.fr-settings-panel::-webkit-scrollbar-track {\n  background: transparent;\n}\n.fr-settings-panel::-webkit-scrollbar-thumb {\n  background: rgba(255, 255, 255, 0.2);\n  border-radius: 999px;\n}\n.fr-settings-panel::-webkit-scrollbar-thumb:hover {\n  background: rgba(255, 255, 255, 0.35);\n}\n\n.fr-settings-panel.fr-show {\n  opacity: 1;\n  pointer-events: auto;\n  transform: translateY(0) scale(1);\n}\n\n.fr-settings-section {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n\n.fr-settings-divider {\n  height: 1px;\n  background: rgba(255, 255, 255, 0.08);\n  margin: 2px 0;\n}\n\n.fr-settings-title {\n  font-size: 11px;\n  font-weight: 800;\n  color: rgba(255, 255, 255, 0.45);\n  text-transform: uppercase;\n  letter-spacing: 0.1em;\n  margin: 0 0 2px 0;\n}\n\n.fr-settings-row {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  min-height: 32px;\n}\n\n.fr-settings-row label {\n  font-size: 14px;\n  font-weight: 500;\n  color: rgba(255, 255, 255, 0.9);\n  user-select: none;\n}\n\n/* ---------------- Custom Liquid Glass Dropdown ---------------- */\n.fr-select-wrap {\n  position: relative;\n  display: inline-block;\n}\n\n.fr-select-btn {\n  background: rgba(255, 255, 255, 0.09);\n  backdrop-filter: blur(20px);\n  -webkit-backdrop-filter: blur(20px);\n  border: 1px solid rgba(255, 255, 255, 0.14);\n  color: var(--fr-fg);\n  border-radius: 999px;\n  padding: 6px 14px;\n  font-family: inherit;\n  font-size: 13px;\n  font-weight: 600;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);\n  user-select: none;\n  outline: none;\n  max-width: 170px;\n}\n\n.fr-select-btn:hover {\n  background: rgba(255, 255, 255, 0.16);\n  border-color: rgba(255, 255, 255, 0.28);\n  transform: scale(1.02);\n}\n\n.fr-select-btn:active {\n  transform: scale(0.97);\n}\n\n.fr-select-wrap.fr-open .fr-select-btn {\n  background: rgba(255, 255, 255, 0.18);\n  border-color: rgba(255, 255, 255, 0.38);\n  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);\n}\n\n.fr-select-label {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.fr-select-arrow {\n  width: 16px;\n  height: 16px;\n  fill: currentColor;\n  flex-shrink: 0;\n  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n\n.fr-select-wrap.fr-open .fr-select-arrow {\n  transform: rotate(180deg);\n}\n\n.fr-select-menu {\n  position: absolute;\n  top: calc(100% + 6px);\n  right: 0;\n  width: max-content;\n  min-width: 190px;\n  max-width: 285px;\n  max-height: 260px;\n  overflow-y: auto;\n  overflow-x: hidden;\n  scrollbar-width: thin;\n  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;\n  background: rgba(20, 20, 26, 0.96);\n  backdrop-filter: blur(44px) saturate(2);\n  -webkit-backdrop-filter: blur(44px) saturate(2);\n  border: 1px solid rgba(255, 255, 255, 0.16);\n  border-radius: 18px;\n  padding: 6px;\n  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.18);\n  z-index: 100;\n  opacity: 0;\n  pointer-events: none;\n  transform: translateY(-8px) scale(0.95);\n  transform-origin: top right;\n  transition: opacity 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n\n.fr-select-menu::-webkit-scrollbar {\n  width: 4px;\n}\n.fr-select-menu::-webkit-scrollbar-thumb {\n  background: rgba(255, 255, 255, 0.25);\n  border-radius: 999px;\n}\n\n.fr-select-wrap.fr-open .fr-select-menu {\n  opacity: 1;\n  pointer-events: auto;\n  transform: translateY(0) scale(1);\n}\n\n.fr-select-item {\n  padding: 8px 12px;\n  border-radius: 12px;\n  font-size: 13px;\n  font-weight: 500;\n  color: rgba(255, 255, 255, 0.86);\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 14px;\n  transition: all 0.15s ease;\n  user-select: none;\n}\n\n.fr-select-item-left {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  min-width: 0;\n}\n\n.fr-select-item-title {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.fr-select-item-sub {\n  font-size: 10px;\n  font-weight: 500;\n  color: rgba(255, 255, 255, 0.45);\n  letter-spacing: 0.01em;\n  white-space: nowrap;\n}\n\n.fr-select-item-right {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  flex-shrink: 0;\n}\n\n.fr-select-item-badge {\n  font-size: 10px;\n  font-weight: 700;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n  padding: 2px 7px;\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.09);\n  border: 1px solid rgba(255, 255, 255, 0.12);\n  color: rgba(255, 255, 255, 0.72);\n}\n\n.fr-select-item:hover {\n  background: rgba(255, 255, 255, 0.11);\n  color: #ffffff;\n}\n\n.fr-select-item.fr-selected {\n  background: rgba(255, 255, 255, 0.16);\n  color: #ffffff;\n  font-weight: 600;\n}\n\n.fr-select-item.fr-selected .fr-select-item-badge {\n  background: rgba(255, 255, 255, 0.2);\n  border-color: rgba(255, 255, 255, 0.32);\n  color: #ffffff;\n}\n\n.fr-select-item .fr-check {\n  width: 14px;\n  height: 14px;\n  fill: #ffffff;\n  flex-shrink: 0;\n  opacity: 0;\n}\n\n.fr-select-item.fr-selected .fr-check {\n  opacity: 1;\n}\n\n/* ---------------- Custom Liquid Glass Color Picker ---------------- */\n.fr-color-picker-wrap {\n  position: relative;\n  display: inline-block;\n}\n\n.fr-color-swatch-btn {\n  background: rgba(255, 255, 255, 0.09);\n  backdrop-filter: blur(20px);\n  -webkit-backdrop-filter: blur(20px);\n  border: 1px solid rgba(255, 255, 255, 0.14);\n  color: var(--fr-fg, #ffffff);\n  border-radius: 999px;\n  padding: 5px 12px 5px 6px;\n  font-family: inherit;\n  font-size: 13px;\n  font-weight: 600;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);\n  user-select: none;\n  outline: none;\n}\n\n.fr-color-swatch-btn:hover {\n  background: rgba(255, 255, 255, 0.16);\n  border-color: rgba(255, 255, 255, 0.28);\n  transform: scale(1.03);\n}\n\n.fr-color-swatch-btn:active {\n  transform: scale(0.97);\n}\n\n.fr-color-picker-wrap.fr-open .fr-color-swatch-btn {\n  background: rgba(255, 255, 255, 0.22);\n  border-color: var(--fr-word-accent, #1ed760);\n  box-shadow: 0 0 16px rgba(30, 215, 96, 0.25);\n}\n\n.fr-color-swatch-inner {\n  width: 20px;\n  height: 20px;\n  border-radius: 50%;\n  border: 1.5px solid rgba(255, 255, 255, 0.35);\n  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);\n  flex-shrink: 0;\n  transition: background-color 0.2s ease;\n}\n\n.fr-color-hex-label {\n  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;\n  font-size: 12px;\n  letter-spacing: 0.04em;\n  color: rgba(255, 255, 255, 0.9);\n}\n\n.fr-color-popup {\n  position: absolute;\n  top: calc(100% + 8px);\n  right: 0;\n  width: 240px;\n  max-height: 480px;\n  overflow-y: auto;\n  scrollbar-width: none;\n  background: rgba(22, 22, 28, 0.96);\n  backdrop-filter: blur(40px) saturate(2);\n  -webkit-backdrop-filter: blur(40px) saturate(2);\n  border: 1px solid rgba(255, 255, 255, 0.16);\n  border-radius: 22px;\n  padding: 16px;\n  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.2);\n  z-index: 100;\n  opacity: 0;\n  pointer-events: none;\n  transform: translateY(-8px) scale(0.95);\n  transform-origin: top right;\n  transition: opacity 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n\n.fr-color-popup::-webkit-scrollbar {\n  display: none;\n}\n\n.fr-color-picker-wrap.fr-open .fr-color-popup {\n  opacity: 1;\n  pointer-events: auto;\n  transform: translateY(0) scale(1);\n}\n\n.fr-color-popup-title {\n  font-size: 10px;\n  font-weight: 800;\n  color: rgba(255, 255, 255, 0.45);\n  text-transform: uppercase;\n  letter-spacing: 0.1em;\n  margin-top: 2px;\n}\n\n.fr-color-preset-grid {\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  gap: 10px;\n  justify-items: center;\n}\n\n.fr-color-preset-item {\n  width: 34px;\n  height: 34px;\n  border-radius: 50%;\n  border: 1.5px solid rgba(255, 255, 255, 0.2);\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 0;\n  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);\n  transition: transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.15s ease, box-shadow 0.15s ease;\n  outline: none;\n}\n\n.fr-color-preset-item:hover {\n  transform: scale(1.18);\n  border-color: rgba(255, 255, 255, 0.7);\n  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);\n}\n\n.fr-color-preset-item.fr-selected {\n  border-color: #ffffff;\n  box-shadow: 0 0 14px rgba(255, 255, 255, 0.6);\n  transform: scale(1.12);\n}\n\n.fr-check-sm {\n  width: 14px;\n  height: 14px;\n  fill: #ffffff;\n  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9));\n  opacity: 0;\n  transition: opacity 0.15s ease;\n}\n\n.fr-color-preset-item.fr-selected .fr-check-sm {\n  opacity: 1;\n}\n\n/* ---------------- Rainbow Hue Slider ---------------- */\n.fr-hue-slider-wrap {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding: 4px 0 2px 0;\n}\n\n.fr-hue-slider {\n  -webkit-appearance: none;\n  appearance: none;\n  width: 100%;\n  height: 12px;\n  border-radius: 999px;\n  background: linear-gradient(\n    to right,\n    #ff0000 0%,\n    #ffff00 17%,\n    #00ff00 33%,\n    #00ffff 50%,\n    #0000ff 67%,\n    #ff00ff 83%,\n    #ff0000 100%\n  );\n  outline: none;\n  cursor: pointer;\n  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);\n  border: 1px solid rgba(255, 255, 255, 0.15);\n}\n\n.fr-hue-slider::-webkit-slider-thumb {\n  -webkit-appearance: none;\n  appearance: none;\n  width: 18px;\n  height: 18px;\n  border-radius: 50%;\n  background: #ffffff;\n  border: 2px solid rgba(0, 0, 0, 0.4);\n  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);\n  cursor: pointer;\n  transition: transform 0.15s ease;\n}\n\n.fr-hue-slider::-webkit-slider-thumb:hover {\n  transform: scale(1.2);\n}\n\n.fr-color-custom-row {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding-top: 8px;\n  border-top: 1px solid rgba(255, 255, 255, 0.08);\n}\n\n.fr-color-wheel-btn {\n  background: transparent;\n  border: none;\n  padding: 0;\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  outline: none;\n  border-radius: 50%;\n  transition: transform 0.2s ease;\n}\n\n.fr-color-wheel-btn:hover {\n  transform: scale(1.15);\n}\n\n.fr-color-wheel-btn:active {\n  transform: scale(0.95);\n}\n\n.fr-color-preview-circle {\n  width: 28px;\n  height: 28px;\n  border-radius: 50%;\n  border: 2px solid rgba(255, 255, 255, 0.4);\n  flex-shrink: 0;\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);\n}\n\n.fr-color-text-input {\n  flex: 1;\n  background: rgba(255, 255, 255, 0.08);\n  border: 1px solid rgba(255, 255, 255, 0.15);\n  border-radius: 10px;\n  padding: 6px 12px;\n  color: #ffffff;\n  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;\n  font-size: 13px;\n  font-weight: 600;\n  letter-spacing: 0.05em;\n  outline: none;\n  transition: border-color 0.2s ease, background 0.2s ease;\n}\n\n.fr-color-text-input:focus {\n  border-color: var(--fr-word-accent, #1ed760);\n  background: rgba(255, 255, 255, 0.14);\n}\n\n.fr-color-input {\n  -webkit-appearance: none;\n  appearance: none;\n  border: 2px solid rgba(255, 255, 255, 0.22);\n  width: 32px;\n  height: 32px;\n  border-radius: 50%;\n  cursor: pointer;\n  background: transparent;\n  padding: 0;\n  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);\n  transition: transform 0.2s ease, border-color 0.2s ease;\n  outline: none;\n}\n\n.fr-color-input:hover {\n  transform: scale(1.12);\n  border-color: rgba(255, 255, 255, 0.6);\n}\n\n.fr-color-input::-webkit-color-swatch-wrapper {\n  padding: 0;\n}\n\n.fr-color-input::-webkit-color-swatch {\n  border: none;\n  border-radius: 50%;\n}\n\n/* ---------------- Toggles ---------------- */\n.fr-toggle {\n  width: 48px;\n  height: 26px;\n  border-radius: 999px;\n  background: rgba(0, 0, 0, 0.3);\n  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 1px rgba(255, 255, 255, 0.05);\n  position: relative;\n  cursor: pointer;\n  border: none;\n  outline: none;\n  transition: background 0.3s ease;\n  flex-shrink: 0;\n}\n\n.fr-toggle::after {\n  content: \"\";\n  position: absolute;\n  top: 3px;\n  left: 3px;\n  width: 20px;\n  height: 20px;\n  border-radius: 50%;\n  background: #ffffff;\n  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);\n  transition: left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n\n.fr-toggle.fr-on {\n  background: var(--fr-word-accent, #1ed760);\n  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 1px rgba(255, 255, 255, 0.05);\n}\n\n.fr-toggle.fr-on::after {\n  left: 25px;\n}\n\n/* --- ambient.css --- */\n/* ---------------- Ambient Effects ---------------- */\n.fr-ambient {\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n  z-index: 1;\n  overflow: hidden;\n  mix-blend-mode: screen;\n  opacity: 0;\n  transition: opacity 2s ease;\n}\n\n.fr-ambient.fr-show {\n  opacity: 0.55;\n}\n\n.fr-orb {\n  position: absolute;\n  border-radius: 50%;\n  filter: blur(80px);\n  opacity: 0.6;\n  animation: floatOrb 20s infinite alternate ease-in-out;\n}\n\n@keyframes floatOrb {\n  0% { transform: translate(0, 0) scale(1); }\n  100% { transform: translate(100px, -100px) scale(1.2); }\n}\n\n.fr-particle {\n  position: absolute;\n  border-radius: 50%;\n  opacity: 0;\n  animation: floatUp linear infinite;\n}\n\n@keyframes floatUp {\n  0% { transform: translateY(110vh) scale(0.5); opacity: 0; }\n  20% { opacity: 0.3; }\n  80% { opacity: 0.3; }\n  100% { transform: translateY(-10vh) scale(1.5); opacity: 0; }\n}\n\n/* --- upnext.css --- */\n/* ---------------- Up Next Card ---------------- */\n.fr-up-next {\n  position: absolute;\n  bottom: clamp(24px, 3.2vw, 64px);\n  right: clamp(24px, 3.2vw, 64px);\n  background: rgba(30, 30, 35, 0.35);\n  backdrop-filter: blur(60px) saturate(2.5);\n  border: none;\n  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.2), inset 0 -1px 1px rgba(0, 0, 0, 0.1);\n  border-radius: 999px;\n  padding: 12px 24px 12px 12px;\n  display: flex;\n  align-items: center;\n  gap: 16px;\n  z-index: 10;\n  transform: translateX(120%);\n  opacity: 0;\n  transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.6s ease;\n  pointer-events: auto;\n  cursor: pointer;\n}\n\n.fr-up-next.fr-show {\n  transform: translateX(0);\n  opacity: 1;\n}\n\n.fr-up-next-img {\n  width: 48px;\n  height: 48px;\n  border-radius: 50%;\n  object-fit: cover;\n  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);\n}\n\n.fr-up-next-info {\n  display: flex;\n  flex-direction: column;\n  max-width: 200px;\n}\n\n.fr-up-next-label {\n  font-size: 10px;\n  font-weight: 700;\n  color: var(--fr-fg-dim);\n  text-transform: uppercase;\n  letter-spacing: 0.05em;\n  margin-bottom: 2px;\n}\n\n.fr-up-next-title {\n  font-size: 14px;\n  font-weight: 700;\n  color: var(--fr-fg);\n  margin: 0 0 2px 0;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.fr-up-next-artist {\n  font-size: 12px;\n  color: var(--fr-fg-faint);\n  margin: 0;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n#fullscreen-reloaded-root.fr-idle .fr-up-next {\n  opacity: 0;\n  pointer-events: none;\n}\n\n/* --- idle.css --- */\n/* ---------------- Idle Mode & Clock ---------------- */\n#fullscreen-reloaded-root.fr-idle,\n#fullscreen-reloaded-root.fr-idle * {\n  cursor: none !important;\n}\n\n#fullscreen-reloaded-root.fr-idle .fr-controls,\n#fullscreen-reloaded-root.fr-idle .fr-topbar,\n#fullscreen-reloaded-root.fr-idle .fr-side-controls,\n#fullscreen-reloaded-root.fr-idle .fr-settings-panel,\n#fullscreen-reloaded-root.fr-idle .fr-resume-sync {\n  opacity: 0;\n  pointer-events: none;\n  transform: translateY(12px);\n}\n\n.fr-controls,\n.fr-topbar,\n.fr-side-controls,\n.fr-settings-panel,\n.fr-resume-sync {\n  transition: opacity 400ms ease, transform 400ms ease;\n}\n\n/* ---------------- Clock & Idle Cinema Mode ---------------- */\n.fr-clock {\n  position: absolute;\n  left: 50%;\n  font-size: clamp(50px, 6vw, 80px);\n  font-weight: 700;\n  color: rgba(255, 255, 255, 0.9);\n  opacity: 0;\n  pointer-events: none;\n  z-index: 10;\n  letter-spacing: 0.02em;\n  text-shadow: 0 4px 32px rgba(0, 0, 0, 0.7);\n  font-variant-numeric: tabular-nums;\n  line-height: 1;\n}\n\n.fr-clock.fr-pos-top {\n  top: clamp(24px, 4.5vh, 48px);\n  bottom: auto;\n  transform: translateX(-50%) translateY(-20px);\n  transition: opacity 0.8s ease, transform 0.8s ease, top 0.4s;\n}\n\n.fr-clock.fr-pos-bottom {\n  bottom: clamp(28px, 5vh, 56px);\n  top: auto;\n  transform: translateX(-50%) translateY(20px);\n  transition: opacity 0.8s ease, transform 0.8s ease, bottom 0.4s;\n}\n\n#fullscreen-reloaded-root.fr-idle .fr-clock.fr-pos-top,\n#fullscreen-reloaded-root.fr-idle .fr-clock.fr-pos-bottom {\n  opacity: 1;\n  transform: translateX(-50%) translateY(0);\n}\n\n#fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics=\"true\"]) .fr-stage {\n  grid-template-columns: 1fr 0px;\n  gap: 0;\n}\n\n#fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics=\"true\"]) .fr-lyrics-panel {\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.8s ease;\n}\n\n/* Gracefully scale artwork in idle mode to prevent clock collision */\n#fullscreen-reloaded-root.fr-idle .fr-art-wrap {\n  width: min(48vh, 38vw, 520px);\n  transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n\n/* Shift artwork cleanly away from clock */\n#fullscreen-reloaded-root.fr-idle[data-clock=\"top\"] .fr-art-panel {\n  transform: translateY(clamp(45px, 7vh, 80px));\n  transition: transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n\n#fullscreen-reloaded-root.fr-idle[data-clock=\"bottom\"] .fr-art-panel {\n  transform: translateY(clamp(-45px, -7vh, -80px));\n  transition: transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n\n#fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics=\"true\"]) .fr-meta {\n  text-align: center;\n  margin-left: auto;\n  margin-right: auto;\n  margin-top: clamp(20px, 2.8vh, 36px);\n}\n\n#fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics=\"true\"]) .fr-title {\n  font-size: clamp(28px, 3.2vw, 44px);\n}\n\n#fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics=\"true\"]) .fr-artist {\n  font-size: clamp(16px, 1.6vw, 22px);\n}\n\n/* ---------------- Responsive Styles ---------------- */\n@media (max-aspect-ratio: 5/4), (max-width: 900px) {\n  .fr-stage {\n    grid-template-columns: 1fr;\n    grid-template-rows: auto 1fr;\n    grid-template-areas: \"art\" \"lyrics\";\n    gap: 16px;\n    padding-top: clamp(24px, 4vh, 40px);\n  }\n\n  .fr-stage.fr-centered {\n    grid-template-rows: 1fr;\n  }\n\n  .fr-lyrics-panel {\n    display: flex;\n  }\n\n  .fr-lyrics-scroll {\n    padding: 4vh 4px 15vh 4px;\n  }\n\n  .fr-art-wrap {\n    width: min(35vh, 65vw, 400px);\n    margin: 0 auto;\n  }\n\n  .fr-meta {\n    text-align: center;\n    margin-left: auto;\n    margin-right: auto;\n    max-width: 80vw;\n  }\n\n  /* Make bottom dock more compact */\n  .fr-bottom-bar {\n    gap: 12px;\n    padding: 12px 16px;\n    width: 94vw;\n  }\n\n  .fr-volume-row {\n    width: 90px;\n  }\n\n  /* Override idle grid for portrait */\n  #fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics=\"true\"]) .fr-stage {\n    grid-template-columns: 1fr;\n    grid-template-rows: 1fr;\n  }\n\n  #fullscreen-reloaded-root.fr-idle[data-clock=\"top\"] .fr-art-panel {\n    transform: translateY(clamp(30px, 5vh, 60px));\n  }\n\n  #fullscreen-reloaded-root.fr-idle[data-clock=\"bottom\"] .fr-art-panel {\n    transform: translateY(clamp(-30px, -5vh, -60px));\n  }\n}\n\n@media (max-width: 600px) {\n  .fr-controls-center {\n    display: none; /* Hide progress bar on small screens */\n  }\n}\n\n@media (max-height: 500px) {\n  .fr-stage {\n    grid-template-columns: 1fr;\n    grid-template-rows: 1fr;\n    grid-template-areas: \"art\";\n  }\n\n  .fr-lyrics-panel {\n    display: none !important;\n  }\n\n  .fr-art-wrap {\n    width: min(46vh, 60vw, 420px);\n  }\n}\n";

function injectStyles() {
  const ID = "fullscreen-reloaded-styles";
  if (document.getElementById(ID)) return;
  const style = document.createElement("style");
  style.id = ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

async function bootstrap() {
  // 1. Wait for Spicetify Player & Platform APIs (Spotify 1.3.6 compatible)
  await SpicetifyBridge.waitForReady();

  // 2. Load stored user settings
  Settings.load();

  // 3. Inject Liquid Glass styles
  injectStyles();

  // 4. Mount application overlay
  App.mount();

  console.log("[Fullscreen Reloaded] v1.3.6 initialized successfully");
}

bootstrap().catch((err) => {
  console.error("[Fullscreen Reloaded] Failed to bootstrap:", err);
});

    },

    "./services/AppleMusicAuth.js": function(require, exports, module) {
// --- ./services/AppleMusicAuth.js ---
/**
 * Apple Music authorization & developer token manager.
 */
const {  Settings  } = require("./utils/settings.js");

const AppleMusicAuth = exports.AppleMusicAuth = {
  storefront: "us",
  _devToken: null,
  _devTokenExpires: 0,
  _musicKitLoading: null,

  async getDeveloperToken() {
    if (this._devToken && Date.now() < this._devTokenExpires) {
      return this._devToken;
    }
    const cached = this._readCache();
    if (cached) {
      this._devToken = cached.token;
      this._devTokenExpires = cached.expires;
      return this._devToken;
    }
    try {
      const proxyUrl =
        "https://corsproxy.io/?url=" + encodeURIComponent("https://music.apple.com/us/browse");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const html = await fetch(proxyUrl, { signal: controller.signal }).then((r) => (r.ok ? r.text() : ""));
      clearTimeout(timer);
      const token = this._extractFromMetaTag(html) || this._extractFromRawJwt(html);
      if (!token) return null;

      this._devToken = token;
      this._devTokenExpires = Date.now() + 12 * 60 * 60 * 1000; // re-check every 12h
      this._writeCache(token, this._devTokenExpires);
      return token;
    } catch (e) {
      return null;
    }
  },

  _extractFromMetaTag(html) {
    const match = html.match(/<meta name="desktop-music-app\/config\/environment" content="([^"]+)"/);
    if (!match) return null;
    try {
      const config = JSON.parse(decodeURIComponent(match[1]));
      return (config && config.MEDIA_API && config.MEDIA_API.token) || null;
    } catch (e) {
      return null;
    }
  },

  _extractFromRawJwt(html) {
    const match = html.match(
      /eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IldlYlBsYXlLaWQifQ\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
    );
    return match ? match[0] : null;
  },

  _readCache() {
    try {
      const raw = window.localStorage.getItem("fullscreen-reloaded:apple-dev-token");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.expires < Date.now()) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  },

  _writeCache(token, expires) {
    try {
      window.localStorage.setItem(
        "fullscreen-reloaded:apple-dev-token",
        JSON.stringify({ token, expires })
      );
    } catch (e) {
      /* ignore */
    }
  },

  getUserToken() {
    return Settings.get("appleMusicUserToken") || null;
  },

  isConnected() {
    return !!this.getUserToken();
  },

  disconnect() {
    Settings.set("appleMusicUserToken", null);
  },

  async loadMusicKit() {
    if (window.MusicKit) return window.MusicKit;
    if (this._musicKitLoading) return this._musicKitLoading;
    this._musicKitLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
      script.async = true;
      script.onload = () => resolve(window.MusicKit);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return this._musicKitLoading;
  },

  async connect() {
    const devToken = await this.getDeveloperToken();
    if (!devToken) {
      if (typeof Spicetify !== "undefined" && Spicetify.showNotification) {
        Spicetify.showNotification("Apple Music'e ulaşılamadı, tekrar deneyin.");
      }
      return false;
    }
    try {
      const MusicKit = await this.loadMusicKit();
      await MusicKit.configure({
        developerToken: devToken,
        app: { name: "Fullscreen Reloaded", build: "1.3.6" },
      });
      const instance = MusicKit.getInstance();
      const userToken = await instance.authorize();
      Settings.set("appleMusicUserToken", userToken);
      if (typeof Spicetify !== "undefined" && Spicetify.showNotification) {
        Spicetify.showNotification("Apple Music bağlandı.");
      }
      return true;
    } catch (e) {
      if (typeof Spicetify !== "undefined" && Spicetify.showNotification) {
        Spicetify.showNotification("Apple Music bağlantısı başarısız oldu.");
      }
      return false;
    }
  },
};

    },

    "./services/ColorExtractor.js": function(require, exports, module) {
// --- ./services/ColorExtractor.js ---
/**
 * Extracts dominant and accent colors from album artwork using canvas quantization.
 */

const ColorExtractor = exports.ColorExtractor = {
  cache: new Map(),
  MAX_CACHE: 30,

  async extract(imageUrl) {
    if (!imageUrl) return this.fallback();
    if (this.cache.has(imageUrl)) return this.cache.get(imageUrl);

    try {
      const img = await this.loadImage(imageUrl);
      const result = this.quantize(img);
      if (this.cache.size >= this.MAX_CACHE) {
        this.cache.delete(this.cache.keys().next().value);
      }
      this.cache.set(imageUrl, result);
      return result;
    } catch (e) {
      return this.fallback();
    }
  },

  fallback() {
    return { dominant: [16, 16, 20], accent: [255, 255, 255], dark: [8, 8, 10] };
  },

  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  },

  quantize(img) {
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return this.fallback();

    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2],
        a = data[i + 3];
      if (a < 128) continue;
      const key = [r >> 4, g >> 4, b >> 4].join(",");
      const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
      buckets.set(key, bucket);
    }

    const colors = [...buckets.values()]
      .map((b) => ({ r: b.r / b.n, g: b.g / b.n, b: b.b / b.n, n: b.n }))
      .sort((a, b) => b.n - a.n);

    if (!colors.length) return this.fallback();

    const dominant = colors[0];
    const bySaturation = [...colors].sort((a, b) => this.saturation(b) - this.saturation(a));
    const rawAccent = bySaturation[0] || dominant;
    const accent = this.ensureLegible(rawAccent);

    return {
      dominant: [dominant.r, dominant.g, dominant.b],
      accent: accent,
      dark: this.darken(dominant, 0.35),
    };
  },

  ensureLegible(c) {
    if (!c) return [255, 255, 255];
    let r = c.r !== undefined ? c.r : c[0];
    let g = c.g !== undefined ? c.g : c[1];
    let b = c.b !== undefined ? c.b : c[2];

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 165) {
      const boost = Math.max(1.6, 175 / Math.max(lum, 1));
      r = Math.min(255, Math.round(r * boost + 50));
      g = Math.min(255, Math.round(g * boost + 50));
      b = Math.min(255, Math.round(b * boost + 50));
    }
    return [r, g, b];
  },

  saturation(c) {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    return max === 0 ? 0 : (max - min) / max;
  },

  darken(c, factor) {
    return [c.r * factor, c.g * factor, c.b * factor];
  },
};

    },

    "./services/LyricsService.js": function(require, exports, module) {
// --- ./services/LyricsService.js ---
/**
 * Lyrics orchestration service.
 * Manages provider priority chain and resolves lyrics for the active track.
 */
const {  SpotifyLyricsProvider  } = require("./services/providers/SpotifyLyricsProvider.js");
const {  LrclibLyricsProvider  } = require("./services/providers/LrclibLyricsProvider.js");
const {  GeniusLyricsProvider  } = require("./services/providers/GeniusLyricsProvider.js");
const {  AppleMusicLyricsProvider  } = require("./services/providers/AppleMusicLyricsProvider.js");
const {  AppleMusicAuth  } = require("./services/AppleMusicAuth.js");
const {  Settings  } = require("./utils/settings.js");

const _lyricsCache = new Map();
const _inflight = new Map();

const LyricsService = exports.LyricsService = {
  providers: {
    applemusic: new AppleMusicLyricsProvider(),
    lrclib: new LrclibLyricsProvider(),
    genius: new GeniusLyricsProvider(),
    spotify: new SpotifyLyricsProvider(),
  },

  getOrderedProviders() {
    const pref = Settings.get("lyricsProvider") || "auto";

    if (pref === "applemusic") return [this.providers.applemusic];
    if (pref === "lrclib") return [this.providers.lrclib];
    if (pref === "genius") return [this.providers.genius];
    if (pref === "spotify") return [this.providers.spotify];

    // Requested order for "auto": Apple Music -> LRCLIB -> Genius -> Spotify
    return [
      this.providers.applemusic,
      this.providers.lrclib,
      this.providers.genius,
      this.providers.spotify,
    ];
  },

  clearCache() {
    _lyricsCache.clear();
    _inflight.clear();
  },

  _cacheResult(trackKey, result) {
    if (!trackKey || !result) return;
    if (_lyricsCache.size > 100) {
      const firstKey = _lyricsCache.keys().next().value;
      _lyricsCache.delete(firstKey);
    }
    _lyricsCache.set(trackKey, result);
  },

  async resolve(track) {
    if (!track) return { type: "none", lines: [] };
    const trackKey = track.uri || (track.name + "_" + (track.artists?.[0]?.name || ""));

    // 1. Instant Cache hit (0ms)
    if (trackKey && _lyricsCache.has(trackKey)) {
      return _lyricsCache.get(trackKey);
    }

    // 2. Deduplicate concurrent calls for the same track
    if (trackKey && _inflight.has(trackKey)) {
      return _inflight.get(trackKey);
    }

    const promise = this._resolveInternal(track, trackKey);
    if (trackKey) {
      _inflight.set(trackKey, promise);
    }

    try {
      return await promise;
    } finally {
      if (trackKey) {
        _inflight.delete(trackKey);
      }
    }
  },

  async _resolveInternal(track, trackKey) {
    const pref = Settings.get("lyricsProvider") || "auto";

    if (pref === "auto") {
      let unsyncedCandidate = null;

      // 1. Apple Music (word-synced / synced)
      try {
        const amRes = await this.providers.applemusic.fetch(track);
        if (amRes && amRes.lines?.length) {
          if (amRes.type === "synced" || amRes.type === "word-synced") {
            this._cacheResult(trackKey, amRes);
            return amRes;
          }
          unsyncedCandidate = amRes;
        }
      } catch (_) {}

      // 2. LRCLIB & Spotify (start Spotify in background so there is zero wait if LRCLIB misses)
      const spotifyPromise = this.providers.spotify.fetch(track).catch(() => null);
      try {
        const lrcRes = await this.providers.lrclib.fetch(track);
        if (lrcRes && lrcRes.lines?.length) {
          if (lrcRes.type === "synced" || lrcRes.type === "word-synced") {
            this._cacheResult(trackKey, lrcRes);
            return lrcRes;
          }
          if (!unsyncedCandidate) unsyncedCandidate = lrcRes;
        }
      } catch (_) {}

      // Check if Spotify has SYNCED lyrics before hitting Genius CORS proxy
      try {
        const spRes = await spotifyPromise;
        if (spRes && spRes.lines?.length) {
          if (spRes.type === "synced" || spRes.type === "word-synced") {
            this._cacheResult(trackKey, spRes);
            return spRes;
          }
          // Hold Spotify unsynced at lower priority than Genius
          var spotifyUnsynced = spRes;
        }
      } catch (_) {}

      // 3. Genius (unsynced lyrics — higher priority than Spotify unsynced)
      if (!unsyncedCandidate) {
        try {
          const genRes = await this.providers.genius.fetch(track);
          if (genRes && genRes.lines?.length) {
            unsyncedCandidate = genRes;
          }
        } catch (_) {}
      }

      // 4. Fallback to unsynced candidate (Apple Music / LRCLIB / Genius) or Spotify unsynced
      const finalUnsynced = unsyncedCandidate || spotifyUnsynced || null;
      if (finalUnsynced) {
        this._cacheResult(trackKey, finalUnsynced);
        return finalUnsynced;
      }

      return { type: "none", lines: [] };
    }

    // Explicit single-provider selection
    const chain = this.getOrderedProviders();
    for (const provider of chain) {
      try {
        const result = await provider.fetch(track);
        if (result && result.lines && result.lines.length) {
          this._cacheResult(trackKey, result);
          return result;
        }
      } catch (_) {}
    }

    return { type: "none", lines: [] };
  },
};

    },

    "./services/providers/AppleMusicLyricsProvider.js": function(require, exports, module) {
// --- ./services/providers/AppleMusicLyricsProvider.js ---
/**
 * Apple Music lyrics provider.
 * Fetches studio word-level (TTML karaoke) and line-synced lyrics via open TTML catalog
 * (no user token required), with fallback to authenticated Apple Music catalog API.
 */
const {  BaseLyricsProvider  } = require("./services/providers/BaseLyricsProvider.js");
const {  AppleMusicAuth  } = require("./services/AppleMusicAuth.js");
const {  parseTTML  } = require("./utils/parsers.js");

class AppleMusicLyricsProvider extends BaseLyricsProvider {
  async fetch(track) {
    if (!track) return null;
    const meta = track.metadata || {};
    const rawTitle = meta.title || track.name || "";
    const artist = (track.artists && track.artists[0]?.name) || meta.artist_name?.split(",")[0]?.trim() || "";
    const durationSec = meta.duration ? Math.round(Number(meta.duration) / 1000) : 0;
    const durationMs = Number(meta.duration) || 0;

    if (!rawTitle || !artist) return null;

    const cleanTitle = rawTitle
      .replace(/\s*[\(\[](feat\.|featuring|with|remastered|remaster|deluxe|bonus track)[^\)\]]*[\)\]]/gi, "")
      .replace(/\s*-\s*(remastered|live|mono|stereo|bonus track).*/gi, "")
      .trim();

    const targetTitle = cleanTitle || rawTitle;

    // 1. Public Apple Music TTML Catalog (Zero Auth Required, Full CORS)
    const publicRes = await this._fetchPublicTTML(targetTitle, artist, durationSec);
    if (publicRes && publicRes.lines?.length) {
      return publicRes;
    }

    // 2. Fallback to authenticated Apple Music API if user configured Music-User-Token
    if (!AppleMusicAuth.isConnected()) return null;

    const devToken = await AppleMusicAuth.getDeveloperToken();
    if (!devToken) return null;

    const songId = await this.findSongId(devToken, targetTitle, artist, durationMs);
    if (!songId) return null;

    const userToken = AppleMusicAuth.getUserToken();
    const headers = {
      Authorization: `Bearer ${devToken}`,
      Origin: "https://music.apple.com",
    };
    if (userToken) {
      headers["Music-User-Token"] = userToken;
    }

    let res = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      res = await fetch(
        `https://amp-api.music.apple.com/v1/catalog/${AppleMusicAuth.storefront}/songs/${songId}/lyrics`,
        { headers, signal: controller.signal }
      ).then((r) => (r.ok ? r.json() : null));
      clearTimeout(timeoutId);
    } catch (e) {
      return null;
    }

    const ttml = res && res.data && res.data[0] && res.data[0].attributes && res.data[0].attributes.ttml;
    if (!ttml) return null;

    const lines = parseTTML(ttml);
    if (!lines.length) return null;

    const wordSynced = lines.some((l) => l.isWordSynced);
    return {
      type: wordSynced ? "word-synced" : "synced",
      source: "Apple Music",
      lines,
    };
  }

  async _fetchPublicTTML(title, artist, durationSec = 0) {
    try {
      const params = new URLSearchParams({
        track: title,
        artist: artist,
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2200);
      const r = await fetch(`https://lyrics-api.binimum.org/?${params.toString()}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!r.ok) return null;

      const data = await r.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      if (!results.length) return null;

      const normArtist = artist.toLowerCase();
      // Filter out unrelated artists and 'none' timing entries
      const valid = results.filter((item) => {
        if (!item || !item.lyricsUrl || item.timing_type === "none") return false;
        const itemArtist = (item.artist_name || "").toLowerCase();
        return itemArtist.includes(normArtist) || normArtist.includes(itemArtist);
      });

      const pool = valid.length ? valid : results.filter((item) => item?.lyricsUrl && item.timing_type !== "none");
      if (!pool.length) return null;

      // Sort: prefer duration within 12s, and strongly prefer timing_type === 'word' over 'line'
      pool.sort((a, b) => {
        const diffA = durationSec > 0 ? Math.abs((Number(a.duration) || 0) - durationSec) : 0;
        const diffB = durationSec > 0 ? Math.abs((Number(b.duration) || 0) - durationSec) : 0;
        const closeA = diffA <= 12 ? 1 : 0;
        const closeB = diffB <= 12 ? 1 : 0;
        if (closeA !== closeB) return closeB - closeA;

        const wordA = a.timing_type === "word" ? 1 : 0;
        const wordB = b.timing_type === "word" ? 1 : 0;
        if (wordA !== wordB) return wordB - wordA;

        return diffA - diffB;
      });

      const best = pool[0];
      const ttmlCtrl = new AbortController();
      const ttmlTimer = setTimeout(() => ttmlCtrl.abort(), 2200);
      const ttmlRes = await fetch(best.lyricsUrl, { signal: ttmlCtrl.signal });
      clearTimeout(ttmlTimer);
      if (!ttmlRes.ok) return null;

      const ttmlText = await ttmlRes.text();
      if (!ttmlText || !ttmlText.includes("<p")) return null;

      const lines = parseTTML(ttmlText);
      if (!lines.length) return null;

      const wordSynced = best.timing_type === "word" && lines.some((l) => l.isWordSynced);
      return {
        type: wordSynced ? "word-synced" : "synced",
        source: "Apple Music",
        lines,
      };
    } catch (e) {
      return null;
    }
  }

  async findSongId(devToken, title, artist, durationMs) {
    const term = encodeURIComponent(`${title} ${artist}`);
    let res = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      res = await fetch(
        `https://amp-api.music.apple.com/v1/catalog/${AppleMusicAuth.storefront}/search?term=${term}&types=songs&limit=5`,
        { headers: { Authorization: `Bearer ${devToken}`, Origin: "https://music.apple.com" }, signal: controller.signal }
      ).then((r) => (r.ok ? r.json() : null));
      clearTimeout(timer);
    } catch (e) {
      return null;
    }

    const songs = res && res.results && res.results.songs && res.results.songs.data;
    if (!songs || !songs.length) return null;

    let best = songs[0];
    if (durationMs) {
      let bestDiff = Infinity;
      for (const s of songs) {
        const d = Number(s.attributes && s.attributes.durationInMillis) || 0;
        const diff = Math.abs(d - durationMs);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = s;
        }
      }
    }
    return best.id;
  }
}

// Exported classes
exports.AppleMusicLyricsProvider = AppleMusicLyricsProvider;

    },

    "./services/providers/BaseLyricsProvider.js": function(require, exports, module) {
// --- ./services/providers/BaseLyricsProvider.js ---
/**
 * Base Lyrics Provider abstraction.
 */

class BaseLyricsProvider {
  /**
   * @param {Object} track
   * @returns {Promise<{ type: "synced" | "word-synced" | "unsynced" | "none", source: string, lines: Array } | null>}
   */
  async fetch(track) {
    throw new Error("fetch() not implemented");
  }

  splitWords(text, lineStartMs) {
    const parts = (text || "").trim().split(/\s+/).filter(Boolean);
    return parts.map((w, idx) => ({
      text: idx < parts.length - 1 ? w + " " : w,
      startMs: lineStartMs,
    }));
  }
}

// Exported classes
exports.BaseLyricsProvider = BaseLyricsProvider;

    },

    "./services/providers/GeniusLyricsProvider.js": function(require, exports, module) {
// --- ./services/providers/GeniusLyricsProvider.js ---
/**
 * Genius lyrics provider.
 * Fetches unsynced lyrics through a CORS proxy to bypass Spotify CEF cross-origin restrictions.
 */
const {  BaseLyricsProvider  } = require("./services/providers/BaseLyricsProvider.js");

async function safeProxyFetch(targetUrl, timeoutMs = 1800) {
  const proxies = [
    (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  ];

  for (const getProxyUrl of proxies) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const proxyUrl = getProxyUrl(targetUrl);
      const res = await fetch(proxyUrl, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res && res.ok) {
        return res;
      }
    } catch (e) {
      clearTimeout(timer);
      // Try next proxy
    }
  }
  return null;
}

class GeniusLyricsProvider extends BaseLyricsProvider {
  async fetch(track) {
    if (!track) return null;
    const meta = track.metadata || {};
    const rawTitle = meta.title || track.name || "";
    const artist = (track.artists && track.artists[0]?.name) || meta.artist_name?.split(",")[0]?.trim() || "";

    if (!rawTitle || !artist) return null;

    // Clean title for search
    const cleanTitle = rawTitle
      .replace(/\s*[\(\[](feat\.|featuring|with|remastered|remaster|deluxe|bonus track)[^\)\]]*[\)\]]/gi, "")
      .replace(/\s*-\s*(remastered|live|mono|stereo|bonus track).*/gi, "")
      .trim();

    const query = `${cleanTitle || rawTitle} ${artist}`.trim();

    try {
      const searchUrl = `https://genius.com/api/search/multi?per_page=5&q=${encodeURIComponent(query)}`;
      const searchRes = await safeProxyFetch(searchUrl, 2500);
      if (!searchRes) return null;

      const data = await searchRes.json().catch(() => null);
      if (!data?.response?.sections) return null;

      const songSection = data.response.sections.find((s) => s.type === "song");
      if (!songSection || !songSection.hits?.length) return null;

      // Find best match among hits
      const hit = songSection.hits[0]?.result;
      if (!hit?.url) return null;

      // Fetch the song page through CORS proxy
      const pageRes = await safeProxyFetch(hit.url, 2500);
      if (!pageRes) return null;

      const html = await pageRes.text().catch(() => "");
      if (!html || !html.includes("data-lyrics-container")) return null;

      // Extract all data-lyrics-container divs
      const regex = /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi;
      let match;
      let rawLyrics = "";

      while ((match = regex.exec(html)) !== null) {
        let piece = match[1]
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#x27;/g, "'")
          .replace(/&quot;/g, '"');
        rawLyrics += piece + "\n\n";
      }

      if (!rawLyrics.trim()) return null;

      // Clean metadata headers, contributor counts, and embeds
      const linesText = rawLyrics
        .replace(/^.*Contributors.*$/gm, "")
        .replace(/^Translations.*$/gm, "")
        .replace(/^[0-9]*Embed$/gm, "")
        .replace(/Embed$/gm, "")
        .replace(/You might also like.*$/gm, "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (!linesText.length) return null;

      const lines = linesText.map((text) => ({
        startMs: 0,
        words: [{ text, startMs: null }],
      }));

      return {
        type: "unsynced",
        source: "Genius",
        lines,
      };
    } catch (e) {
      return null;
    }
  }
}

// Exported classes
exports.GeniusLyricsProvider = GeniusLyricsProvider;

    },

    "./services/providers/LrclibLyricsProvider.js": function(require, exports, module) {
// --- ./services/providers/LrclibLyricsProvider.js ---
/**
 * LRCLIB open lyrics provider (https://lrclib.net).
 * Free, open, no API key required. Line-synced and plain lyrics with 503 retry and cleaned search fallback.
 */
const {  BaseLyricsProvider  } = require("./services/providers/BaseLyricsProvider.js");
const {  parseLRC  } = require("./utils/parsers.js");

class LrclibLyricsProvider extends BaseLyricsProvider {
  async fetch(track) {
    if (!track) return null;
    const meta = track.metadata || {};
    const rawTitle = meta.title || track.name || "";
    const artist = (track.artists && track.artists[0]?.name) || meta.artist_name?.split(",")[0]?.trim() || "";
    const durationSec = meta.duration ? Math.round(Number(meta.duration) / 1000) : 0;

    if (!rawTitle || !artist) return null;

    // Clean title (strip features, remasters, bonus tracks)
    const cleanTitle = rawTitle
      .replace(/\s*[\(\[](feat\.|featuring|with|remastered|remaster|deluxe|bonus track)[^\)\]]*[\)\]]/gi, "")
      .replace(/\s*-\s*(remastered|live|mono|stereo|bonus track).*/gi, "")
      .trim();

    const targetTitle = cleanTitle || rawTitle;

    // 1. Single request to structured search (avoids 503 rate-limiting from concurrent bursts)
    const searchRes = await this._search(targetTitle, artist, durationSec);
    if (searchRes && searchRes.lines?.length) {
      return searchRes;
    }

    // 2. Fallback to free-text query search only if structured search returned nothing
    const qRes = await this._searchQuery(`${targetTitle} ${artist}`, durationSec);
    if (qRes && qRes.lines?.length) {
      return qRes;
    }

    return null;
  }

  async _search(title, artist, durationSec = 0) {
    const searchParams = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });
    return await this._tryFetch(`https://lrclib.net/api/search?${searchParams.toString()}`, true, durationSec);
  }

  async _searchQuery(query, durationSec = 0) {
    const params = new URLSearchParams({ q: query });
    return await this._tryFetch(`https://lrclib.net/api/search?${params.toString()}`, true, durationSec);
  }

  async _fetchJsonWithRetry(url) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2200);
        const r = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (r.ok) {
          return await r.json();
        }
        // Retry once on 503 Service Unavailable
        if (r.status === 503 && attempt === 0) {
          await new Promise((res) => setTimeout(res, 450));
          continue;
        }
        return null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  async _tryFetch(url, isSearch = false, durationSec = 0) {
    let res = await this._fetchJsonWithRetry(url);
    if (!res) return null;

    // In search results, prioritize items with syncedLyrics (closest in duration if known)
    if (isSearch && Array.isArray(res)) {
      if (!res.length) return null;
      const syncedItems = res.filter((item) => item && item.syncedLyrics && item.syncedLyrics.trim().length);
      if (syncedItems.length) {
        if (durationSec > 0) {
          syncedItems.sort(
            (a, b) => Math.abs((Number(a.duration) || 0) - durationSec) - Math.abs((Number(b.duration) || 0) - durationSec)
          );
        }
        res = syncedItems[0];
      } else {
        const plainItems = res.filter((item) => item && item.plainLyrics && item.plainLyrics.trim().length);
        res = plainItems[0] || null;
      }
    }
    if (!res) return null;

    if (res.syncedLyrics && res.syncedLyrics.trim().length) {
      const parsed = parseLRC(res.syncedLyrics);
      if (parsed.length) {
        const isWordSynced = parsed.some((l) => l.isWordSynced);
        return {
          type: isWordSynced ? "word-synced" : "synced",
          source: "LRCLIB",
          lines: parsed,
        };
      }
    }

    if (res.plainLyrics && res.plainLyrics.trim().length) {
      const lines = res.plainLyrics
        .split("\n")
        .filter((l) => l.trim().length)
        .map((text) => ({ startMs: 0, words: [{ text, startMs: null }] }));
      if (lines.length) {
        return {
          type: "unsynced",
          source: "LRCLIB",
          lines,
        };
      }
    }

    return null;
  }
}

// Exported classes
exports.LrclibLyricsProvider = LrclibLyricsProvider;

    },

    "./services/providers/SpotifyLyricsProvider.js": function(require, exports, module) {
// --- ./services/providers/SpotifyLyricsProvider.js ---
/**
 * Spotify native lyrics provider.
 * Updated for Spotify 1.3.6: supports both Spicetify.CosmosAsync and native fetch with session token.
 */
const {  BaseLyricsProvider  } = require("./services/providers/BaseLyricsProvider.js");
const {  SpicetifyBridge  } = require("./services/SpicetifyBridge.js");

class SpotifyLyricsProvider extends BaseLyricsProvider {
  async fetch(track) {
    if (!track || !track.uri) return null;
    const parts = track.uri.split(":");
    const id = parts[2] || parts[parts.length - 1];
    if (!id) return null;

    const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`;
    let res = null;

    // Strategy 1: CosmosAsync in Spicetify
    if (typeof Spicetify !== "undefined" && Spicetify.CosmosAsync?.get) {
      try {
        const cosmosPromise = Spicetify.CosmosAsync.get(url);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 1500));
        res = await Promise.race([cosmosPromise, timeoutPromise]);
        if (typeof res === "string") {
          try { res = JSON.parse(res); } catch (_) {}
        } else if (res && !res.lyrics && res.body) {
          res = typeof res.body === "string" ? JSON.parse(res.body) : res.body;
        }
      } catch (e) {
        // CosmosAsync failed or timed out, continue to Strategy 2
      }
    }

    // Strategy 2: Direct HTTP fetch with session access token (Spotify 1.3.6 compatible)
    if (!res || !res.lyrics) {
      try {
        const token = await SpicetifyBridge.getAccessToken();
        if (token) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1800);
          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              "app-platform": "WebPlayer",
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (response.ok) {
            res = await response.json();
          }
        }
      } catch (e) {
        // fetch failed or aborted
      }
    }

    if (!res || !res.lyrics || !Array.isArray(res.lyrics.lines)) {
      return null;
    }

    const syncType = res.lyrics.syncType; // "LINE_SYNCED" | "UNSYNCED" | "SYLLABLE_SYNCED"
    const isSynced = syncType === "LINE_SYNCED" || syncType === "SYLLABLE_SYNCED";
    let hasSyllables = false;

    const rawLines = res.lyrics.lines
      .map((l) => {
        const startMs = Number(l.startTimeMs) || 0;
        const rawText = typeof l.words === "string" ? l.words : "";

        // Check if Spotify provided syllable/word timings
        if (Array.isArray(l.syllables) && l.syllables.length > 0) {
          const syllableWords = [];
          let charCursor = 0;

          for (let i = 0; i < l.syllables.length; i++) {
            const syl = l.syllables[i];
            const sStart = Number(syl.startTimeMs ?? startMs);
            const sEnd = syl.endTimeMs != null ? Number(syl.endTimeMs) : null;
            let sylText = "";

            if (typeof syl.text === "string" && syl.text.length) {
              sylText = syl.text;
            } else if (syl.numChars != null && rawText.length) {
              const count = Number(syl.numChars) || 0;
              sylText = rawText.slice(charCursor, charCursor + count);
              charCursor += count;
              // Include trailing whitespace if present
              while (charCursor < rawText.length && /\s/.test(rawText[charCursor])) {
                sylText += rawText[charCursor];
                charCursor++;
              }
            }

            if (sylText.trim().length) {
              syllableWords.push({
                text: sylText.endsWith(" ") ? sylText : sylText + " ",
                startMs: sStart,
                endMs: sEnd,
                exactWordSync: true,
              });
            }
          }

          if (syllableWords.length > 0) {
            hasSyllables = true;
            return {
              startMs,
              isWordSynced: true,
              words: syllableWords,
            };
          }
        }

        const text = rawText.trim();
        return {
          startMs,
          words: this.splitWords(text, isSynced ? startMs : null),
        };
      })
      .filter((l) => l.words && l.words.length > 0);

    if (!rawLines.length) return null;

    return {
      type: hasSyllables ? "word-synced" : isSynced ? "synced" : "unsynced",
      source: "Spotify",
      lines: rawLines,
    };
  }
}

// Exported classes
exports.SpotifyLyricsProvider = SpotifyLyricsProvider;

    },

    "./services/SpicetifyBridge.js": function(require, exports, module) {
// --- ./services/SpicetifyBridge.js ---
/**
 * Bridge layer for interacting with Spicetify and Spotify Desktop 1.3.6.
 * Provides safe wrappers, token resolution, queue fetching, and event management.
 */

const SpicetifyBridge = exports.SpicetifyBridge = {
  REQUIRED_APIS: ["Player", "Platform"],

  /**
   * Safeguards Spicetify.showNotification in Spotify 1.3.6 against
   * "Error: enqueueSnackbar called with invalid argument" when webpack
   * modules (React / Snackbar.simpleLayout) are not yet initialized or
   * when third-party extensions (e.g. Marketplace / Spicy Lyrics) pass invalid args.
   */
  patchShowNotification() {
    if (typeof Spicetify === "undefined") return;
    if (typeof Spicetify.showNotification === "function" && !Spicetify.showNotification._frPatched) {
      const origShow = Spicetify.showNotification.bind(Spicetify);
      const patched = function (message, isError = false, msTimeout = 3000) {
        if (message === undefined || message === null || message === "") return;
        try {
          return origShow(message, isError, msTimeout);
        } catch (err) {
          try {
            const plainText =
              typeof message === "string"
                ? message.replace(/<[^>]*>/g, "").trim()
                : String(message);
            if (plainText && typeof Spicetify.Snackbar?.enqueueSnackbar === "function") {
              return Spicetify.Snackbar.enqueueSnackbar(plainText, {
                variant: isError ? "error" : "default",
                autoHideDuration: msTimeout,
              });
            }
          } catch (_) {
            // Suppress secondary enqueueSnackbar error in Spotify 1.3.6
          }
        }
      };
      patched._frPatched = true;
      Spicetify.showNotification = patched;
    }
  },

  /**
   * Waits for Spicetify and core APIs to become ready.
   * Unlike older versions, this does NOT block on deprecated APIs like CosmosAsync or Keyboard.
   */
  waitForReady(maxWaitMs = 15000) {
    const start = Date.now();
    this.patchShowNotification();
    return new Promise((resolve, reject) => {
      const check = () => {
        this.patchShowNotification();
        if (
          typeof Spicetify !== "undefined" &&
          this.REQUIRED_APIS.every((k) => typeof Spicetify[k] !== "undefined")
        ) {
          resolve(Spicetify);
          return;
        }
        if (Date.now() - start > maxWaitMs) {
          console.warn("[Fullscreen Reloaded] Timed out waiting for Spicetify APIs. Attempting launch anyway...");
          resolve(typeof Spicetify !== "undefined" ? Spicetify : null);
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });
  },

  /**
   * Retrieves Spotify session access token in Spotify 1.3.6.
   * Checks multiple fallback surfaces (Platform.Session, AuthorizationAPI).
   */
  async getAccessToken() {
    try {
      if (typeof Spicetify === "undefined") return null;

      if (typeof Spicetify.Platform?.Session?.accessToken === "string" && Spicetify.Platform.Session.accessToken) {
        return Spicetify.Platform.Session.accessToken;
      }

      if (Spicetify.Platform?.Session?.getAccessToken) {
        const res = await Spicetify.Platform.Session.getAccessToken();
        const token = typeof res === "string" ? res : res?.accessToken;
        if (token) return token;
      }

      if (Spicetify.Platform?.AuthorizationAPI?.getAccessToken) {
        const res = await Spicetify.Platform.AuthorizationAPI.getAccessToken();
        const token = typeof res === "string" ? res : res?.accessToken;
        if (token) return token;
      }
    } catch (e) {
      console.warn("[Fullscreen Reloaded] Could not retrieve session access token:", e);
    }
    return null;
  },

  /**
   * Fetches the upcoming queue tracks. Supports Spotify 1.3.6 PlayerAPI & legacy Spicetify.Queue.
   */
  async getNextTrack() {
    try {
      if (typeof Spicetify === "undefined") return null;

      // 1. Spicetify.Queue synchronous object
      if (Spicetify.Queue?.nextTracks?.length) {
        return Spicetify.Queue.nextTracks[0];
      }

      // 2. Spicetify.Platform.PlayerAPI synchronous internal queue
      if (Spicetify.Platform?.PlayerAPI?._queue?.nextTracks?.length) {
        return Spicetify.Platform.PlayerAPI._queue.nextTracks[0];
      }

      // 3. Spicetify.Platform.PlayerAPI asynchronous getter
      if (Spicetify.Platform?.PlayerAPI?.getQueue) {
        const q = await Spicetify.Platform.PlayerAPI.getQueue();
        if (q?.nextTracks?.length) return q.nextTracks[0];
      }
    } catch (e) {
      // silently fallback
    }
    return null;
  },

  /**
   * Gets current playback data / track metadata.
   */
  getCurrentTrack() {
    if (typeof Spicetify === "undefined" || !Spicetify.Player) return null;
    const data = Spicetify.Player.data;
    if (!data) return null;
    return data.track || data.item || null;
  },

  getDuration() {
    return (typeof Spicetify !== "undefined" && Spicetify.Player?.getDuration()) || 0;
  },

  getProgress() {
    return (typeof Spicetify !== "undefined" && Spicetify.Player?.getProgress()) || 0;
  },

  isPlaying() {
    return !!(typeof Spicetify !== "undefined" && Spicetify.Player?.isPlaying());
  },

  seek(ms) {
    if (typeof Spicetify !== "undefined" && Spicetify.Player?.seek) {
      Spicetify.Player.seek(Math.max(0, ms));
    }
  },

  togglePlay() {
    Spicetify?.Player?.togglePlay?.();
  },

  next() {
    Spicetify?.Player?.next?.();
  },

  back() {
    Spicetify?.Player?.back?.();
  },

  toggleShuffle() {
    Spicetify?.Player?.toggleShuffle?.();
  },

  getShuffle() {
    return !!Spicetify?.Player?.getShuffle?.();
  },

  toggleRepeat() {
    Spicetify?.Player?.toggleRepeat?.();
  },

  getRepeat() {
    return !!Spicetify?.Player?.getRepeat?.();
  },

  getVolume() {
    const v = Spicetify?.Player?.getVolume?.();
    return typeof v === "number" && !isNaN(v) ? Math.max(0, Math.min(1, v)) : 1;
  },

  setVolume(vol) {
    const clamped = Math.max(0, Math.min(1, vol));
    Spicetify?.Player?.setMute?.(false);
    Spicetify?.Player?.setVolume?.(clamped);
  },

  getMute() {
    return !!Spicetify?.Player?.getMute?.();
  },

  toggleMute() {
    Spicetify?.Player?.toggleMute?.();
  },

  setMute(mute) {
    Spicetify?.Player?.setMute?.(!!mute);
  },

  addPlayerListener(event, callback) {
    Spicetify?.Player?.addEventListener?.(event, callback);
    return () => Spicetify?.Player?.removeEventListener?.(event, callback);
  },

  /**
   * Safely opens Spotify Queue view.
   */
  openQueue() {
    if (Spicetify?.Platform?.History?.push) {
      Spicetify.Platform.History.push("/queue");
    } else if (Spicetify?.Player?.toggleQueue) {
      Spicetify.Player.toggleQueue();
    } else {
      window.location.hash = "/queue";
    }
  },

  /**
   * Determines whether a DOM element is Spotify's native fullscreen button.
   * Matches Spotify 1.3.6 selectors, aria-labels, and testids.
   */
  isSpotifyFullscreenButton(target) {
    if (!target || !(target instanceof Element)) return false;

    const selectors = [
      'button[data-testid="fullscreen-button"]',
      'button[data-testid="control-button-fullscreen"]',
      'button[data-testid="fullscreen-control"]',
      'button[data-testid="npv-fullscreen-button"]',
      "button.control-button--fullscreen",
      'button[aria-label*="ull screen" i]',
      'button[aria-label*="am ekran" i]',
      'button[aria-label*="fullscreen" i]',
      'button[aria-label*="tam ekran" i]',
    ];

    const btn = target.closest(selectors.join(", "));
    if (btn) return true;

    // Check if element is inside nowPlayingBar extra controls and has fullscreen SVG icon
    const extraControls = target.closest(
      '.main-nowPlayingBar-extraControls, [data-testid="now-playing-bar"], .now-playing-bar'
    );
    if (extraControls) {
      const button = target.closest("button");
      if (button) {
        const label = (button.getAttribute("aria-label") || "").toLowerCase();
        if (label.includes("screen") || label.includes("ekran") || label.includes("full")) {
          return true;
        }
      }
    }

    return false;
  },
};

    },

    "./utils/dom.js": function(require, exports, module) {
// --- ./utils/dom.js ---
/**
 * DOM utility helpers for creating and manipulating elements.
 */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function iconBtn(svg, onClick, extraClass) {
  const btn = document.createElement("button");
  btn.className = "fr-btn" + (extraClass ? " " + extraClass : "");
  btn.innerHTML = svg;
  btn.setAttribute("type", "button");
  if (onClick) {
    btn.addEventListener("click", onClick);
  }
  return btn;
}

function toggle(initial, onChange) {
  const btn = document.createElement("button");
  btn.setAttribute("type", "button");
  btn.className = "fr-toggle" + (initial ? " fr-on" : "");
  btn.addEventListener("click", () => {
    const next = !btn.classList.contains("fr-on");
    btn.classList.toggle("fr-on", next);
    if (onChange) onChange(next);
  });
  return btn;
}

// Exported functions
exports.el = el;
exports.iconBtn = iconBtn;
exports.toggle = toggle;

    },

    "./utils/formatters.js": function(require, exports, module) {
// --- ./utils/formatters.js ---
/**
 * String, time, and image formatters.
 */

function formatMs(ms) {
  if (!ms || ms < 0 || isNaN(ms)) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Resolves Spotify image strings or internal paths to loadable URLs.
 * Spotify 1.3.6 can return:
 * - Direct HTTP(S) URLs (e.g. https://i.scdn.co/image/...)
 * - Spotify URI hashes (e.g. spotify:image:ab67616d0000b273...)
 * - Raw 40-character hex hashes
 */
function resolveImageUrl(value) {
  if (!value || typeof value !== "string") return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }
  const hash = value.split(":").pop();
  if (!hash) return "";
  return `https://i.scdn.co/image/${hash}`;
}

function rgb(arr) {
  if (!arr || !arr.length) return "rgb(16, 16, 20)";
  return `rgb(${Math.round(arr[0])}, ${Math.round(arr[1])}, ${Math.round(arr[2])})`;
}

function rgba(arr, a) {
  if (!arr || !arr.length) return `rgba(16, 16, 20, ${a})`;
  return `rgba(${Math.round(arr[0])}, ${Math.round(arr[1])}, ${Math.round(arr[2])}, ${a})`;
}

// Exported functions
exports.formatMs = formatMs;
exports.resolveImageUrl = resolveImageUrl;
exports.rgb = rgb;
exports.rgba = rgba;

    },

    "./utils/i18n.js": function(require, exports, module) {
// --- ./utils/i18n.js ---
/**
 * Internationalization (i18n) and translations.
 */
const {  Settings  } = require("./utils/settings.js");

const Locales = exports.Locales = {
  en: {
    appearance: "Appearance",
    showLyrics: "Show Lyrics",
    idleLyrics: "Idle Mode Lyrics",
    ambientGlow: "Ambient Glow",
    glowShadow: "Glow Shadow",
    artworkRadius: "Artwork Radius",
    artworkSize: "Artwork Size",
    idleClockPos: "Idle Clock Pos",
    trackInfo: "Track Info",
    position: "Position",
    left: "Left",
    center: "Center",
    right: "Right",
    albumArt: "Album Art",
    trackTitle: "Track Title",
    artists: "Artists",
    albumName: "Album Name",
    background: "Background",
    mode: "Mode",
    gradient: "Gradient",
    dynamicGradient: "Dynamic Gradient",
    solidColor: "Solid Color",
    blurredArtwork: "Blurred Artwork",
    artwork: "Artwork",
    darkenedArtwork: "Darkened Artwork",
    customColor: "Custom Color",
    transitionSpeed: "Transition Speed",
    resumeSync: "Resume Sync",
    instrumental: "Instrumental",
    unknownTitle: "Unknown title",
    unknownArtist: "Unknown artist",
    upNext: "UP NEXT",
    language: "Language",
    auto: "Auto (Spotify)",
    small: "Small",
    medium: "Medium",
    large: "Large",
    top: "Top",
    bottom: "Bottom",
    none: "None",
    unsyncedScroll: "Unsynced Scroll",
    trackProgress: "Track Progress",
    slow: "Slow",
    normal: "Normal",
    fast: "Fast",
    off: "Off",
    lyricsProvider: "Lyrics Provider",
    providerAuto: "Auto Priority",
    providerAutoShort: "Auto",
    providerAutoSub: "Apple · LRCLIB · Genius · Spotify",
    providerApple: "Apple Music",
    providerLrclib: "LRCLIB",
    providerGenius: "Genius",
    providerSpotify: "Spotify Lyrics",
    badgeSmart: "Smart",
    badgeWordSync: "Karaoke",
    badgeSynced: "Synced",
    badgeUnsynced: "Plain",
    badgeOfficial: "Native",
    providedBy: "Provided by",
    waterfallFlow: "Waterfall Flow",
    waterfallNormal: "Waterfall (Normal)",
    waterfallIntense: "Deep Waterfall",
    waterfallOff: "Off (Classic)",
    interludeDots: "Interlude Dots (• • •)",
    customPalette: "Palette & Custom Color",
  },
  tr: {
    appearance: "Görünüm",
    showLyrics: "Şarkı Sözleri",
    idleLyrics: "Bekleme Modunda Sözler",
    ambientGlow: "Ortam Parlaması",
    glowShadow: "Parlamaya Gölge",
    artworkRadius: "Kapak Ovalliği",
    artworkSize: "Kapak Boyutu",
    idleClockPos: "Bekleme Saati",
    trackInfo: "Şarkı Bilgileri",
    position: "Konum",
    left: "Sol",
    center: "Orta",
    right: "Sağ",
    albumArt: "Kapak Fotoğrafı",
    trackTitle: "Şarkı Adı",
    artists: "Sanatçılar",
    albumName: "Albüm Adı",
    background: "Arka Plan",
    mode: "Mod",
    gradient: "Gradyan",
    dynamicGradient: "Dinamik Gradyan",
    solidColor: "Düz Renk",
    blurredArtwork: "Bulanık Kapak",
    artwork: "Kapak",
    darkenedArtwork: "Karartılmış Kapak",
    customColor: "Özel Renk",
    transitionSpeed: "Geçiş Hızı",
    resumeSync: "Senkronize Et",
    instrumental: "Enstrümantal",
    unknownTitle: "Bilinmeyen Şarkı",
    unknownArtist: "Bilinmeyen Sanatçı",
    upNext: "SIRADAKİ",
    language: "Dil",
    auto: "Otomatik (Spotify)",
    small: "Küçük",
    medium: "Orta",
    large: "Büyük",
    top: "Üst",
    bottom: "Alt",
    none: "Yok",
    unsyncedScroll: "Düz Söz Kaydırma",
    trackProgress: "Şarkıya Göre",
    slow: "Yavaş",
    normal: "Normal",
    fast: "Hızlı",
    off: "Kapalı",
    lyricsProvider: "Söz Sağlayıcısı",
    providerAuto: "Otomatik Sıralama",
    providerAutoShort: "Otomatik",
    providerAutoSub: "Apple · LRCLIB · Genius · Spotify",
    providerApple: "Apple Music",
    providerLrclib: "LRCLIB",
    providerGenius: "Genius",
    providerSpotify: "Spotify Sözleri",
    badgeSmart: "Akıllı",
    badgeWordSync: "Karaoke",
    badgeSynced: "Senkron",
    badgeUnsynced: "Düz",
    badgeOfficial: "Resmi",
    providedBy: "Sağlayıcı",
    waterfallFlow: "Şelale Akışı",
    waterfallNormal: "Açık (Şelale)",
    waterfallIntense: "Yoğun Şelale",
    waterfallOff: "Kapalı (Klasik)",
    interludeDots: "Ara Noktaları (• • •)",
    customPalette: "Palet & Özel Renk",
  },
};

function t(key) {
  let lang = Settings.get("language") || "auto";
  if (lang === "auto") {
    const spLocale =
      (typeof Spicetify !== "undefined" && Spicetify.Locale && Spicetify.Locale.getLocale()) ||
      (typeof Spicetify !== "undefined" && Spicetify.Platform?.Translations?.getLocale?.()) ||
      navigator.language ||
      "en";
    lang = spLocale.split("-")[0].toLowerCase();
  }
  const dict = Locales[lang] || Locales.en;
  return dict[key] || Locales.en[key] || key;
}

// Exported functions
exports.t = t;

    },

    "./utils/icons.js": function(require, exports, module) {
// --- ./utils/icons.js ---
/**
 * SVG icons used across Fullscreen Reloaded UI.
 */

const Icons = exports.Icons = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>`,
  prev: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM20 6v12l-10-6z"/></svg>`,
  next: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM4 6v12l10-6z"/></svg>`,
  shuffle: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17zm4.76-.08l3.65 3.91-3.65 3.91V14h-.47c-.83 0-1.58-.42-2.05-1.07l-.8-1.12-.8 1.12C10.75 13.58 10 14 9.17 14H2v2h7.17c1.38 0 2.63-.64 3.47-1.64l.36-.49.36.49C14.2 15.36 15.45 16 16.83 16H18v2.08l4.92-4-4.92-4V12h-1.17z"/></svg>`,
  repeat: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>`,
  volume: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 5V4L8 9z"/></svg>`,
  queue: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.2c-.3-.1-.6-.2-1-.2-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3V8h3V6h-5z"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.4 13a7.5 7.5 0 000-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-1.7-1L15 3h-4l-.3 2.5a7.6 7.6 0 00-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 000 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.8 1.7 1L11 21h4l.3-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6zM13 15.5A3.5 3.5 0 1113 8.5a3.5 3.5 0 010 7z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z"/></svg>`,
  lyrics: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v2H4zM4 9h10v2H4zM4 14h16v2H4zM4 19h10v2H4z"/></svg>`,
  pip: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 7H9c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 8H9V9h10v6zM3 5v14h2V5H3z"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
  heartOutline: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
};

    },

    "./utils/parsers.js": function(require, exports, module) {
// --- ./utils/parsers.js ---
/**
 * Parsers for synchronized lyrics formats (TTML, Enhanced LRC, and standard LRC).
 * Strictly preserves true word/syllable timestamps without fabricating fake word timings
 * on line-synced tracks.
 */

function parseTTML(ttmlString) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(ttmlString, "application/xml");
  } catch (e) {
    return [];
  }

  // Check root timing attribute (e.g. lrc:timing="Word" vs "Line")
  const ttEl = doc.documentElement;
  const rootTiming = (
    ttEl?.getAttribute("lrc:timing") ||
    ttEl?.getAttribute("itunes:timing") ||
    ""
  ).toLowerCase();

  const paragraphs = Array.from(doc.getElementsByTagName("p"));
  const lines = [];

  for (const p of paragraphs) {
    // Only take direct or vocal spans (skip translation/romanization metadata spans if any)
    const allSpans = Array.from(p.getElementsByTagName("span")).filter((s) => {
      const role = s.getAttribute("ttm:role") || "";
      return role !== "x-translation" && role !== "x-roman";
    });

    const lineStart = parseTTMLTime(p.getAttribute("begin"));
    const lineEnd = parseTTMLTime(p.getAttribute("end"));

    if (allSpans.length && rootTiming !== "line") {
      const words = [];
      let currentWord = null;

      for (let i = 0; i < allSpans.length; i++) {
        const s = allSpans[i];
        const rawText = s.textContent || "";
        const trimmed = rawText.trim();
        if (!trimmed.length) continue;

        const wStart = parseTTMLTime(s.getAttribute("begin"));
        const wEnd = parseTTMLTime(s.getAttribute("end"));

        // Determine if there is whitespace after this span (word boundary vs syllable inside the same word)
        let hasTrailingSpace = /\s$/.test(rawText);
        if (!hasTrailingSpace && s.nextSibling) {
          if (s.nextSibling.nodeType === 3 && /\s/.test(s.nextSibling.nodeValue || "")) {
            hasTrailingSpace = true;
          }
        }
        if (i === allSpans.length - 1) {
          hasTrailingSpace = true;
        }

        // Merge syllables of the same word into a single whole word so words never split visually
        if (!currentWord) {
          currentWord = {
            text: trimmed,
            startMs: wStart,
            endMs: wEnd,
            exactWordSync: true,
          };
        } else {
          currentWord.text += trimmed;
          if (wEnd != null) currentWord.endMs = wEnd;
        }

        if (hasTrailingSpace) {
          const isLast = i === allSpans.length - 1;
          currentWord.text = isLast ? currentWord.text : currentWord.text + " ";
          words.push(currentWord);
          currentWord = null;
        }
      }

      if (currentWord) {
        words.push(currentWord);
      }

      const hasValidWordTimes = words.some((w) => w.startMs != null);
      if (words.length && hasValidWordTimes) {
        const startMs = lineStart != null ? lineStart : words[0].startMs || 0;
        const endMs = lineEnd != null ? lineEnd : words[words.length - 1].endMs || startMs + 3000;

        // Fill any missing endMs on individual syllables/words
        for (let k = 0; k < words.length; k++) {
          if (words[k].startMs == null) {
            words[k].startMs = k === 0 ? startMs : words[k - 1].endMs || startMs;
          }
          if (words[k].endMs == null || words[k].endMs <= words[k].startMs) {
            words[k].endMs = words[k + 1]?.startMs || endMs;
          }
        }

        lines.push({
          startMs,
          endMs,
          isWordSynced: true,
          words,
        });
        continue;
      }
    }

    const text = (p.textContent || "").trim();
    if (text.length) {
      const startMs = lineStart || 0;
      const endMs = lineEnd || startMs + 3500;
      const parts = text.split(/\s+/).filter(Boolean);
      lines.push({
        startMs,
        endMs,
        isWordSynced: false,
        words: parts.map((w, idx) => ({
          text: idx < parts.length - 1 ? w + " " : w,
          startMs,
          endMs,
        })),
      });
    }
  }

  return lines.sort((a, b) => a.startMs - b.startMs);
}

function parseTTMLTime(value) {
  if (!value) return null;
  const str = String(value).trim();

  // "12.345s" or bare seconds "27.395"
  let m = str.match(/^(\d+(?:\.\d+)?)s?$/);
  if (m) return Math.round(parseFloat(m[1]) * 1000);

  // "00:00:12.340" or "00:00:12:340"
  m = str.match(/^(\d+):(\d\d):(\d\d)[.:](\d+)$/);
  if (m) {
    const [, h, mi, s, frac] = m;
    const ms = frac.length === 2 ? Number(frac) * 10 : Number(frac.slice(0, 3).padEnd(3, "0"));
    return (Number(h) * 3600 + Number(mi) * 60 + Number(s)) * 1000 + ms;
  }

  // "00:12.340" or "00:12:34"
  m = str.match(/^(\d+):(\d\d)[.:](\d+)$/);
  if (m) {
    const [, mi, s, frac] = m;
    const ms = frac.length === 2 ? Number(frac) * 10 : Number(frac.slice(0, 3).padEnd(3, "0"));
    return (Number(mi) * 60 + Number(s)) * 1000 + ms;
  }

  // "00:12"
  m = str.match(/^(\d+):(\d\d)$/);
  if (m) {
    return (Number(m[1]) * 60 + Number(m[2])) * 1000;
  }

  return null;
}

/**
 * Parses standard [mm:ss.xx] LRC and Enhanced <mm:ss.xx> word-synced LRC formats.
 */
function parseLRC(lrcString) {
  const lines = [];
  const lineRe = /^\s*\[(\d+):(\d+(?:\.\d+)?)\](.*)/;
  const wordTagRe = /<(\d+):(\d+(?:\.\d+)?)>\s*([^<]*)/g;

  for (const raw of (lrcString || "").split("\n")) {
    const m = raw.match(lineRe);
    if (!m) continue;
    const [, min, sec, rawContent] = m;
    const startMs = Math.round((Number(min) * 60 + parseFloat(sec)) * 1000);

    const content = rawContent.replace(/^\s*(\[\d+:\d+(?:\.\d+)?\])+/, "").trim();
    if (!content.length) continue;

    // Check for Enhanced LRC <mm:ss.xx> real word timestamps
    if (content.includes("<") && /<\d+:\d+(?:\.\d+)?>/.test(content)) {
      const extracted = [];
      let wm;
      wordTagRe.lastIndex = 0;
      while ((wm = wordTagRe.exec(content)) !== null) {
        const wStart = Math.round((Number(wm[1]) * 60 + parseFloat(wm[2])) * 1000);
        const wText = wm[3].trim();
        if (wText.length) {
          const subWords = wText.split(/\s+/).filter(Boolean);
          subWords.forEach((sw) => {
            extracted.push({
              text: sw,
              startMs: wStart,
              exactWordSync: true,
            });
          });
        }
      }
      if (extracted.length > 1) {
        const words = extracted.map((w, idx) => ({
          ...w,
          text: idx < extracted.length - 1 ? w.text + " " : w.text,
          endMs: extracted[idx + 1] ? extracted[idx + 1].startMs : w.startMs + 400,
        }));
        lines.push({
          startMs: words[0].startMs ?? startMs,
          endMs: words[words.length - 1].endMs,
          isWordSynced: true,
          words,
        });
        continue;
      }
    }

    const cleanText = content.replace(/<[^>]+>/g, "").trim();
    if (!cleanText.length) continue;

    const parts = cleanText.split(/\s+/).filter(Boolean);
    lines.push({
      startMs,
      isWordSynced: false,
      words: parts.map((w, idx) => ({
        text: idx < parts.length - 1 ? w + " " : w,
        startMs,
      })),
    });
  }

  const sorted = lines.sort((a, b) => a.startMs - b.startMs);
  for (let i = 0; i < sorted.length; i++) {
    if (!sorted[i].endMs) {
      sorted[i].endMs = sorted[i + 1] ? sorted[i + 1].startMs : sorted[i].startMs + 4000;
    }
  }
  return sorted;
}

// Exported functions
exports.parseTTML = parseTTML;
exports.parseTTMLTime = parseTTMLTime;
exports.parseLRC = parseLRC;

    },

    "./utils/settings.js": function(require, exports, module) {
// --- ./utils/settings.js ---
/**
 * Settings persistence and state management.
 */

const Settings = exports.Settings = {
  KEY: "fullscreen-reloaded:settings",
  defaults: {
    backgroundMode: "dynamic-gradient", // solid | gradient | dynamic-gradient | blurred-artwork | artwork | darkened-artwork | custom-color
    customColor: "#101014",
    showLyrics: true,
    idleLyrics: true,
    albumArtSize: "large", // small | medium | large
    albumArtRadius: 18,
    albumArtShadow: true,
    albumArtGlow: true,
    clockPosition: "top", // top | bottom | none
    metaPosition: "left", // left | center | right
    unsyncedScrollMode: "track", // track | slow | normal | fast | off
    waterfallMode: "normal", // normal | intense | off
    interludeDots: true,
    lyricsProvider: "auto", // auto | spotify | lrclib | genius | applemusic
    showAlbumArt: true,
    showTitle: true,
    showArtist: true,
    showAlbum: true,
    transitionMs: 900,
    language: "auto", // auto | en | tr
    appleMusicUserToken: null,
  },
  data: {},
  _listeners: new Set(),

  load() {
    let stored = null;
    try {
      const raw =
        (typeof Spicetify !== "undefined" && Spicetify.LocalStorage && Spicetify.LocalStorage.get(this.KEY)) ||
        window.localStorage.getItem(this.KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (e) {
      /* ignore corrupt settings */
    }
    this.data = Object.assign({}, this.defaults, stored || {});
    if (!this.data._migratedIdleLyricsV2) {
      this.data.idleLyrics = true;
      this.data.showLyrics = true;
      this.data._migratedIdleLyricsV2 = true;
      this.save();
    }
  },

  save() {
    const raw = JSON.stringify(this.data);
    try {
      if (typeof Spicetify !== "undefined" && Spicetify.LocalStorage) {
        Spicetify.LocalStorage.set(this.KEY, raw);
      } else {
        window.localStorage.setItem(this.KEY, raw);
      }
    } catch (e) {
      /* storage unavailable */
    }
  },

  set(key, value) {
    this.data[key] = value;
    this.save();
    this._notify(key, value);
  },

  get(key) {
    return this.data[key] !== undefined ? this.data[key] : this.defaults[key];
  },

  onChange(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  },

  _notify(key, value) {
    for (const listener of this._listeners) {
      try {
        listener(key, value);
      } catch (e) {
        console.error("[Fullscreen Reloaded] Settings listener error:", e);
      }
    }
  },
};

    },

  };
  const __cache = {};

  function __require(id) {
    let cleanId = id;
    if (!cleanId.endsWith(".js") && !cleanId.endsWith(".css")) {
      cleanId += ".js";
    }
    if (!cleanId.startsWith(".")) {
      cleanId = "./" + cleanId;
    }

    if (__cache[cleanId]) {
      return __cache[cleanId].exports;
    }

    if (!__modules[cleanId]) {
      throw new Error("[Fullscreen Reloaded] Module not found: " + cleanId);
    }

    const module = (__cache[cleanId] = { exports: {} });
    __modules[cleanId](__require, module.exports, module);
    return module.exports;
  }

  // Bootstrap application
  __require("./index.js");
})();
