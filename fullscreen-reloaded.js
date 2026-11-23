// ==========================================================================
// Fullscreen Reloaded (SpotiKit ESM bundle)
// A cinematic, modern fullscreen experience for Spotify.
// Generated on: 2026-11-23T19:03:17.914Z
// ==========================================================================

function __createRuntime() {
  "use strict";

  const __modules = {
    "./App.js": function(require, exports, module) {
// --- ./App.js ---
/**
 * Main application coordinator for Fullscreen Reloaded.
 */
const {  el  } = require("./utils/dom.js");
const {  resolveImageUrl, rgb, rgba  } = require("./utils/formatters.js");
const {  Icons  } = require("./utils/icons.js");
const {  t  } = require("./utils/i18n.js");
const {  Settings  } = require("./utils/settings.js");
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");
const {  BackgroundManager  } = require("./components/BackgroundManager.js");
const {  AmbientManager  } = require("./components/AmbientManager.js");
const {  Clock  } = require("./components/Clock.js");
const {  UpNextCard  } = require("./components/UpNextCard.js");
const {  SettingsModal  } = require("./components/SettingsModal.js");
const {  TopBar  } = require("./components/TopBar.js");
const {  BottomDock  } = require("./components/BottomDock.js");
const {  LyricsView  } = require("./components/LyricsView.js");
const {  FullLyricsCreator  } = require("./components/FullLyricsCreator.js");
const {  destroyCustomSelects  } = require("./components/CustomSelect.js");
const {  destroyCustomColorPickers  } = require("./components/CustomColorPicker.js");
const {  LyricsService  } = require("./services/LyricsService.js");
const {  AudioMoodEngine  } = require("./services/AudioMoodEngine.js");

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
  _metaTimer: null,
  _trackGen: 0,
  _rebuildGen: 0,
  idleTimer: null,
  _ctx: null,
  _mounted: false,
  _abortController: null,
  _onCtxAbort: null,
  _songUnsub: null,
  _settingsUnsub: null,
  _profileMenuHandle: null,
  _playbarHandle: null,

  _buildDomTree() {
    this.artActiveIsImg = true;
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

    // FullLyrics Creator Studio modal
    root.appendChild(FullLyricsCreator.build(this));

    document.body.appendChild(root);
    this.root = root;

    this.applyLayoutSettings();
  },

  _teardownDomTree() {
    clearTimeout(this._metaTimer);
    this._metaTimer = null;
    this._metaGen++;
    this._trackGen++;

    this.stopTicking();
    Clock.stop();

    TopBar.destroy();
    LyricsView.destroy();
    FullLyricsCreator.destroy();
    BottomDock.destroy();
    UpNextCard.destroy();
    SettingsModal.destroy();
    BackgroundManager.destroy();
    destroyCustomSelects();
    destroyCustomColorPickers();

    AmbientManager._currentMood = "";
    AmbientManager._isIdle = false;

    if (this.artImg) this.artImg.onload = null;
    if (this.artImgAlt) this.artImgAlt.onload = null;

    this.root?.remove();
    this.root = null;
    this.stage = null;
    this.artImg = null;
    this.artImgAlt = null;
    this.artWrap = null;
    this.ringRect = null;
    this.metaWrap = null;
    this.titleEl = null;
    this.artistEl = null;
    this.albumEl = null;
    this.artActiveIsImg = true;
  },

  _disposeHandle(handle) {
    if (!handle) return;
    if (typeof handle === "function") {
      handle();
    } else if (typeof handle.remove === "function") {
      handle.remove();
    }
  },

  _syncPlaybarActive(isOpen) {
    if (!this._playbarHandle) return;
    if (typeof this._playbarHandle.setActive === "function") {
      this._playbarHandle.setActive(Boolean(isOpen));
    } else if ("active" in this._playbarHandle) {
      this._playbarHandle.active = Boolean(isOpen);
    }
  },

  mount(ctx) {
    if (this._mounted) {
      this.unmount();
    }

    this._ctx = ctx || null;
    this._mounted = true;
    this._rebuildGen = 0;
    this._metaGen = 0;
    this._trackGen = 0;

    this._abortController = new AbortController();
    if (ctx?.signal) {
      if (ctx.signal.aborted) {
        this._abortController.abort(ctx.signal.reason);
      } else {
        this._onCtxAbort = () => this._abortController?.abort(ctx.signal.reason);
        ctx.signal.addEventListener("abort", this._onCtxAbort, { once: true });
      }
    }

    this._buildDomTree();

    // Listen to track changes
    this.songChangeListener = () => this.onTrackChange();
    this._songUnsub = SpotiKitBridge.addPlayerListener("songchange", this.songChangeListener);

    // Listen to settings changes
    this._settingsUnsub = Settings.onChange((key) => this.onSettingsChanged(key));

    // Register SpotiKit ProfileMenu launch item
    if (typeof SpotiKit !== "undefined" && typeof SpotiKit.ProfileMenu?.add === "function") {
      this._profileMenuHandle = SpotiKit.ProfileMenu.add({
        label: "Fullscreen Reloaded",
        icon: Icons.fullscreen,
        onSelect: () => this.toggleOpen(),
      });
    }

    // Register fallback Playbar button only when native fullscreen button is absent
    const hasNativeFullscreen =
      typeof document !== "undefined" &&
      Boolean(document.querySelector('[data-testid="fullscreen-mode-button"]'));
    if (
      !hasNativeFullscreen &&
      typeof SpotiKit !== "undefined" &&
      typeof SpotiKit.Playbar?.add === "function"
    ) {
      this._playbarHandle = SpotiKit.Playbar.add({
        label: "Fullscreen Reloaded",
        icon: Icons.fullscreen,
        active: this.open,
        onClick: () => this.toggleOpen(),
      });
    }

    // Register idle and hotkeys
    const signal = this._abortController.signal;
    this.registerIdleTracker(signal);
    this.registerHotkeys(signal);
  },

  unmount() {
    if (!this._mounted) return;
    this._mounted = false;
    this._rebuildGen++;
    this._metaGen++;
    this._trackGen++;

    this.close();

    clearTimeout(this.idleTimer);
    this.idleTimer = null;

    if (this._songUnsub) {
      this._songUnsub();
      this._songUnsub = null;
    }
    this.songChangeListener = null;

    if (this._settingsUnsub) {
      this._settingsUnsub();
      this._settingsUnsub = null;
    }

    this._disposeHandle(this._profileMenuHandle);
    this._profileMenuHandle = null;

    this._disposeHandle(this._playbarHandle);
    this._playbarHandle = null;

    if (this._ctx?.signal && this._onCtxAbort) {
      this._ctx.signal.removeEventListener("abort", this._onCtxAbort);
    }
    this._onCtxAbort = null;

    this._abortController?.abort();
    this._abortController = null;

    this._teardownDomTree();

    this.currentTrack = null;
    this.currentImage = null;
    this._ctx = null;
  },

  async rebuildForLanguage() {
    if (!this._mounted || !this.root) return;
    const rebuildGen = ++this._rebuildGen;
    const wasOpen = this.open;
    const settingsWasOpen = Boolean(SettingsModal.root?.classList.contains("fr-show"));

    this._teardownDomTree();
    if (!this._mounted || SpotiKitBridge.isStopped()) return;

    this._buildDomTree();
    if (wasOpen) {
      this.open = true;
      this.root.classList.add("fr-open");
    }
    if (settingsWasOpen && SettingsModal.root) {
      SettingsModal.root.classList.add("fr-show");
    }
    this.applyLayoutSettings();

    this.currentTrack = null;
    if (wasOpen) {
      Clock.start();
      await this.onTrackChange();
      if (!this._mounted || !this.open || SpotiKitBridge.isStopped() || rebuildGen !== this._rebuildGen) {
        return;
      }
      this.startTicking();
    } else if (SpotiKitBridge.getCurrentTrack()) {
      await this.onTrackChange();
    }
  },

  registerIdleTracker(signal) {
    const opts = signal ? { signal } : undefined;
    const reset = () => this.resetIdle();
    const onLeave = () => this.setIdle(true);
    window.addEventListener("mousemove", reset, opts);
    window.addEventListener("mousedown", reset, opts);
    window.addEventListener("keydown", reset, opts);
    window.addEventListener("wheel", reset, opts);
    window.addEventListener("mouseleave", onLeave, opts);
  },

  resetIdle() {
    if (!this.open || !this._mounted) return;
    if (this.root && this.root.classList.contains("fr-idle")) {
      this.root.classList.remove("fr-idle");
    }
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.setIdle(true), 4000);
  },

  setIdle(isIdle) {
    if (!this.root || !this.open || !this._mounted) return;
    if (SettingsModal.root && SettingsModal.root.classList.contains("fr-show")) return;
    if (FullLyricsCreator.isOpen) return;
    this.root.classList.toggle("fr-idle", isIdle);
    AmbientManager.setIdle(isIdle);
  },

  registerHotkeys(signal) {
    const captureOpts = signal ? { capture: true, signal } : true;

    // Intercept clicks on Spotify's native fullscreen button
    document.addEventListener(
      "click",
      (e) => {
        if (!this._mounted || SpotiKitBridge.isStopped()) return;
        if (SpotiKitBridge.isSpotifyFullscreenButton(e.target)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.toggleOpen();
        }
      },
      captureOpts
    );

    // Keyboard shortcuts
    document.addEventListener(
      "keydown",
      (e) => {
        if (!this._mounted || SpotiKitBridge.isStopped()) return;
        const target = e.target;
        const isTyping =
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable);

        if (isTyping) return;
        if (FullLyricsCreator.isOpen) return;

        // F11 support
        if (e.key === "F11") {
          e.preventDefault();
          this.toggleOpen();
          return;
        }

        if (this.open && (e.key === "e" || e.key === "E") && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          FullLyricsCreator.openForCurrentTrack();
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
      captureOpts
    );
  },

  async onTrackChange() {
    if (!this._mounted || !this.root || SpotiKitBridge.isStopped()) return;
    const track = SpotiKitBridge.getCurrentTrack();
    if (!track) return;

    const isSameTrack = this.currentTrack && this.currentTrack.uri === track.uri;
    const trackGen = !isSameTrack ? ++this._trackGen : this._trackGen;
    this.currentTrack = track;

    const meta = track.metadata || {};
    const artists =
      track.artists && track.artists.length
        ? track.artists.map((a) => a.name || a.displayName || "").filter(Boolean).join(", ")
        : meta.artist_name || track.name || t("unknownArtist");

    const updateMeta = () => {
      if (!this.titleEl || !this.artistEl || !this.albumEl) return;
      this.titleEl.textContent = meta.title || track.name || t("unknownTitle");
      this.artistEl.textContent = artists;
      this.albumEl.textContent = meta.album_title || track.album?.name || "";
      this._applyMetaVisibility();
    };

    if (!isSameTrack) {
      const gen = ++this._metaGen;
      this.metaWrap?.classList.add("fr-meta-animating");
      clearTimeout(this._metaTimer);
      this._metaTimer = setTimeout(() => {
        this._metaTimer = null;
        if (gen !== this._metaGen || !this._mounted || !this.metaWrap) return;
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

      // Start fetching lyrics & audio analysis immediately without waiting for background color extraction
      LyricsView.loadForTrack(track, this);
      AudioMoodEngine.loadTrack(track);

      // Crossfade album art between dual stacked layers
      const showing = this.artActiveIsImg ? this.artImg : this.artImgAlt;
      const incoming = this.artActiveIsImg ? this.artImgAlt : this.artImg;
      if (incoming && showing) {
        incoming.src = image;
        incoming.onload = () => {
          if (
            !this._mounted ||
            !this.root ||
            SpotiKitBridge.isStopped() ||
            trackGen !== this._trackGen
          ) {
            return;
          }
          incoming.classList.add("fr-art-active");
          showing.classList.remove("fr-art-active");
          this.artActiveIsImg = !this.artActiveIsImg;
        };
      }

      const colors = await BackgroundManager.update(image);
      if (
        !colors ||
        !this._mounted ||
        !this.root ||
        SpotiKitBridge.isStopped() ||
        trackGen !== this._trackGen
      ) {
        return;
      }
      AmbientManager.updateColors(colors);
      AudioMoodEngine.updateColors(colors);
      this.root.style.setProperty("--fr-word-accent", rgb(colors.accent));
      this.artWrap?.style.setProperty("--fr-art-glow", rgba(colors.accent, 0.65));
    } else if (LyricsView._currentTrackUri !== track.uri) {
      LyricsView.loadForTrack(track, this);
    }
  },

  startTicking() {
    if (this.tickHandle || !this._mounted || !this.open) return;
    const loop = () => {
      if (!this._mounted || !this.open || SpotiKitBridge.isStopped()) {
        this.tickHandle = null;
        return;
      }
      const progress = BottomDock.tick();
      const duration = SpotiKitBridge.getDuration();
      if (typeof progress === "number") {
        LyricsView.update(progress);
        UpNextCard.update(duration, progress);

        const moodFrame = AudioMoodEngine.sample(progress, SpotiKitBridge.isPlaying(), LyricsView);
        AmbientManager.updateFrame(moodFrame, this.artWrap);

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
    if (!this._mounted) return;
    if (this.open) this.close();
    else await this.launch();
  },

  async launch() {
    if (!this._mounted || !this.root) return;
    this.open = true;
    this.root.classList.add("fr-open");
    document.body.style.overflow = "hidden";
    this._syncPlaybarActive(true);
    Clock.start();

    try {
      if (!document.fullscreenElement && typeof document.documentElement?.requestFullscreen === "function") {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      // browser may require user gesture
    }

    if (!this._mounted || !this.open || SpotiKitBridge.isStopped()) return;

    await this.onTrackChange();
    if (!this._mounted || !this.open || SpotiKitBridge.isStopped()) return;

    LyricsView.showProviderBadge(3000);
    this.startTicking();
  },

  close() {
    this.open = false;
    clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.root?.classList.remove("fr-open", "fr-idle");
    AmbientManager.setIdle(false);
    SettingsModal.close();
    FullLyricsCreator.close();
    document.body.style.overflow = "";
    this._syncPlaybarActive(false);
    Clock.stop();

    try {
      if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
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
    if (!this._mounted) return;
    if (key === "language") {
      this.rebuildForLanguage();
      return;
    }
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
    if (key === "bgVocalsDuet" && this.currentTrack) {
      LyricsView.loadForTrack(this.currentTrack, this, true);
    }
    if (key === "waterfallMode") {
      LyricsView.applyWaterfallMode();
    }
  },

  applyLayoutSettings() {
    if (!this.root || !this.stage || !this.artWrap) return;
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
 * Mood-Adaptive & Beat-Reactive Atmosphere Manager.
 * Renders 4 distinct dynamic scenes ("energetic", "melancholic", "latenight", "dreamy"):
 * - Beat-reactive light orbs & aurora ribbons
 * - Mood-morphing particle system (Rising Sparks / Falling Rain / Fireflies / Soft Bokeh)
 * - Atmospheric mist & Late-Night analog grain
 */
const {  el  } = require("./utils/dom.js");
const {  rgb, rgba  } = require("./utils/formatters.js");
const {  Settings  } = require("./utils/settings.js");

const AmbientManager = exports.AmbientManager = {
  root: null,
  auroraWrap: null,
  orbs: [],
  particles: [],
  mistEl: null,
  grainEl: null,
  _currentMood: "",
  _isIdle: false,

  build() {
    this.root = el("div", "fr-ambient fr-show");
    this.root.setAttribute("data-mood", "dreamy");

    // 1. Aurora Wave Ribbons (vivid in Energetic & Dreamy moods)
    this.auroraWrap = el("div", "fr-mood-aurora");
    const wave1 = el("div", "fr-aurora-wave fr-aurora-1");
    const wave2 = el("div", "fr-aurora-wave fr-aurora-2");
    this.auroraWrap.append(wave1, wave2);

    // 2. Beat-Reactive Light Orbs
    const orbsCont = el("div", "fr-orbs-wrap");
    this.orbs = [];
    const orbConfigs = [
      { size: 52, top: 12, left: 14, dur: 18, delay: -4 },
      { size: 60, top: 38, left: 52, dur: 22, delay: -11 },
      { size: 46, top: 58, left: 22, dur: 25, delay: -17 },
    ];
    for (let i = 0; i < orbConfigs.length; i++) {
      const cfg = orbConfigs[i];
      const orb = el("div", `fr-orb fr-orb-${i + 1}`);
      orb.style.width = orb.style.height = `${cfg.size}vh`;
      orb.style.top = `${cfg.top}%`;
      orb.style.left = `${cfg.left}%`;
      orb.style.animationDuration = `${cfg.dur}s`;
      orb.style.animationDelay = `${cfg.delay}s`;
      this.orbs.push(orb);
      orbsCont.appendChild(orb);
    }

    // 3. Mood-Morphing Particles (Sparks / Rain / Fireflies / Bokeh)
    const partsCont = el("div", "fr-particles-wrap");
    this.particles = [];
    for (let i = 0; i < 32; i++) {
      const p = el("div", "fr-particle");
      const size = (3 + (i % 5) * 1.3).toFixed(1);
      const x = ((i * 37) % 100).toFixed(1);
      const y = ((i * 53) % 100).toFixed(1);
      const dur = (7 + (i % 9) * 1.6).toFixed(1);
      const delay = (-((i * 2.7) % 22)).toFixed(1);
      const drift = (((i % 7) - 3) * 14).toFixed(0);

      p.style.setProperty("--p-size", `${size}px`);
      p.style.setProperty("--p-x", `${x}%`);
      p.style.setProperty("--p-y", `${y}%`);
      p.style.setProperty("--p-dur", `${dur}s`);
      p.style.setProperty("--p-delay", `${delay}s`);
      p.style.setProperty("--p-drift", `${drift}px`);

      this.particles.push(p);
      partsCont.appendChild(p);
    }

    // 4. Atmospheric Mist / Vignette (deepens in Melancholic & Late-Night moods)
    this.mistEl = el("div", "fr-mood-mist");

    // 5. Late-Night Analog Film Grain Overlay
    this.grainEl = el("div", "fr-mood-grain");

    this.root.append(this.auroraWrap, orbsCont, partsCont, this.mistEl, this.grainEl);
    return this.root;
  },

  updateColors(colors) {
    if (!this.root || !colors) return;
    const dom = colors.dominant || [80, 80, 120];
    const acc = colors.accent || [140, 100, 220];
    const dark = colors.dark || [20, 20, 30];

    this.root.style.setProperty("--fr-amb-dominant", rgb(dom));
    this.root.style.setProperty("--fr-amb-accent", rgb(acc));
    this.root.style.setProperty("--fr-amb-dark", rgb(dark));
    this.root.style.setProperty("--fr-amb-accent-soft", rgba(acc, 0.55));
    this.root.style.setProperty("--fr-amb-dominant-soft", rgba(dom, 0.5));

    if (this.orbs.length >= 3) {
      this.orbs[0].style.backgroundColor = rgb(dom);
      this.orbs[1].style.backgroundColor = rgb(acc);
      this.orbs[2].style.backgroundColor = rgb(dark);
    }
  },

  /**
   * Updates 60fps beat-reactive & mood CSS variables on the ambient root and album artwork.
   */
  updateFrame(frame, artWrap) {
    if (!this.root || !frame) return;

    const mood = frame.mood || "dreamy";
    if (this._currentMood !== mood) {
      this._currentMood = mood;
      this.root.setAttribute("data-mood", mood);
    }

    const beat = frame.beatPulse || 0;
    const bar = frame.barPulse || 0;
    const energy = frame.sectionEnergy ?? 0.5;

    this.root.style.setProperty("--fr-beat", beat.toFixed(3));
    this.root.style.setProperty("--fr-bar", bar.toFixed(3));
    this.root.style.setProperty("--fr-energy", energy.toFixed(3));

    if (artWrap) {
      const beatMode = Settings.get("beatReactive") || "normal";
      if (beatMode === "off") {
        artWrap.style.setProperty("--fr-art-beat", "0");
        artWrap.style.setProperty("--fr-glow-beat", "0.55");
        artWrap.style.setProperty("--fr-glow-spread", "0%");
      } else {
        const artScale = beat * 0.022 + bar * 0.012;
        const glowOpacity = Math.min(0.95, 0.42 + beat * 0.36 + energy * 0.22);
        const glowSpread = (beat * 5.5 + bar * 3.0).toFixed(2);
        artWrap.style.setProperty("--fr-art-beat", artScale.toFixed(4));
        artWrap.style.setProperty("--fr-glow-beat", glowOpacity.toFixed(3));
        artWrap.style.setProperty("--fr-glow-spread", `${glowSpread}%`);
      }
    }
  },

  setIdle(isIdle) {
    this._isIdle = !!isIdle;
    if (this.root) {
      // Keep ambient mood visible even in idle mode (just slightly calmer) unless turned off
      this.root.classList.toggle("fr-idle-calm", !!isIdle);
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
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");

const BackgroundManager = exports.BackgroundManager = {
  root: null,
  layerA: null,
  layerB: null,
  activeIsA: true,
  _updateGen: 0,

  build() {
    this.activeIsA = true;
    const root = el("div", "fr-bg-root");
    this.layerA = el("div", "fr-bg-layer fr-bg-active");
    this.layerB = el("div", "fr-bg-layer");
    root.append(this.layerA, this.layerB, el("div", "fr-bg-tint"), el("div", "fr-bg-scrim"));
    this.root = root;
    return root;
  },

  async update(imageUrl) {
    const gen = ++this._updateGen;
    const colors = await ColorExtractor.extract(imageUrl);
    if (
      !this.root ||
      !this.layerA ||
      !this.layerB ||
      SpotiKitBridge.isStopped() ||
      gen !== this._updateGen
    ) {
      return null;
    }

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

  destroy() {
    this._updateGen++;
    this.activeIsA = true;
    this.root?.remove();
    this.root = null;
    this.layerA = null;
    this.layerB = null;
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
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");

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
let globalColorAbortController = null;
const activeColorPickers = new Set();

function initGlobalListener() {
  if (initializedGlobalColorListener) return;
  initializedGlobalColorListener = true;
  globalColorAbortController = new AbortController();
  const { signal } = globalColorAbortController;

  document.addEventListener(
    "click",
    (e) => {
      for (const close of activeColorPickers) {
        close(e);
      }
    },
    { signal }
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") {
        for (const close of activeColorPickers) {
          close(null, true);
        }
      }
    },
    { signal }
  );
}

function destroyCustomColorPickers() {
  activeColorPickers.clear();
  if (globalColorAbortController) {
    globalColorAbortController.abort();
    globalColorAbortController = null;
  }
  initializedGlobalColorListener = false;
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

const CustomColorPicker = exports.CustomColorPicker = {
  create: createCustomColorPicker,
  destroyAll: destroyCustomColorPickers,
};

// Exported functions
exports.destroyCustomColorPickers = destroyCustomColorPickers;
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
let globalSelectAbortController = null;
const activeSelects = new Set();

function initGlobalListener() {
  if (initializedGlobalListener) return;
  initializedGlobalListener = true;
  globalSelectAbortController = new AbortController();
  const { signal } = globalSelectAbortController;

  document.addEventListener(
    "click",
    (e) => {
      for (const closeMenu of activeSelects) {
        closeMenu(e);
      }
    },
    { signal }
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") {
        for (const closeMenu of activeSelects) {
          closeMenu(null, true);
        }
      }
    },
    { signal }
  );
}

function destroyCustomSelects() {
  activeSelects.clear();
  if (globalSelectAbortController) {
    globalSelectAbortController.abort();
    globalSelectAbortController = null;
  }
  initializedGlobalListener = false;
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

const CustomSelect = exports.CustomSelect = {
  create: createCustomSelect,
  destroyAll: destroyCustomSelects,
};

// Exported functions
exports.destroyCustomSelects = destroyCustomSelects;
exports.createCustomSelect = createCustomSelect;

    },

    "./components/FullLyricsCreator.js": function(require, exports, module) {
// --- ./components/FullLyricsCreator.js ---
/**
 * FullLyricsCreator
 * Comprehensive studio lyrics editor & synchronizer for Fullscreen Reloaded.
 * - 100% compatible with Liquid Lyrics localStorage (`liquid-lyrics-custom-sync:<trackUri>`)
 *   and Spicy Lyrics universal JSON schema (`Static` | `Line` | `Syllable`).
 * - Supports Block (`line`), Karaoke (`word`), and Static (`static`) modes,
 *   Visual Sentence & Word Builder + Raw Text editor, Duet (`v2`), Background Vocals (`[bg]`),
 *   Interludes (`#interlude`), TTML/LRC/JSON/TXT import & export, and Local DB Library management.
 */
const {  el  } = require("./utils/dom.js");
const {  Icons  } = require("./utils/icons.js");
const {  t  } = require("./utils/i18n.js");
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");
const {  LyricsService  } = require("./services/LyricsService.js");
const {  LyricsView  } = require("./components/LyricsView.js");
const { 
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
 } = require("./services/CustomSyncStorage.js");

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

const FullLyricsCreator = exports.FullLyricsCreator = {
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
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");
const {  AudioMoodEngine  } = require("./services/AudioMoodEngine.js");

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
    if (myRequest !== this.requestId || !this.scrollEl || SpotiKitBridge.isStopped()) return;

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
    this.lines = Array.isArray(data.lines) ? data.lines : [];
    this.syncType = data.type;

    if (this.syncType === "synced" || this.syncType === "word-synced") {
      this.lines.sort((a, b) => (Number(a.startMs) || 0) - (Number(b.startMs) || 0));
    }

    AudioMoodEngine.updateLyricsMetrics(this.lines, this.syncType, this._currentTrackDurationMs);

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
    const enableBgDuet = Settings.get("bgVocalsDuet") !== false;
    let prevVocalEndMs = 0;

    this.lines.forEach((line, lineIdx) => {
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
        // Line-synced mode (NOT word-by-word): render the entire sentence as ONE unified element
        const sentenceEl = el("span", "fr-lyric-sentence", fullText.trim());
        lineEl.appendChild(sentenceEl);
        line._sentenceEl = sentenceEl;

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
          const weights = wordsArr.map((w) => {
            const clean = (typeof w === "string" ? w : w.text || "").trim();
            return Math.pow(Math.max(1.8, clean.length), 0.78);
          });
          const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
          let cursorMs = 0;

          return wordsArr.map((rawW, wIdx) => {
            const wObj =
              rawW && typeof rawW === "object"
                ? rawW
                : { text: rawW != null ? String(rawW) : "" };
            const wordText = wObj.text != null ? String(wObj.text) : "";
            const wordEl = el("span", isBg ? "fr-lyric-word fr-bg-word" : "fr-lyric-word", wordText);
            wordEl.style.setProperty("--w-idx", String(wIdx));

            const sliceMs = (weights[wIdx] / totalWeight) * spanDurMs;
            const synthStart = startBaseMs + cursorMs;
            const synthEnd = startBaseMs + cursorMs + sliceMs;
            cursorMs += sliceMs;

            if (wObj.startMs == null) {
              wObj.startMs = synthStart;
              wObj.endMs = Math.max(synthStart + 80, synthEnd);
            } else if (wObj.endMs == null || wObj.endMs <= wObj.startMs) {
              const nextW = wordsArr[wIdx + 1];
              const fallbackEnd =
                nextW && typeof nextW === "object" && nextW.startMs > wObj.startMs
                  ? nextW.startMs
                  : wObj.startMs + Math.max(180, sliceMs);
              wObj.endMs = fallbackEnd;
            }

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

    this.revealLyrics();
    if (app?.open) {
      this.showProviderBadge(3000);
      this._shownStartBadgeForUri = track.uri;
    }

    this.update(SpotiKitBridge.getProgress(), true);
  },

  revealLyrics() {
    if (this._revealRafId) {
      cancelAnimationFrame(this._revealRafId);
      this._revealRafId = null;
    }
    this._revealRafId = requestAnimationFrame(() => {
      this._revealRafId = null;
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
    if (line._bgSentenceEl) {
      line._bgSentenceEl.style.removeProperty("--bar-pct");
      line._bgSentenceEl.style.removeProperty("--bar-flow-y");
    }
    const clearWords = (arr) => {
      if (!Array.isArray(arr)) return;
      for (let k = 0; k < arr.length; k++) {
        const w = arr[k];
        if (!w || !w.el) continue;
        w.el.classList.remove("fr-w-active", "fr-w-done");
        w.el.style.removeProperty("--w-pct");
        w.el.style.removeProperty("--w-lift");
        w.el.style.removeProperty("--w-scale");
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
        const sweptPct = wfMode === "off" ? 118 : rawProgress * 118;
        const flowY = dropPx * (1 - rawProgress);

        sentenceEl.style.setProperty("--bar-pct", `${sweptPct.toFixed(1)}%`);
        sentenceEl.style.setProperty("--bar-flow-y", `${flowY.toFixed(2)}px`);
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

    // --- 4b. 60fps Word-by-Word Waterfall & Karaoke Sweep (ONLY on word-synced tracks) ---
    if (this.syncType === "word-synced" && this.activeIndex >= 0) {
      const activeLine = this.lines[this.activeIndex];
      if (activeLine) {
        const wfMode = Settings.get("waterfallMode") || "normal";
        const dropPx = wfMode === "intense" ? -12 : wfMode === "normal" ? -8 : 0;

        const animateWordList = (words, dropScale = 1) => {
          if (!Array.isArray(words)) return;
          for (let k = 0; k < words.length; k++) {
            const w = words[k];
            const elWord = w?.el;
            if (!elWord) continue;

            const wStart = w.startMs ?? activeLine.startMs ?? 0;
            const wEnd = w.endMs ?? wStart + 350;

            if (progressMs <= wStart) {
              if (elWord.classList.contains("fr-w-active") || elWord.classList.contains("fr-w-done")) {
                elWord.classList.remove("fr-w-active", "fr-w-done");
                elWord.style.removeProperty("--w-pct");
                elWord.style.removeProperty("--w-lift");
                elWord.style.removeProperty("--w-scale");
              }
            } else if (progressMs >= wEnd) {
              if (!elWord.classList.contains("fr-w-done")) {
                elWord.classList.remove("fr-w-active");
                elWord.classList.add("fr-w-done");
                elWord.style.setProperty("--w-pct", "118%");
                elWord.style.setProperty("--w-lift", "0px");
                elWord.style.setProperty("--w-scale", "1");
              }
            } else {
              if (!elWord.classList.contains("fr-w-active")) {
                elWord.classList.remove("fr-w-done");
                elWord.classList.add("fr-w-active");
              }
              const dur = Math.max(40, wEnd - wStart);
              const ratio = Math.max(0, Math.min(1, (progressMs - wStart) / dur));
              const swept = -16 + ratio * 132;
              const lift = dropPx * dropScale * 0.5 * (1 + Math.cos(ratio * Math.PI));
              const scale = 1 + 0.03 * dropScale * Math.sin(ratio * Math.PI);

              elWord.style.setProperty("--w-pct", `${swept.toFixed(1)}%`);
              elWord.style.setProperty("--w-lift", `${lift.toFixed(2)}px`);
              elWord.style.setProperty("--w-scale", `${scale.toFixed(3)}`);
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

    // Mood Atmosphere Dropdown (Auto / Energetic / Melancholic / Late Night / Dreamy / Off)
    const moodRow = el("div", "fr-settings-row");
    const moodSelect = createCustomSelect({
      options: [
        {
          value: "auto",
          label: t("moodAuto"),
          shortLabel: t("providerAutoShort"),
          sublabel: t("moodAutoSub"),
          badge: t("badgeSmart"),
        },
        { value: "energetic", label: t("moodEnergetic"), shortLabel: t("moodEnergetic") },
        { value: "melancholic", label: t("moodMelancholic"), shortLabel: t("moodMelancholic") },
        { value: "latenight", label: t("moodLateNight"), shortLabel: t("moodLateNight") },
        { value: "dreamy", label: t("moodDreamy"), shortLabel: t("moodDreamy") },
        { value: "off", label: t("moodOff"), shortLabel: t("moodOff") },
      ],
      value: Settings.get("moodMode") || "auto",
      onChange: (val) => Settings.set("moodMode", val),
    });
    moodRow.append(el("label", null, t("moodAtmosphere")), moodSelect);
    sec1.appendChild(moodRow);

    // Beat & Bass Pulse Dropdown (Normal / Intense / Off)
    const beatRow = el("div", "fr-settings-row");
    const beatSelect = createCustomSelect({
      options: [
        { value: "normal", label: t("beatNormal"), shortLabel: t("beatNormal") },
        { value: "intense", label: t("beatIntense"), shortLabel: t("beatIntense") },
        { value: "off", label: t("beatOff"), shortLabel: t("beatOff") },
      ],
      value: Settings.get("beatReactive") || "normal",
      onChange: (val) => Settings.set("beatReactive", val),
    });
    beatRow.append(el("label", null, t("beatReactive")), beatSelect);
    sec1.appendChild(beatRow);

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

    // Background Vocals & Duet View Toggle (Apple Music Sing / Duet)
    const bgDuetRow = el("div", "fr-settings-row");
    const bgDuetToggle = toggle(Settings.get("bgVocalsDuet") !== false, (v) => Settings.set("bgVocalsDuet", v));
    bgDuetRow.append(el("label", null, t("bgVocalsDuet")), bgDuetToggle);
    sec2.appendChild(bgDuetRow);

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
          value: "spicy",
          label: t("providerSpicy"),
          shortLabel: "Spicy Lyrics",
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

  destroy() {
    this.root?.remove();
    this.root = null;
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
const {  FullLyricsCreator  } = require("./components/FullLyricsCreator.js");
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");

const TopBar = exports.TopBar = {
  root: null,
  lyricsBtn: null,
  creatorBtn: null,
  pipBtn: null,
  pipImg: null,

  build(app) {
    const topbar = el("div", "fr-topbar");

    // 1. Lyrics Toggle
    this.lyricsBtn = iconBtn(Icons.lyrics, () => app.toggleLyricsVisible());

    // 2. FullLyrics Creator Studio
    this.creatorBtn = iconBtn(Icons.creator, () => FullLyricsCreator.toggleOpen());
    this.creatorBtn.title = "FullLyrics Creator Studio (E)";

    // 3. Picture-in-Picture
    this.pipBtn = iconBtn(Icons.pip, async () => {
      await this.togglePiP(app);
    });

    const sep = el("div", "fr-topbar-sep");

    // 4. Settings Gear
    const gearBtn = iconBtn(Icons.gear, () => SettingsModal.toggleOpen());

    // 5. Close Button
    const closeBtn = iconBtn(Icons.close, () => app.close());

    topbar.append(this.lyricsBtn, this.creatorBtn, this.pipBtn, sep, gearBtn, closeBtn);
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
        this.pipBtn?.classList.remove("fr-active");
        return;
      }

      // Modern Document PiP API (Available in Chromium-based Spotify Desktop)
      if (window.documentPictureInPicture) {
        const pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 400,
          height: 400,
        });
        if (!this.root || SpotiKitBridge.isStopped()) {
          try {
            pipWindow?.close?.();
          } catch (_) {}
          return;
        }
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
          this.pipBtn?.classList.remove("fr-active");
          this.pipImg = null;
        });
        this.pipBtn?.classList.add("fr-active");
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
          if (!this.root || SpotiKitBridge.isStopped()) return;
          ctx.fillStyle = "#121212";
          ctx.fillRect(0, 0, 800, 800);
          ctx.drawImage(img, 0, 0, 800, 800);
          const stream = canvas.captureStream();
          const video = document.createElement("video");
          video.srcObject = stream;
          video.muted = true;
          await video.play();
          if (!this.root || SpotiKitBridge.isStopped()) return;
          await video.requestPictureInPicture();
          if (!this.root || SpotiKitBridge.isStopped()) {
            try {
              if (document.pictureInPictureElement && typeof document.exitPictureInPicture === "function") {
                await document.exitPictureInPicture();
              }
            } catch (_) {}
            return;
          }
          video.addEventListener("leavepictureinpicture", () => {
            this.pipBtn?.classList.remove("fr-active");
          });
        };
        this.pipBtn?.classList.add("fr-active");
      }
    } catch (e) {
      console.warn("[Fullscreen Reloaded] PiP error:", e);
    }
  },

  destroy() {
    try {
      if (window?.documentPictureInPicture?.window) {
        window.documentPictureInPicture.window.close();
      }
    } catch (_) {}

    try {
      if (document.pictureInPictureElement && typeof document.exitPictureInPicture === "function") {
        Promise.resolve(document.exitPictureInPicture()).catch(() => {});
      }
    } catch (_) {}

    this.pipImg = null;
    this.root?.remove();
    this.root = null;
    this.lyricsBtn = null;
    this.creatorBtn = null;
    this.pipBtn = null;
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
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");

const UpNextCard = exports.UpNextCard = {
  root: null,
  img: null,
  title: null,
  artist: null,
  shown: false,
  _loading: false,

  build() {
    this.shown = false;
    this._loading = false;
    this.root = el("div", "fr-up-next");
    this.img = document.createElement("img");
    this.img.className = "fr-up-next-img";

    const info = el("div", "fr-up-next-info");
    info.appendChild(el("div", "fr-up-next-label", t("upNext")));
    this.title = el("h4", "fr-up-next-title", "");
    this.artist = el("p", "fr-up-next-artist", "");
    info.append(this.title, this.artist);

    this.root.append(this.img, info);
    this.root.addEventListener("click", () => SpotiKitBridge.next());
    return this.root;
  },

  async update(duration, progress) {
    if (!this.root) return;
    const remaining = duration - progress;
    const shouldShow = duration > 40000 && remaining > 0 && remaining < 20000;

    if (shouldShow && !this.shown && !this._loading) {
      this._loading = true;
      try {
        const nextTrack = await SpotiKitBridge.getNextTrack();
        if (!this.root || !this.title || !this.artist || !this.img || SpotiKitBridge.isStopped()) {
          return;
        }
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
      } finally {
        this._loading = false;
      }
    } else if (!shouldShow && this.shown) {
      this.root.classList.remove("fr-show");
      this.shown = false;
    }
  },

  reset() {
    this.shown = false;
    this._loading = false;
    if (this.root) this.root.classList.remove("fr-show");
  },

  destroy() {
    this.reset();
    this.root?.remove();
    this.root = null;
    this.img = null;
    this.title = null;
    this.artist = null;
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
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");
const {  App  } = require("./App.js");

// CSS placeholder replaced at build time with bundled styles from src/styles/*.css
const STYLES = "\n/* --- variables.css --- */\n:root {\r\n  --fr-bg: #060607;\r\n  --fr-fg: #ffffff;\r\n  --fr-fg-dim: rgba(255, 255, 255, 0.78);\r\n  --fr-fg-faint: rgba(255, 255, 255, 0.52);\r\n  --fr-accent: #ffffff;\r\n  --fr-accent-2: #101014;\r\n  --fr-radius: 18px;\r\n  --fr-font: \"Spotify Circular\", \"Circular Std\", -apple-system, \"Segoe UI\", Helvetica, Arial, sans-serif;\r\n  --fr-transition: 900ms;\r\n}\r\n\r\n#fullscreen-reloaded-root {\r\n  position: fixed;\r\n  inset: 0;\r\n  z-index: 999999;\r\n  font-family: var(--fr-font);\r\n  color: var(--fr-fg);\r\n  visibility: hidden;\r\n  opacity: 0;\r\n  transition: opacity 600ms cubic-bezier(0.2, 0.8, 0.2, 1), visibility 600ms;\r\n  overflow: hidden;\r\n  user-select: none;\r\n}\r\n\r\n#fullscreen-reloaded-root.fr-open {\r\n  visibility: visible;\r\n  opacity: 1;\r\n}\r\n\r\n#fullscreen-reloaded-root * {\r\n  box-sizing: border-box;\r\n}\r\n\n/* --- background.css --- */\n/* ---------------- Background ---------------- */\r\n.fr-bg-root {\r\n  position: absolute;\r\n  inset: 0;\r\n  overflow: hidden;\r\n  z-index: 0;\r\n}\r\n\r\n.fr-bg-layer {\r\n  position: absolute;\r\n  inset: -5%;\r\n  width: 110%;\r\n  height: 110%;\r\n  background-position: center;\r\n  background-size: cover;\r\n  opacity: 0;\r\n  transition: opacity var(--fr-transition) ease;\r\n  will-change: opacity;\r\n}\r\n\r\n.fr-bg-layer.fr-bg-active {\r\n  opacity: 1;\r\n}\r\n\r\n.fr-bg-tint {\r\n  position: absolute;\r\n  inset: 0;\r\n  background: radial-gradient(ellipse at 30% 20%, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.55) 75%);\r\n  pointer-events: none;\r\n}\r\n\r\n.fr-bg-scrim {\r\n  position: absolute;\r\n  inset: 0;\r\n  background: linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.05) 30%, rgba(0, 0, 0, 0.55) 100%);\r\n  pointer-events: none;\r\n}\r\n\n/* --- stage.css --- */\n/* ---------------- Layout & Album Art ---------------- */\r\n.fr-stage {\r\n  position: relative;\r\n  z-index: 2;\r\n  height: 100%;\r\n  display: grid;\r\n  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);\r\n  grid-template-rows: 1fr;\r\n  grid-template-areas: \"art lyrics\";\r\n  padding: clamp(24px, 3.2vw, 64px);\r\n  padding-bottom: clamp(100px, 14vh, 160px);\r\n  gap: clamp(16px, 2vw, 40px);\r\n  opacity: 0;\r\n  transform: translateY(24px) scale(0.98);\r\n  transition: grid-template-columns 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), gap 0.8s, opacity 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms, transform 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms;\r\n}\r\n\r\n#fullscreen-reloaded-root.fr-open .fr-stage {\r\n  opacity: 1;\r\n  transform: translateY(0) scale(1);\r\n}\r\n\r\n.fr-stage.fr-centered {\r\n  grid-template-columns: 1fr;\r\n  grid-template-areas: \"art\";\r\n}\r\n\r\n.fr-stage.fr-centered .fr-lyrics-panel {\r\n  display: none;\r\n}\r\n\r\n/* ---------------- Album art ---------------- */\r\n.fr-art-panel {\r\n  grid-area: art;\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  min-height: 0;\r\n  min-width: 0;\r\n}\r\n\r\n.fr-art-wrap {\r\n  --fr-art-beat: 0;\r\n  --fr-glow-beat: 0.55;\r\n  --fr-glow-spread: 0%;\r\n  position: relative;\r\n  width: min(58vh, 44vw, 640px);\r\n  aspect-ratio: 1 / 1;\r\n  transform: scale(calc(1 + var(--fr-art-beat, 0)));\r\n  transition: width 300ms ease, transform 75ms linear;\r\n  will-change: transform;\r\n}\r\n\r\n.fr-stage.fr-size-medium .fr-art-wrap { width: min(48vh, 35vw, 520px); }\r\n.fr-stage.fr-size-small .fr-art-wrap { width: min(38vh, 28vw, 420px); }\r\n.fr-stage.fr-centered .fr-art-wrap { width: min(62vh, 40vw, 720px); }\r\n\r\n.fr-art-img {\r\n  position: absolute;\r\n  inset: 0;\r\n  width: 100%;\r\n  height: 100%;\r\n  object-fit: cover;\r\n  border-radius: var(--fr-radius);\r\n  box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.65);\r\n  opacity: 0;\r\n  transform: scale(0.985);\r\n  transition: opacity 520ms ease, transform 520ms cubic-bezier(.2, .8, .2, 1), box-shadow 300ms ease;\r\n}\r\n\r\n.fr-art-img.fr-art-active {\r\n  opacity: 1;\r\n  transform: scale(1);\r\n}\r\n\r\n.fr-art-wrap.fr-no-shadow .fr-art-img {\r\n  box-shadow: none;\r\n}\r\n\r\n.fr-art-wrap.fr-glow::after {\r\n  content: \"\";\r\n  position: absolute;\r\n  inset: calc(-6% - var(--fr-glow-spread, 0%));\r\n  border-radius: calc(var(--fr-radius) + 14px);\r\n  background: var(--fr-art-glow, transparent);\r\n  filter: blur(50px);\r\n  opacity: var(--fr-glow-beat, 0.55);\r\n  z-index: -1;\r\n  transition: background 700ms ease, opacity 85ms linear, inset 85ms linear;\r\n  will-change: opacity, inset;\r\n}\r\n\r\n.fr-art-wrap:hover .fr-art-img {\r\n  transform: scale(1.012);\r\n}\r\n\r\n.fr-meta {\r\n  margin-top: clamp(18px, 2vw, 32px);\r\n  text-align: left;\r\n  max-width: min(58vh, 44vw, 640px);\r\n  transition: opacity 300ms ease, transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1);\r\n}\r\n\r\n.fr-meta.fr-meta-animating {\r\n  opacity: 0;\r\n  transform: translateY(8px);\r\n}\r\n\r\n.fr-stage.fr-centered .fr-meta {\r\n  text-align: center;\r\n  margin-left: auto;\r\n  margin-right: auto;\r\n}\r\n\r\n.fr-title {\r\n  font-size: clamp(22px, 2.4vw, 38px);\r\n  font-weight: 700;\r\n  letter-spacing: -0.01em;\r\n  line-height: 1.15;\r\n  margin: 0 0 6px 0;\r\n  white-space: nowrap;\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n}\r\n\r\n.fr-artist {\r\n  font-size: clamp(14px, 1.2vw, 18px);\r\n  color: var(--fr-fg-dim);\r\n  margin: 0 0 2px 0;\r\n  white-space: nowrap;\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n}\r\n\r\n.fr-album {\r\n  font-size: clamp(12px, 1vw, 15px);\r\n  color: var(--fr-fg-faint);\r\n  margin: 0;\r\n}\r\n\r\n/* ---------------- Progress Ring ---------------- */\r\n.fr-progress-ring {\r\n  position: absolute;\r\n  inset: 0;\r\n  width: 100%;\r\n  height: 100%;\r\n  overflow: visible;\r\n  pointer-events: none;\r\n  z-index: 3;\r\n  transform: rotate(-90deg);\r\n  transform-origin: center;\r\n  opacity: 0;\r\n  transition: opacity 400ms ease;\r\n}\r\n\r\n#fullscreen-reloaded-root.fr-open .fr-progress-ring {\r\n  opacity: 0.75;\r\n}\r\n\r\n.fr-progress-ring-rect {\r\n  fill: transparent;\r\n  stroke: var(--fr-word-accent, #fff);\r\n  stroke-width: 4;\r\n  stroke-linecap: round;\r\n  stroke-dasharray: 100;\r\n  stroke-dashoffset: 100;\r\n  transition: stroke-dashoffset 0.1s linear, stroke 0.3s ease;\r\n}\r\n\n/* --- lyrics.css --- */\n/* ---------------- Lyrics Panel (True Per-Line & Per-Word Waterfall Engine) ---------------- */\r\n.fr-lyrics-panel {\r\n  grid-area: lyrics;\r\n  position: relative;\r\n  min-height: 0;\r\n  display: flex;\r\n  flex-direction: column;\r\n}\r\n\r\n/* ---------------- \"Provided by\" 3-Second Startup Badge ---------------- */\r\n.fr-provider-badge {\r\n  position: absolute;\r\n  top: 10px;\r\n  left: 14px;\r\n  z-index: 8;\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  padding: 6px 14px;\r\n  border-radius: 999px;\r\n  background: rgba(18, 18, 24, 0.74);\r\n  backdrop-filter: blur(28px) saturate(1.8);\r\n  -webkit-backdrop-filter: blur(28px) saturate(1.8);\r\n  border: 1px solid rgba(255, 255, 255, 0.15);\r\n  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42), inset 0 1px 1px rgba(255, 255, 255, 0.16);\r\n  pointer-events: none;\r\n  opacity: 0;\r\n  transform: translate3d(0, -10px, 0) scale(0.96);\r\n  transition: opacity 400ms cubic-bezier(0.22, 1, 0.36, 1),\r\n              transform 400ms cubic-bezier(0.22, 1, 0.36, 1);\r\n}\r\n\r\n.fr-provider-badge.fr-show {\r\n  opacity: 1;\r\n  transform: translate3d(0, 0, 0) scale(1);\r\n}\r\n\r\n.fr-provider-dot {\r\n  width: 6px;\r\n  height: 6px;\r\n  border-radius: 50%;\r\n  background: #30d158;\r\n  box-shadow: 0 0 8px rgba(48, 209, 88, 0.85);\r\n  flex-shrink: 0;\r\n}\r\n\r\n.fr-provider-prefix {\r\n  font-size: 11.5px;\r\n  font-weight: 500;\r\n  color: rgba(255, 255, 255, 0.58);\r\n}\r\n\r\n.fr-provider-name {\r\n  font-size: 12px;\r\n  font-weight: 700;\r\n  color: #ffffff;\r\n}\r\n\r\n.fr-provider-tag {\r\n  font-size: 9.5px;\r\n  font-weight: 700;\r\n  text-transform: uppercase;\r\n  letter-spacing: 0.05em;\r\n  padding: 2px 7px;\r\n  border-radius: 999px;\r\n  background: rgba(255, 255, 255, 0.13);\r\n  color: rgba(255, 255, 255, 0.88);\r\n}\r\n\r\n/* ---------------- Scroll & Waterfall Viewport ---------------- */\r\n.fr-lyrics-scroll {\r\n  --fr-word-step: 120ms;\r\n  --fr-word-dur: 900ms;\r\n  --fr-line-dur: 820ms;\r\n  --fr-word-drop-future: -9px;\r\n  --fr-word-drop-past: 7px;\r\n  flex: 1;\r\n  overflow: hidden;\r\n  position: relative;\r\n  mask-image: linear-gradient(\r\n    180deg,\r\n    transparent 0%,\r\n    rgba(0, 0, 0, 0.45) 8%,\r\n    #000 20%,\r\n    #000 80%,\r\n    rgba(0, 0, 0, 0.45) 92%,\r\n    transparent 100%\r\n  );\r\n  -webkit-mask-image: linear-gradient(\r\n    180deg,\r\n    transparent 0%,\r\n    rgba(0, 0, 0, 0.45) 8%,\r\n    #000 20%,\r\n    #000 80%,\r\n    rgba(0, 0, 0, 0.45) 92%,\r\n    transparent 100%\r\n  );\r\n  padding: 6vh 14px 40vh 14px;\r\n  scrollbar-width: none;\r\n  opacity: 0;\r\n  transition: opacity 420ms ease;\r\n}\r\n\r\n.fr-lyrics-scroll[data-waterfall=\"intense\"] {\r\n  --fr-word-step: 165ms;\r\n  --fr-word-dur: 1150ms;\r\n  --fr-line-dur: 980ms;\r\n  --fr-word-drop-future: -13px;\r\n  --fr-word-drop-past: 10px;\r\n}\r\n\r\n.fr-lyrics-scroll[data-waterfall=\"off\"] {\r\n  --fr-word-step: 0ms;\r\n  --fr-word-dur: 450ms;\r\n  --fr-line-dur: 500ms;\r\n  --fr-word-drop-future: 0px;\r\n  --fr-word-drop-past: 0px;\r\n}\r\n\r\n.fr-lyrics-scroll.fr-unsynced {\r\n  overflow-y: auto;\r\n  padding: 14vh 14px 28vh 14px;\r\n}\r\n\r\n.fr-lyrics-scroll.fr-ready {\r\n  opacity: 1;\r\n}\r\n\r\n.fr-lyrics-scroll::-webkit-scrollbar {\r\n  display: none;\r\n}\r\n\r\n/* ---------------- Per-Line Staggered Spring Waterfall Positioning ---------------- */\r\n.fr-lyric-line {\r\n  --fr-scale: 0.935;\r\n  font-size: clamp(20px, 2.35vw, 31px);\r\n  font-weight: 600;\r\n  letter-spacing: -0.01em;\r\n  line-height: 1.48;\r\n  color: rgba(255, 255, 255, 0.32);\r\n  margin: 6px 0;\r\n  padding: 10px 14px;\r\n  border-radius: 16px;\r\n  transform-origin: left center;\r\n  transform: translate3d(0, var(--fr-cascade-y, 0px), 0) scale(var(--fr-scale));\r\n  filter: blur(0px);\r\n  transition:\r\n    transform var(--fr-line-dur, 820ms) cubic-bezier(0.22, 1, 0.36, 1) var(--fr-stagger, 0ms),\r\n    color 720ms cubic-bezier(0.22, 1, 0.36, 1) var(--fr-stagger, 0ms),\r\n    opacity 720ms cubic-bezier(0.22, 1, 0.36, 1) var(--fr-stagger, 0ms),\r\n    filter 720ms cubic-bezier(0.22, 1, 0.36, 1) var(--fr-stagger, 0ms),\r\n    background-color 250ms ease;\r\n  cursor: default;\r\n  -webkit-font-smoothing: antialiased;\r\n  -moz-osx-font-smoothing: grayscale;\r\n  will-change: transform, filter, opacity;\r\n}\r\n\r\n.fr-lyrics-scroll.fr-no-transition .fr-lyric-line,\r\n.fr-lyrics-scroll.fr-no-transition .fr-lyric-word,\r\n.fr-lyrics-scroll.fr-no-transition .fr-lyric-sentence {\r\n  transition: none !important;\r\n}\r\n\r\n.fr-lyrics-scroll.fr-user-scrolling .fr-lyric-line {\r\n  transition:\r\n    transform 90ms linear 0ms,\r\n    color 300ms ease 0ms,\r\n    filter 300ms ease 0ms !important;\r\n}\r\n\r\n/* Depth-of-field distance classes */\r\n.fr-lyric-line.fr-near-1 {\r\n  --fr-scale: 0.965;\r\n  color: rgba(255, 255, 255, 0.44);\r\n  filter: blur(0.6px);\r\n}\r\n\r\n.fr-lyric-line.fr-near-2 {\r\n  --fr-scale: 0.935;\r\n  color: rgba(255, 255, 255, 0.28);\r\n  filter: blur(1.5px);\r\n}\r\n\r\n.fr-lyric-line.fr-far {\r\n  --fr-scale: 0.905;\r\n  color: rgba(255, 255, 255, 0.17);\r\n  filter: blur(2.4px);\r\n}\r\n\r\n.fr-lyrics-scroll[data-waterfall=\"off\"] .fr-lyric-line {\r\n  filter: none !important;\r\n}\r\n\r\n.fr-lyric-line.fr-active {\r\n  --fr-scale: 1.035;\r\n  color: #ffffff;\r\n  filter: blur(0px);\r\n}\r\n\r\n/* ---------------- Full-Sentence Sweep & Waterfall Flow (Line-Synced 'synced' Mode — NOT Word-by-Word) ---------------- */\r\n.fr-lyric-sentence {\r\n  display: inline-block;\r\n  white-space: pre-wrap;\r\n  color: inherit;\r\n}\r\n\r\n.fr-lyrics-scroll.fr-mode-line .fr-lyric-line.fr-future .fr-lyric-sentence {\r\n  transform: translate3d(0, var(--fr-word-drop-future), 0);\r\n  opacity: 0.78;\r\n  transition:\r\n    transform var(--fr-word-dur, 900ms) cubic-bezier(0.22, 1, 0.36, 1),\r\n    opacity 680ms ease;\r\n}\r\n\r\n.fr-lyrics-scroll.fr-mode-line .fr-lyric-line.fr-active .fr-lyric-sentence {\r\n  color: transparent;\r\n  background-image: linear-gradient(\r\n    100deg,\r\n    #ffffff 0%,\r\n    #ffffff calc(var(--bar-pct, 0%) - 18%),\r\n    rgba(255, 255, 255, 0.64) calc(var(--bar-pct, 0%) - 9%),\r\n    rgba(255, 255, 255, 0.32) calc(var(--bar-pct, 0%)),\r\n    rgba(255, 255, 255, 0.32) 100%\r\n  );\r\n  -webkit-background-clip: text;\r\n  background-clip: text;\r\n  -webkit-text-fill-color: transparent;\r\n  transform: translate3d(0, var(--bar-flow-y, var(--fr-word-drop-future)), 0);\r\n  filter: drop-shadow(0 2px 16px rgba(255, 255, 255, 0.32));\r\n  transition:\r\n    transform 80ms linear,\r\n    filter 280ms ease;\r\n  will-change: transform, background-image;\r\n}\r\n\r\n.fr-lyrics-scroll.fr-mode-line .fr-lyric-line.fr-past .fr-lyric-sentence {\r\n  color: inherit;\r\n  -webkit-text-fill-color: currentColor;\r\n  background-image: none;\r\n  transform: translate3d(0, var(--fr-word-drop-past), 0);\r\n  opacity: 0.72;\r\n  filter: none;\r\n  transition:\r\n    transform var(--fr-word-dur, 900ms) cubic-bezier(0.22, 1, 0.36, 1),\r\n    opacity 720ms ease,\r\n    filter 450ms ease;\r\n}\r\n\r\n/* ---------------- Per-Word Waterfall & Karaoke Sweep (ONLY on Word-Synced 'word-by-word' Mode) ---------------- */\r\n.fr-lyric-word {\r\n  display: inline-block;\r\n  white-space: pre-wrap;\r\n  color: inherit;\r\n}\r\n\r\n.fr-lyrics-scroll.fr-mode-word .fr-lyric-line.fr-future .fr-lyric-word {\r\n  transform: translate3d(0, var(--fr-word-drop-future), 0);\r\n  opacity: 0.74;\r\n  transition:\r\n    transform var(--fr-word-dur, 900ms) cubic-bezier(0.22, 1, 0.36, 1),\r\n    opacity 680ms ease;\r\n}\r\n\r\n/* Unsung word inside active line: poised above (-8px) in soft muted white, waiting for its timestamp */\r\n.fr-lyrics-scroll.fr-mode-word .fr-lyric-line.fr-active .fr-lyric-word {\r\n  color: rgba(255, 255, 255, 0.34);\r\n  -webkit-text-fill-color: rgba(255, 255, 255, 0.34);\r\n  background-image: none;\r\n  opacity: 1;\r\n  transform: translate3d(0, var(--w-lift, var(--fr-word-drop-future)), 0) scale(var(--w-scale, 0.985));\r\n  transform-origin: center baseline;\r\n  filter: none;\r\n  transition:\r\n    transform 75ms linear,\r\n    filter 180ms ease,\r\n    color 180ms ease;\r\n  will-change: transform, background-image, filter;\r\n}\r\n\r\n/* Word currently being sung: glides smoothly from top to 0px while sweeping white light left-to-right */\r\n.fr-lyrics-scroll.fr-mode-word .fr-lyric-line.fr-active .fr-lyric-word.fr-w-active {\r\n  color: transparent;\r\n  background-image: linear-gradient(\r\n    105deg,\r\n    #ffffff 0%,\r\n    #ffffff calc(var(--w-pct, -18%) - 14%),\r\n    rgba(255, 255, 255, 0.9) calc(var(--w-pct, -18%)),\r\n    rgba(255, 255, 255, 0.34) calc(var(--w-pct, -18%) + 14%),\r\n    rgba(255, 255, 255, 0.34) 100%\r\n  );\r\n  -webkit-background-clip: text;\r\n  background-clip: text;\r\n  -webkit-text-fill-color: transparent;\r\n  filter: drop-shadow(0 2px 14px rgba(255, 255, 255, 0.38));\r\n}\r\n\r\n/* Word finished being sung: rests cleanly at 0px in full bright white */\r\n.fr-lyrics-scroll.fr-mode-word .fr-lyric-line.fr-active .fr-lyric-word.fr-w-done {\r\n  color: #ffffff;\r\n  -webkit-text-fill-color: #ffffff;\r\n  background-image: none;\r\n  transform: translate3d(0, 0px, 0) scale(1);\r\n  filter: drop-shadow(0 2px 16px rgba(255, 255, 255, 0.28));\r\n}\r\n\r\n/* Past line: words cascade gently downward (+7px) with a left-to-right stagger */\r\n.fr-lyrics-scroll.fr-mode-word .fr-lyric-line.fr-past .fr-lyric-word {\r\n  color: inherit;\r\n  -webkit-text-fill-color: currentColor;\r\n  background-image: none;\r\n  transform: translate3d(0, var(--fr-word-drop-past), 0);\r\n  opacity: 0.72;\r\n  filter: none;\r\n  transition:\r\n    transform var(--fr-word-dur, 900ms) cubic-bezier(0.22, 1, 0.36, 1) calc(var(--w-idx, 0) * 55ms),\r\n    opacity 720ms ease calc(var(--w-idx, 0) * 55ms),\r\n    filter 450ms ease;\r\n}\r\n\r\n/* Interactive hover for synced lines */\r\n.fr-lyric-line.fr-synced {\r\n  cursor: pointer;\r\n}\r\n\r\n.fr-lyric-line.fr-synced:hover {\r\n  background-color: rgba(255, 255, 255, 0.05);\r\n  color: rgba(255, 255, 255, 0.85);\r\n  filter: blur(0px);\r\n}\r\n\r\n/* ---------------- Apple Music Duet (Right-Aligned Singer v2) & Background Vocals ---------------- */\r\n.fr-lyric-line.fr-duet-right {\r\n  text-align: right;\r\n  transform-origin: right center;\r\n}\r\n\r\n.fr-lyric-line.fr-duet-right .fr-interlude-dots {\r\n  justify-content: flex-end;\r\n  transform-origin: right center;\r\n}\r\n\r\n/* Standalone background vocal line (e.g. \"(Yeah, ooh)\" or full x-bg paragraph) */\r\n.fr-lyric-line.fr-bg-only-line {\r\n  font-size: clamp(16px, 1.85vw, 24px);\r\n  font-weight: 500;\r\n  font-style: italic;\r\n  letter-spacing: 0;\r\n  padding-top: 5px;\r\n  padding-bottom: 5px;\r\n}\r\n\r\n.fr-lyric-line.fr-bg-only-line.fr-active {\r\n  --fr-scale: 1.0;\r\n  opacity: 0.88;\r\n}\r\n\r\n/* Sub-line background vocal attached right below a main vocal line */\r\n.fr-bg-vocal-sub {\r\n  display: block;\r\n  margin-top: 3px;\r\n  font-size: 0.72em;\r\n  font-weight: 500;\r\n  font-style: italic;\r\n  line-height: 1.35;\r\n  letter-spacing: 0;\r\n  opacity: 0.82;\r\n}\r\n\r\n.fr-lyric-line.fr-future .fr-bg-vocal-sub {\r\n  opacity: 0.65;\r\n}\r\n\r\n.fr-lyric-line.fr-past .fr-bg-vocal-sub {\r\n  opacity: 0.58;\r\n}\r\n\r\n/* ---------------- Unsynced Teleprompter Mode ---------------- */\r\n.fr-lyrics-scroll.fr-unsynced .fr-lyric-line {\r\n  font-size: clamp(19px, 2.2vw, 28px);\r\n  font-weight: 500;\r\n  line-height: 1.6;\r\n  color: rgba(255, 255, 255, 0.84);\r\n  transform: none !important;\r\n  filter: none !important;\r\n  padding: 8px 14px;\r\n}\r\n\r\n.fr-lyrics-scroll.fr-unsynced .fr-lyric-word {\r\n  transform: none !important;\r\n  opacity: 1 !important;\r\n}\r\n\r\n/* ---------------- Instrumental Symbol & Apple Music Interlude Dots (• • •) ---------------- */\r\n.fr-lyric-line.fr-is-music {\r\n  padding: 16px 14px;\r\n}\r\n\r\n.fr-interlude-dots {\r\n  display: flex;\r\n  width: 100%;\r\n  align-items: center;\r\n  gap: 10px;\r\n  height: 0;\r\n  opacity: 0;\r\n  overflow: hidden;\r\n  margin-bottom: 0;\r\n  transform: translate3d(0, -6px, 0) scale(0.75);\r\n  transform-origin: left center;\r\n  pointer-events: none;\r\n  transition:\r\n    height 420ms cubic-bezier(0.22, 1, 0.36, 1),\r\n    margin-bottom 420ms cubic-bezier(0.22, 1, 0.36, 1),\r\n    opacity 380ms ease,\r\n    transform 420ms cubic-bezier(0.22, 1, 0.36, 1);\r\n}\r\n\r\n.fr-interlude-dots.fr-inline-music-dots {\r\n  height: 28px;\r\n  opacity: 0.45;\r\n  overflow: visible;\r\n  transform: scale(0.9);\r\n}\r\n\r\n.fr-interlude-dots.fr-interlude-active {\r\n  height: 28px;\r\n  margin-bottom: 10px;\r\n  opacity: 1;\r\n  overflow: visible;\r\n  transform: translate3d(0, 0, 0) scale(1);\r\n}\r\n\r\n.fr-interlude-dot {\r\n  width: 11px;\r\n  height: 11px;\r\n  border-radius: 50%;\r\n  background: #ffffff;\r\n  opacity: 0.25;\r\n  box-shadow: 0 0 14px rgba(255, 255, 255, 0.55);\r\n  transition: opacity 150ms linear;\r\n  will-change: transform, opacity;\r\n}\r\n\r\n/* ---------------- Resume Sync Pill ---------------- */\r\n.fr-resume-sync {\r\n  position: absolute;\r\n  bottom: 12px;\r\n  left: 50%;\r\n  transform: translateX(-50%);\r\n  background: rgba(24, 24, 30, 0.78);\r\n  backdrop-filter: blur(20px);\r\n  -webkit-backdrop-filter: blur(20px);\r\n  border: 1px solid rgba(255, 255, 255, 0.16);\r\n  color: #ffffff;\r\n  padding: 8px 18px;\r\n  border-radius: 999px;\r\n  font-size: 12.5px;\r\n  font-weight: 600;\r\n  cursor: pointer;\r\n  opacity: 0;\r\n  pointer-events: none;\r\n  transition: opacity 220ms ease, transform 220ms ease;\r\n  z-index: 9;\r\n}\r\n\r\n.fr-resume-sync.fr-show {\r\n  opacity: 1;\r\n  pointer-events: auto;\r\n  transform: translateX(-50%) translateY(-4px);\r\n}\r\n\r\n.fr-resume-sync:hover {\r\n  background: rgba(255, 255, 255, 0.18);\r\n}\r\n\r\n/* ---------------- Instrumental / No-Lyrics Panel ---------------- */\r\n.fr-instrumental {\r\n  position: absolute;\r\n  top: 50%;\r\n  left: 50%;\r\n  transform: translate(-50%, -50%) scale(0.85);\r\n  display: flex;\r\n  flex-direction: column;\r\n  align-items: center;\r\n  gap: 20px;\r\n  opacity: 0;\r\n  pointer-events: none;\r\n  transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);\r\n  z-index: 3;\r\n}\r\n\r\n.fr-instrumental.fr-show {\r\n  opacity: 1;\r\n  transform: translate(-50%, -50%) scale(1);\r\n}\r\n\r\n.fr-instrumental-bars {\r\n  display: flex;\r\n  align-items: flex-end;\r\n  gap: 5px;\r\n  height: 44px;\r\n}\r\n\r\n.fr-instrumental-bar {\r\n  width: 5px;\r\n  border-radius: 999px;\r\n  background: rgba(255, 255, 255, 0.75);\r\n  animation: instrBar 1.2s ease-in-out infinite alternate;\r\n}\r\n\r\n.fr-instrumental-bar:nth-child(1) { animation-delay: 0s;    animation-duration: 0.9s; }\r\n.fr-instrumental-bar:nth-child(2) { animation-delay: 0.15s; animation-duration: 1.1s; }\r\n.fr-instrumental-bar:nth-child(3) { animation-delay: 0.3s;  animation-duration: 0.8s; }\r\n.fr-instrumental-bar:nth-child(4) { animation-delay: 0.1s;  animation-duration: 1.3s; }\r\n.fr-instrumental-bar:nth-child(5) { animation-delay: 0.25s; animation-duration: 1.0s; }\r\n.fr-instrumental-bar:nth-child(6) { animation-delay: 0.4s;  animation-duration: 0.85s; }\r\n.fr-instrumental-bar:nth-child(7) { animation-delay: 0.05s; animation-duration: 1.2s; }\r\n\r\n@keyframes instrBar {\r\n  0%   { height: 6px; opacity: 0.35; }\r\n  100% { height: 40px; opacity: 0.95; }\r\n}\r\n\r\n.fr-instrumental-label {\r\n  font-size: 12px;\r\n  font-weight: 600;\r\n  color: rgba(255, 255, 255, 0.48);\r\n  letter-spacing: 0.08em;\r\n  text-transform: uppercase;\r\n}\r\n\n/* --- controls.css --- */\n/* ---------------- Bottom Dock (Controls + Volume + Queue) ---------------- */\r\n.fr-bottom-bar {\r\n  position: absolute;\r\n  bottom: clamp(24px, 3.2vw, 40px);\r\n  left: 50%;\r\n  transform: translateX(-50%);\r\n  width: min(92vw, 1000px);\r\n  background: rgba(30, 30, 35, 0.35);\r\n  backdrop-filter: blur(60px) saturate(2.5);\r\n  border: none;\r\n  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.2), inset 0 -1px 1px rgba(0, 0, 0, 0.1);\r\n  border-radius: 999px;\r\n  padding: 12px 28px;\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n  gap: 32px;\r\n  z-index: 5;\r\n  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n}\r\n\r\n#fullscreen-reloaded-root.fr-idle .fr-bottom-bar {\r\n  opacity: 0;\r\n  pointer-events: none;\r\n  transform: translate(-50%, 40px) scale(0.95);\r\n}\r\n\r\n.fr-controls-left,\r\n.fr-controls-right {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n}\r\n\r\n.fr-controls-center {\r\n  flex: 1;\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 16px;\r\n  font-size: 12px;\r\n  color: var(--fr-fg-dim);\r\n  font-variant-numeric: tabular-nums;\r\n}\r\n\r\n.fr-progress-bar {\r\n  flex: 1;\r\n  height: 6px;\r\n  border-radius: 999px;\r\n  background: rgba(255, 255, 255, 0.12);\r\n  position: relative;\r\n  cursor: pointer;\r\n  overflow: hidden;\r\n}\r\n\r\n.fr-progress-bar:hover {\r\n  overflow: visible;\r\n}\r\n\r\n.fr-progress-fill {\r\n  position: absolute;\r\n  inset: 0 auto 0 0;\r\n  width: 0%;\r\n  border-radius: 999px;\r\n  background: var(--fr-fg);\r\n}\r\n\r\n.fr-progress-bar:hover .fr-progress-fill {\r\n  background: var(--fr-word-accent, #ffffff);\r\n}\r\n\r\n.fr-progress-handle {\r\n  position: absolute;\r\n  top: 50%;\r\n  width: 14px;\r\n  height: 14px;\r\n  border-radius: 50%;\r\n  background: var(--fr-fg);\r\n  left: 0%;\r\n  transform: translate(-50%, -50%) scale(0);\r\n  transition: transform 120ms ease;\r\n  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);\r\n}\r\n\r\n.fr-progress-bar:hover .fr-progress-handle {\r\n  transform: translate(-50%, -50%) scale(1);\r\n}\r\n\r\n.fr-btn {\r\n  background: transparent;\r\n  border: none;\r\n  color: var(--fr-fg-dim);\r\n  cursor: pointer;\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  padding: 10px;\r\n  border-radius: 50%;\r\n  transition: color 150ms ease, transform 100ms ease, background 150ms ease;\r\n}\r\n\r\n.fr-btn:hover {\r\n  color: var(--fr-fg);\r\n  background: rgba(255, 255, 255, 0.08);\r\n}\r\n\r\n.fr-btn:active {\r\n  transform: scale(0.92);\r\n}\r\n\r\n.fr-btn.fr-active {\r\n  color: var(--fr-word-accent, #1ed760);\r\n}\r\n\r\n.fr-btn-play {\r\n  width: 48px;\r\n  height: 48px;\r\n  background: var(--fr-fg);\r\n  color: #000;\r\n}\r\n\r\n.fr-btn-play:hover {\r\n  background: var(--fr-fg);\r\n  transform: scale(1.04);\r\n  color: #000;\r\n}\r\n\r\n.fr-btn svg {\r\n  width: 22px;\r\n  height: 22px;\r\n}\r\n\r\n.fr-btn-play svg {\r\n  width: 24px;\r\n  height: 24px;\r\n}\r\n\r\n.fr-volume-row {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  width: 140px;\r\n}\r\n\r\n.fr-volume-bar {\r\n  flex: 1;\r\n  height: 6px;\r\n  border-radius: 999px;\r\n  background: rgba(255, 255, 255, 0.12);\r\n  position: relative;\r\n  cursor: pointer;\r\n  overflow: hidden;\r\n}\r\n\r\n.fr-volume-bar:hover {\r\n  overflow: visible;\r\n}\r\n\r\n.fr-volume-fill {\r\n  position: absolute;\r\n  inset: 0 auto 0 0;\r\n  width: 100%;\r\n  border-radius: 999px;\r\n  background: var(--fr-fg);\r\n  transition: width 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n}\r\n\r\n.fr-volume-bar:hover .fr-volume-fill {\r\n  background: var(--fr-word-accent, #ffffff);\r\n}\r\n\r\n.fr-volume-handle {\r\n  position: absolute;\r\n  top: 50%;\r\n  width: 14px;\r\n  height: 14px;\r\n  border-radius: 50%;\r\n  background: var(--fr-fg);\r\n  left: 100%;\r\n  transform: translate(-50%, -50%) scale(0);\r\n  transition: transform 150ms ease, left 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);\r\n}\r\n\r\n.fr-volume-bar:hover .fr-volume-handle {\r\n  transform: translate(-50%, -50%) scale(1);\r\n}\r\n\n/* --- topbar.css --- */\n/* ---------------- Top bar ---------------- */\r\n.fr-topbar {\r\n  position: absolute;\r\n  top: clamp(18px, 2.4vw, 36px);\r\n  right: clamp(18px, 2.4vw, 36px);\r\n  z-index: 14;\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 4px;\r\n  background: rgba(30, 30, 35, 0.35);\r\n  backdrop-filter: blur(60px) saturate(2.5);\r\n  border-radius: 999px;\r\n  padding: 6px 8px;\r\n  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2), inset 0 -1px 1px rgba(0, 0, 0, 0.1);\r\n  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n}\r\n\r\n#fullscreen-reloaded-root.fr-idle .fr-topbar {\r\n  opacity: 0;\r\n  pointer-events: none;\r\n  transform: translateY(-20px) scale(0.95);\r\n}\r\n\r\n.fr-topbar .fr-btn {\r\n  padding: 8px;\r\n  border-radius: 50%;\r\n  width: 36px;\r\n  height: 36px;\r\n}\r\n\r\n.fr-topbar .fr-btn svg {\r\n  width: 18px;\r\n  height: 18px;\r\n}\r\n\r\n.fr-topbar-sep {\r\n  width: 1px;\r\n  height: 20px;\r\n  background: rgba(255, 255, 255, 0.12);\r\n  margin: 0 2px;\r\n}\r\n\r\n.fr-topbar .fr-btn.fr-active {\r\n  color: var(--fr-word-accent, #1ed760);\r\n}\r\n\r\n.fr-topbar .fr-btn.fr-heart-active {\r\n  color: #ff4d6a;\r\n}\r\n\n/* --- settings.css --- */\n/* ---------------- Settings panel (Liquid Glass) ---------------- */\r\n.fr-settings-panel {\r\n  position: absolute;\r\n  top: clamp(60px, 6vw, 84px);\r\n  right: clamp(18px, 2.4vw, 36px);\r\n  z-index: 25;\r\n  width: min(360px, 92vw);\r\n  max-height: min(84vh, 700px);\r\n  overflow-y: auto;\r\n  overflow-x: hidden;\r\n  scrollbar-width: thin;\r\n  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;\r\n  background: rgba(24, 24, 30, 0.85);\r\n  backdrop-filter: blur(50px) saturate(2);\r\n  -webkit-backdrop-filter: blur(50px) saturate(2);\r\n  border: 1px solid rgba(255, 255, 255, 0.14);\r\n  border-radius: 28px;\r\n  padding: 22px 24px;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 16px;\r\n  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.2), inset 0 -1px 1px rgba(0, 0, 0, 0.1);\r\n  opacity: 0;\r\n  pointer-events: none;\r\n  transform: translateY(-10px) scale(0.96);\r\n  transform-origin: top right;\r\n  transition: opacity 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n}\r\n\r\n.fr-settings-panel::-webkit-scrollbar {\r\n  width: 5px;\r\n}\r\n.fr-settings-panel::-webkit-scrollbar-track {\r\n  background: transparent;\r\n}\r\n.fr-settings-panel::-webkit-scrollbar-thumb {\r\n  background: rgba(255, 255, 255, 0.2);\r\n  border-radius: 999px;\r\n}\r\n.fr-settings-panel::-webkit-scrollbar-thumb:hover {\r\n  background: rgba(255, 255, 255, 0.35);\r\n}\r\n\r\n.fr-settings-panel.fr-show {\r\n  opacity: 1;\r\n  pointer-events: auto;\r\n  transform: translateY(0) scale(1);\r\n}\r\n\r\n.fr-settings-section {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 12px;\r\n}\r\n\r\n.fr-settings-divider {\r\n  height: 1px;\r\n  background: rgba(255, 255, 255, 0.08);\r\n  margin: 2px 0;\r\n}\r\n\r\n.fr-settings-title {\r\n  font-size: 11px;\r\n  font-weight: 800;\r\n  color: rgba(255, 255, 255, 0.45);\r\n  text-transform: uppercase;\r\n  letter-spacing: 0.1em;\r\n  margin: 0 0 2px 0;\r\n}\r\n\r\n.fr-settings-row {\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n  gap: 12px;\r\n  min-height: 32px;\r\n}\r\n\r\n.fr-settings-row label {\r\n  font-size: 14px;\r\n  font-weight: 500;\r\n  color: rgba(255, 255, 255, 0.9);\r\n  user-select: none;\r\n}\r\n\r\n/* ---------------- Custom Liquid Glass Dropdown ---------------- */\r\n.fr-select-wrap {\r\n  position: relative;\r\n  display: inline-block;\r\n}\r\n\r\n.fr-select-btn {\r\n  background: rgba(255, 255, 255, 0.09);\r\n  backdrop-filter: blur(20px);\r\n  -webkit-backdrop-filter: blur(20px);\r\n  border: 1px solid rgba(255, 255, 255, 0.14);\r\n  color: var(--fr-fg);\r\n  border-radius: 999px;\r\n  padding: 6px 14px;\r\n  font-family: inherit;\r\n  font-size: 13px;\r\n  font-weight: 600;\r\n  cursor: pointer;\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n  user-select: none;\r\n  outline: none;\r\n  max-width: 170px;\r\n}\r\n\r\n.fr-select-btn:hover {\r\n  background: rgba(255, 255, 255, 0.16);\r\n  border-color: rgba(255, 255, 255, 0.28);\r\n  transform: scale(1.02);\r\n}\r\n\r\n.fr-select-btn:active {\r\n  transform: scale(0.97);\r\n}\r\n\r\n.fr-select-wrap.fr-open .fr-select-btn {\r\n  background: rgba(255, 255, 255, 0.18);\r\n  border-color: rgba(255, 255, 255, 0.38);\r\n  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);\r\n}\r\n\r\n.fr-select-label {\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.fr-select-arrow {\r\n  width: 16px;\r\n  height: 16px;\r\n  fill: currentColor;\r\n  flex-shrink: 0;\r\n  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n}\r\n\r\n.fr-select-wrap.fr-open .fr-select-arrow {\r\n  transform: rotate(180deg);\r\n}\r\n\r\n.fr-select-menu {\r\n  position: absolute;\r\n  top: calc(100% + 6px);\r\n  right: 0;\r\n  width: max-content;\r\n  min-width: 190px;\r\n  max-width: 285px;\r\n  max-height: 260px;\r\n  overflow-y: auto;\r\n  overflow-x: hidden;\r\n  scrollbar-width: thin;\r\n  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;\r\n  background: rgba(20, 20, 26, 0.96);\r\n  backdrop-filter: blur(44px) saturate(2);\r\n  -webkit-backdrop-filter: blur(44px) saturate(2);\r\n  border: 1px solid rgba(255, 255, 255, 0.16);\r\n  border-radius: 18px;\r\n  padding: 6px;\r\n  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.18);\r\n  z-index: 100;\r\n  opacity: 0;\r\n  pointer-events: none;\r\n  transform: translateY(-8px) scale(0.95);\r\n  transform-origin: top right;\r\n  transition: opacity 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n}\r\n\r\n.fr-select-menu::-webkit-scrollbar {\r\n  width: 4px;\r\n}\r\n.fr-select-menu::-webkit-scrollbar-thumb {\r\n  background: rgba(255, 255, 255, 0.25);\r\n  border-radius: 999px;\r\n}\r\n\r\n.fr-select-wrap.fr-open .fr-select-menu {\r\n  opacity: 1;\r\n  pointer-events: auto;\r\n  transform: translateY(0) scale(1);\r\n}\r\n\r\n.fr-select-item {\r\n  padding: 8px 12px;\r\n  border-radius: 12px;\r\n  font-size: 13px;\r\n  font-weight: 500;\r\n  color: rgba(255, 255, 255, 0.86);\r\n  cursor: pointer;\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n  gap: 14px;\r\n  transition: all 0.15s ease;\r\n  user-select: none;\r\n}\r\n\r\n.fr-select-item-left {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 2px;\r\n  min-width: 0;\r\n}\r\n\r\n.fr-select-item-title {\r\n  white-space: nowrap;\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n}\r\n\r\n.fr-select-item-sub {\r\n  font-size: 10px;\r\n  font-weight: 500;\r\n  color: rgba(255, 255, 255, 0.45);\r\n  letter-spacing: 0.01em;\r\n  white-space: nowrap;\r\n}\r\n\r\n.fr-select-item-right {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  flex-shrink: 0;\r\n}\r\n\r\n.fr-select-item-badge {\r\n  font-size: 10px;\r\n  font-weight: 700;\r\n  letter-spacing: 0.04em;\r\n  text-transform: uppercase;\r\n  padding: 2px 7px;\r\n  border-radius: 999px;\r\n  background: rgba(255, 255, 255, 0.09);\r\n  border: 1px solid rgba(255, 255, 255, 0.12);\r\n  color: rgba(255, 255, 255, 0.72);\r\n}\r\n\r\n.fr-select-item:hover {\r\n  background: rgba(255, 255, 255, 0.11);\r\n  color: #ffffff;\r\n}\r\n\r\n.fr-select-item.fr-selected {\r\n  background: rgba(255, 255, 255, 0.16);\r\n  color: #ffffff;\r\n  font-weight: 600;\r\n}\r\n\r\n.fr-select-item.fr-selected .fr-select-item-badge {\r\n  background: rgba(255, 255, 255, 0.2);\r\n  border-color: rgba(255, 255, 255, 0.32);\r\n  color: #ffffff;\r\n}\r\n\r\n.fr-select-item .fr-check {\r\n  width: 14px;\r\n  height: 14px;\r\n  fill: #ffffff;\r\n  flex-shrink: 0;\r\n  opacity: 0;\r\n}\r\n\r\n.fr-select-item.fr-selected .fr-check {\r\n  opacity: 1;\r\n}\r\n\r\n/* ---------------- Custom Liquid Glass Color Picker ---------------- */\r\n.fr-color-picker-wrap {\r\n  position: relative;\r\n  display: inline-block;\r\n}\r\n\r\n.fr-color-swatch-btn {\r\n  background: rgba(255, 255, 255, 0.09);\r\n  backdrop-filter: blur(20px);\r\n  -webkit-backdrop-filter: blur(20px);\r\n  border: 1px solid rgba(255, 255, 255, 0.14);\r\n  color: var(--fr-fg, #ffffff);\r\n  border-radius: 999px;\r\n  padding: 5px 12px 5px 6px;\r\n  font-family: inherit;\r\n  font-size: 13px;\r\n  font-weight: 600;\r\n  cursor: pointer;\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n  user-select: none;\r\n  outline: none;\r\n}\r\n\r\n.fr-color-swatch-btn:hover {\r\n  background: rgba(255, 255, 255, 0.16);\r\n  border-color: rgba(255, 255, 255, 0.28);\r\n  transform: scale(1.03);\r\n}\r\n\r\n.fr-color-swatch-btn:active {\r\n  transform: scale(0.97);\r\n}\r\n\r\n.fr-color-picker-wrap.fr-open .fr-color-swatch-btn {\r\n  background: rgba(255, 255, 255, 0.22);\r\n  border-color: var(--fr-word-accent, #1ed760);\r\n  box-shadow: 0 0 16px rgba(30, 215, 96, 0.25);\r\n}\r\n\r\n.fr-color-swatch-inner {\r\n  width: 20px;\r\n  height: 20px;\r\n  border-radius: 50%;\r\n  border: 1.5px solid rgba(255, 255, 255, 0.35);\r\n  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);\r\n  flex-shrink: 0;\r\n  transition: background-color 0.2s ease;\r\n}\r\n\r\n.fr-color-hex-label {\r\n  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;\r\n  font-size: 12px;\r\n  letter-spacing: 0.04em;\r\n  color: rgba(255, 255, 255, 0.9);\r\n}\r\n\r\n.fr-color-popup {\r\n  position: absolute;\r\n  top: calc(100% + 8px);\r\n  right: 0;\r\n  width: 240px;\r\n  max-height: 480px;\r\n  overflow-y: auto;\r\n  scrollbar-width: none;\r\n  background: rgba(22, 22, 28, 0.96);\r\n  backdrop-filter: blur(40px) saturate(2);\r\n  -webkit-backdrop-filter: blur(40px) saturate(2);\r\n  border: 1px solid rgba(255, 255, 255, 0.16);\r\n  border-radius: 22px;\r\n  padding: 16px;\r\n  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.2);\r\n  z-index: 100;\r\n  opacity: 0;\r\n  pointer-events: none;\r\n  transform: translateY(-8px) scale(0.95);\r\n  transform-origin: top right;\r\n  transition: opacity 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 12px;\r\n}\r\n\r\n.fr-color-popup::-webkit-scrollbar {\r\n  display: none;\r\n}\r\n\r\n.fr-color-picker-wrap.fr-open .fr-color-popup {\r\n  opacity: 1;\r\n  pointer-events: auto;\r\n  transform: translateY(0) scale(1);\r\n}\r\n\r\n.fr-color-popup-title {\r\n  font-size: 10px;\r\n  font-weight: 800;\r\n  color: rgba(255, 255, 255, 0.45);\r\n  text-transform: uppercase;\r\n  letter-spacing: 0.1em;\r\n  margin-top: 2px;\r\n}\r\n\r\n.fr-color-preset-grid {\r\n  display: grid;\r\n  grid-template-columns: repeat(4, 1fr);\r\n  gap: 10px;\r\n  justify-items: center;\r\n}\r\n\r\n.fr-color-preset-item {\r\n  width: 34px;\r\n  height: 34px;\r\n  border-radius: 50%;\r\n  border: 1.5px solid rgba(255, 255, 255, 0.2);\r\n  cursor: pointer;\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  padding: 0;\r\n  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);\r\n  transition: transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.15s ease, box-shadow 0.15s ease;\r\n  outline: none;\r\n}\r\n\r\n.fr-color-preset-item:hover {\r\n  transform: scale(1.18);\r\n  border-color: rgba(255, 255, 255, 0.7);\r\n  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);\r\n}\r\n\r\n.fr-color-preset-item.fr-selected {\r\n  border-color: #ffffff;\r\n  box-shadow: 0 0 14px rgba(255, 255, 255, 0.6);\r\n  transform: scale(1.12);\r\n}\r\n\r\n.fr-check-sm {\r\n  width: 14px;\r\n  height: 14px;\r\n  fill: #ffffff;\r\n  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9));\r\n  opacity: 0;\r\n  transition: opacity 0.15s ease;\r\n}\r\n\r\n.fr-color-preset-item.fr-selected .fr-check-sm {\r\n  opacity: 1;\r\n}\r\n\r\n/* ---------------- Rainbow Hue Slider ---------------- */\r\n.fr-hue-slider-wrap {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 8px;\r\n  padding: 4px 0 2px 0;\r\n}\r\n\r\n.fr-hue-slider {\r\n  -webkit-appearance: none;\r\n  appearance: none;\r\n  width: 100%;\r\n  height: 12px;\r\n  border-radius: 999px;\r\n  background: linear-gradient(\r\n    to right,\r\n    #ff0000 0%,\r\n    #ffff00 17%,\r\n    #00ff00 33%,\r\n    #00ffff 50%,\r\n    #0000ff 67%,\r\n    #ff00ff 83%,\r\n    #ff0000 100%\r\n  );\r\n  outline: none;\r\n  cursor: pointer;\r\n  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);\r\n  border: 1px solid rgba(255, 255, 255, 0.15);\r\n}\r\n\r\n.fr-hue-slider::-webkit-slider-thumb {\r\n  -webkit-appearance: none;\r\n  appearance: none;\r\n  width: 18px;\r\n  height: 18px;\r\n  border-radius: 50%;\r\n  background: #ffffff;\r\n  border: 2px solid rgba(0, 0, 0, 0.4);\r\n  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);\r\n  cursor: pointer;\r\n  transition: transform 0.15s ease;\r\n}\r\n\r\n.fr-hue-slider::-webkit-slider-thumb:hover {\r\n  transform: scale(1.2);\r\n}\r\n\r\n.fr-color-custom-row {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 10px;\r\n  padding-top: 8px;\r\n  border-top: 1px solid rgba(255, 255, 255, 0.08);\r\n}\r\n\r\n.fr-color-wheel-btn {\r\n  background: transparent;\r\n  border: none;\r\n  padding: 0;\r\n  cursor: pointer;\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  outline: none;\r\n  border-radius: 50%;\r\n  transition: transform 0.2s ease;\r\n}\r\n\r\n.fr-color-wheel-btn:hover {\r\n  transform: scale(1.15);\r\n}\r\n\r\n.fr-color-wheel-btn:active {\r\n  transform: scale(0.95);\r\n}\r\n\r\n.fr-color-preview-circle {\r\n  width: 28px;\r\n  height: 28px;\r\n  border-radius: 50%;\r\n  border: 2px solid rgba(255, 255, 255, 0.4);\r\n  flex-shrink: 0;\r\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);\r\n}\r\n\r\n.fr-color-text-input {\r\n  flex: 1;\r\n  background: rgba(255, 255, 255, 0.08);\r\n  border: 1px solid rgba(255, 255, 255, 0.15);\r\n  border-radius: 10px;\r\n  padding: 6px 12px;\r\n  color: #ffffff;\r\n  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;\r\n  font-size: 13px;\r\n  font-weight: 600;\r\n  letter-spacing: 0.05em;\r\n  outline: none;\r\n  transition: border-color 0.2s ease, background 0.2s ease;\r\n}\r\n\r\n.fr-color-text-input:focus {\r\n  border-color: var(--fr-word-accent, #1ed760);\r\n  background: rgba(255, 255, 255, 0.14);\r\n}\r\n\r\n.fr-color-input {\r\n  -webkit-appearance: none;\r\n  appearance: none;\r\n  border: 2px solid rgba(255, 255, 255, 0.22);\r\n  width: 32px;\r\n  height: 32px;\r\n  border-radius: 50%;\r\n  cursor: pointer;\r\n  background: transparent;\r\n  padding: 0;\r\n  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);\r\n  transition: transform 0.2s ease, border-color 0.2s ease;\r\n  outline: none;\r\n}\r\n\r\n.fr-color-input:hover {\r\n  transform: scale(1.12);\r\n  border-color: rgba(255, 255, 255, 0.6);\r\n}\r\n\r\n.fr-color-input::-webkit-color-swatch-wrapper {\r\n  padding: 0;\r\n}\r\n\r\n.fr-color-input::-webkit-color-swatch {\r\n  border: none;\r\n  border-radius: 50%;\r\n}\r\n\r\n/* ---------------- Toggles ---------------- */\r\n.fr-toggle {\r\n  width: 48px;\r\n  height: 26px;\r\n  border-radius: 999px;\r\n  background: rgba(0, 0, 0, 0.3);\r\n  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 1px rgba(255, 255, 255, 0.05);\r\n  position: relative;\r\n  cursor: pointer;\r\n  border: none;\r\n  outline: none;\r\n  transition: background 0.3s ease;\r\n  flex-shrink: 0;\r\n}\r\n\r\n.fr-toggle::after {\r\n  content: \"\";\r\n  position: absolute;\r\n  top: 3px;\r\n  left: 3px;\r\n  width: 20px;\r\n  height: 20px;\r\n  border-radius: 50%;\r\n  background: #ffffff;\r\n  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);\r\n  transition: left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n}\r\n\r\n.fr-toggle.fr-on {\r\n  background: var(--fr-word-accent, #1ed760);\r\n  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 1px rgba(255, 255, 255, 0.05);\r\n}\r\n\r\n.fr-toggle.fr-on::after {\r\n  left: 25px;\r\n}\r\n\n/* --- ambient.css --- */\n/* ---------------- Mood-Adaptive & Beat-Reactive Atmosphere ---------------- */\r\n.fr-ambient {\r\n  --fr-beat: 0;\r\n  --fr-bar: 0;\r\n  --fr-energy: 0.5;\r\n  --fr-amb-dominant: #4a3f78;\r\n  --fr-amb-accent: #7b52ab;\r\n  --fr-amb-dark: #14121d;\r\n  --fr-amb-accent-soft: rgba(123, 82, 171, 0.55);\r\n  --fr-amb-dominant-soft: rgba(74, 63, 120, 0.5);\r\n  position: absolute;\r\n  inset: 0;\r\n  pointer-events: none;\r\n  z-index: 1;\r\n  overflow: hidden;\r\n  opacity: 0;\r\n  transition: opacity 1.2s ease;\r\n}\r\n\r\n.fr-ambient.fr-show {\r\n  opacity: 1;\r\n}\r\n\r\n.fr-ambient[data-mood=\"off\"] {\r\n  opacity: 0 !important;\r\n}\r\n\r\n/* ---------------- 1. Aurora Ribbons (Energetic & Dreamy) ---------------- */\r\n.fr-mood-aurora {\r\n  position: absolute;\r\n  inset: -15%;\r\n  pointer-events: none;\r\n  mix-blend-mode: screen;\r\n  opacity: calc(0.28 + var(--fr-energy, 0.5) * 0.35 + var(--fr-beat, 0) * 0.25);\r\n  transform: scale(calc(1 + var(--fr-beat, 0) * 0.045));\r\n  transition: opacity 450ms ease;\r\n  will-change: transform, opacity;\r\n}\r\n\r\n.fr-aurora-wave {\r\n  position: absolute;\r\n  inset: 0;\r\n  border-radius: 50%;\r\n  filter: blur(85px);\r\n}\r\n\r\n.fr-aurora-1 {\r\n  background: radial-gradient(\r\n    ellipse 68% 34% at 32% 28%,\r\n    var(--fr-amb-accent-soft) 0%,\r\n    transparent 72%\r\n  );\r\n  animation: auroraDrift1 16s ease-in-out infinite alternate;\r\n}\r\n\r\n.fr-aurora-2 {\r\n  background: radial-gradient(\r\n    ellipse 64% 38% at 68% 66%,\r\n    var(--fr-amb-dominant-soft) 0%,\r\n    transparent 74%\r\n  );\r\n  animation: auroraDrift2 21s ease-in-out infinite alternate;\r\n}\r\n\r\n@keyframes auroraDrift1 {\r\n  0%   { transform: translate3d(-6%, -4%, 0) rotate(-6deg) scale(1); }\r\n  100% { transform: translate3d(8%, 6%, 0) rotate(8deg) scale(1.14); }\r\n}\r\n\r\n@keyframes auroraDrift2 {\r\n  0%   { transform: translate3d(6%, 5%, 0) rotate(5deg) scale(1.08); }\r\n  100% { transform: translate3d(-8%, -6%, 0) rotate(-9deg) scale(0.96); }\r\n}\r\n\r\n.fr-ambient[data-mood=\"energetic\"] .fr-mood-aurora {\r\n  opacity: calc(0.42 + var(--fr-energy, 0.5) * 0.38 + var(--fr-beat, 0) * 0.35);\r\n}\r\n\r\n.fr-ambient[data-mood=\"melancholic\"] .fr-mood-aurora {\r\n  opacity: calc(0.14 + var(--fr-energy, 0.4) * 0.18);\r\n}\r\n\r\n.fr-ambient[data-mood=\"latenight\"] .fr-mood-aurora {\r\n  opacity: calc(0.2 + var(--fr-energy, 0.4) * 0.22);\r\n}\r\n\r\n/* ---------------- 2. Beat-Reactive Light Orbs ---------------- */\r\n.fr-orbs-wrap {\r\n  position: absolute;\r\n  inset: 0;\r\n  mix-blend-mode: screen;\r\n  opacity: calc(0.38 + var(--fr-energy, 0.5) * 0.28 + var(--fr-beat, 0) * 0.22);\r\n  transform: scale(calc(1 + var(--fr-beat, 0) * 0.035 + var(--fr-bar, 0) * 0.02));\r\n  transform-origin: center center;\r\n  will-change: transform, opacity;\r\n}\r\n\r\n.fr-orb {\r\n  position: absolute;\r\n  border-radius: 50%;\r\n  filter: blur(88px);\r\n  opacity: 0.62;\r\n  animation: floatOrb 20s infinite alternate ease-in-out;\r\n  transition: background-color 900ms ease;\r\n}\r\n\r\n@keyframes floatOrb {\r\n  0%   { transform: translate3d(0, 0, 0) scale(1); }\r\n  100% { transform: translate3d(85px, -75px, 0) scale(1.18); }\r\n}\r\n\r\n/* ---------------- 3. Mood-Morphing Particle System ---------------- */\r\n.fr-particles-wrap {\r\n  position: absolute;\r\n  inset: 0;\r\n  overflow: hidden;\r\n  pointer-events: none;\r\n}\r\n\r\n.fr-particle {\r\n  position: absolute;\r\n  left: var(--p-x, 50%);\r\n  top: var(--p-y, 50%);\r\n  width: var(--p-size, 4px);\r\n  height: var(--p-size, 4px);\r\n  border-radius: 50%;\r\n  background: #ffffff;\r\n  opacity: 0;\r\n  will-change: transform, opacity;\r\n}\r\n\r\n/* --- Mood A: ENERGETIC ⚡ (Fast Rising Neon Sparks pulsing with the Beat) --- */\r\n.fr-ambient[data-mood=\"energetic\"] .fr-particle {\r\n  top: auto;\r\n  bottom: -5vh;\r\n  width: var(--p-size, 4px);\r\n  height: var(--p-size, 4px);\r\n  background: #ffffff;\r\n  box-shadow: 0 0 calc(8px + var(--fr-beat, 0) * 14px) var(--fr-amb-accent),\r\n              0 0 4px #ffffff;\r\n  animation: frSparkRise calc(var(--p-dur, 10s) * 0.58) linear infinite;\r\n  animation-delay: var(--p-delay, 0s);\r\n}\r\n\r\n@keyframes frSparkRise {\r\n  0% {\r\n    transform: translate3d(0, 5vh, 0) scale(0.5);\r\n    opacity: 0;\r\n  }\r\n  20% {\r\n    opacity: calc(0.38 + var(--fr-beat, 0) * 0.45);\r\n  }\r\n  80% {\r\n    opacity: calc(0.32 + var(--fr-beat, 0) * 0.45);\r\n  }\r\n  100% {\r\n    transform: translate3d(var(--p-drift, 20px), -110vh, 0) scale(1.35);\r\n    opacity: 0;\r\n  }\r\n}\r\n\r\n/* --- Mood B: MELANCHOLIC 🌧️ (Soft Falling Rain / Dew Streaks & Mist) --- */\r\n.fr-ambient[data-mood=\"melancholic\"] .fr-particle {\r\n  top: -8vh;\r\n  width: 1.5px;\r\n  height: calc(var(--p-size, 4px) * 5.2);\r\n  border-radius: 999px;\r\n  background: linear-gradient(\r\n    180deg,\r\n    rgba(255, 255, 255, 0) 0%,\r\n    rgba(255, 255, 255, 0.42) 70%,\r\n    rgba(255, 255, 255, 0.72) 100%\r\n  );\r\n  box-shadow: none;\r\n  animation: frRainFall calc(var(--p-dur, 10s) * 0.48) linear infinite;\r\n  animation-delay: var(--p-delay, 0s);\r\n}\r\n\r\n@keyframes frRainFall {\r\n  0% {\r\n    transform: translate3d(0, -10vh, 0) rotate(8deg);\r\n    opacity: 0;\r\n  }\r\n  15% {\r\n    opacity: 0.34;\r\n  }\r\n  85% {\r\n    opacity: 0.28;\r\n  }\r\n  100% {\r\n    transform: translate3d(-24px, 112vh, 0) rotate(8deg);\r\n    opacity: 0;\r\n  }\r\n}\r\n\r\n/* --- Mood C: LATE NIGHT 🌙 (Warm Hovering Fireflies & Analog Vibe) --- */\r\n.fr-ambient[data-mood=\"latenight\"] .fr-particle {\r\n  width: calc(var(--p-size, 4px) * 1.15);\r\n  height: calc(var(--p-size, 4px) * 1.15);\r\n  background: rgba(255, 232, 185, 0.92);\r\n  box-shadow: 0 0 12px rgba(255, 200, 120, 0.75), 0 0 22px var(--fr-amb-accent);\r\n  animation: frFireflyDrift calc(var(--p-dur, 12s) * 1.1) ease-in-out infinite alternate;\r\n  animation-delay: var(--p-delay, 0s);\r\n}\r\n\r\n@keyframes frFireflyDrift {\r\n  0% {\r\n    transform: translate3d(0, 0, 0) scale(0.65);\r\n    opacity: 0.08;\r\n  }\r\n  50% {\r\n    transform: translate3d(var(--p-drift, 18px), -26px, 0) scale(calc(1.1 + var(--fr-beat, 0) * 0.35));\r\n    opacity: calc(0.45 + var(--fr-beat, 0) * 0.35);\r\n  }\r\n  100% {\r\n    transform: translate3d(calc(var(--p-drift, 18px) * -0.7), 18px, 0) scale(0.8);\r\n    opacity: 0.12;\r\n  }\r\n}\r\n\r\n/* --- Mood D: DREAMY ✨ (Soft Out-of-Focus Bokeh Light Circles) --- */\r\n.fr-ambient[data-mood=\"dreamy\"] .fr-particle {\r\n  top: auto;\r\n  bottom: -10vh;\r\n  width: calc(var(--p-size, 4px) * 3.8);\r\n  height: calc(var(--p-size, 4px) * 3.8);\r\n  background: radial-gradient(\r\n    circle,\r\n    rgba(255, 255, 255, 0.45) 0%,\r\n    var(--fr-amb-accent-soft) 55%,\r\n    transparent 100%\r\n  );\r\n  filter: blur(2.5px);\r\n  animation: frBokehFloat calc(var(--p-dur, 12s) * 1.15) ease-in-out infinite;\r\n  animation-delay: var(--p-delay, 0s);\r\n}\r\n\r\n@keyframes frBokehFloat {\r\n  0% {\r\n    transform: translate3d(0, 8vh, 0) scale(0.7);\r\n    opacity: 0;\r\n  }\r\n  25% {\r\n    opacity: calc(0.24 + var(--fr-beat, 0) * 0.22);\r\n  }\r\n  75% {\r\n    opacity: calc(0.22 + var(--fr-beat, 0) * 0.22);\r\n  }\r\n  100% {\r\n    transform: translate3d(var(--p-drift, 24px), -108vh, 0) scale(1.25);\r\n    opacity: 0;\r\n  }\r\n}\r\n\r\n/* ---------------- 4. Atmospheric Mist & Cinematic Vignette ---------------- */\r\n.fr-mood-mist {\r\n  position: absolute;\r\n  inset: 0;\r\n  pointer-events: none;\r\n  opacity: 0;\r\n  background:\r\n    radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0, 0, 0, 0.52) 100%),\r\n    linear-gradient(180deg, transparent 55%, rgba(12, 14, 22, 0.48) 100%);\r\n  transition: opacity 900ms ease;\r\n}\r\n\r\n.fr-ambient[data-mood=\"melancholic\"] .fr-mood-mist {\r\n  opacity: 0.88;\r\n}\r\n\r\n.fr-ambient[data-mood=\"latenight\"] .fr-mood-mist {\r\n  opacity: 0.72;\r\n}\r\n\r\n/* ---------------- 5. Late-Night Analog Film Grain ---------------- */\r\n.fr-mood-grain {\r\n  position: absolute;\r\n  inset: 0;\r\n  pointer-events: none;\r\n  opacity: 0;\r\n  background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 0);\r\n  background-size: 3px 3px;\r\n  mix-blend-mode: overlay;\r\n  transition: opacity 900ms ease;\r\n}\r\n\r\n.fr-ambient[data-mood=\"latenight\"] .fr-mood-grain {\r\n  opacity: 0.45;\r\n}\r\n\n/* --- upnext.css --- */\n/* ---------------- Up Next Card ---------------- */\r\n.fr-up-next {\r\n  position: absolute;\r\n  bottom: clamp(24px, 3.2vw, 64px);\r\n  right: clamp(24px, 3.2vw, 64px);\r\n  background: rgba(30, 30, 35, 0.35);\r\n  backdrop-filter: blur(60px) saturate(2.5);\r\n  border: none;\r\n  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.2), inset 0 -1px 1px rgba(0, 0, 0, 0.1);\r\n  border-radius: 999px;\r\n  padding: 12px 24px 12px 12px;\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 16px;\r\n  z-index: 10;\r\n  transform: translateX(120%);\r\n  opacity: 0;\r\n  transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.6s ease;\r\n  pointer-events: auto;\r\n  cursor: pointer;\r\n}\r\n\r\n.fr-up-next.fr-show {\r\n  transform: translateX(0);\r\n  opacity: 1;\r\n}\r\n\r\n.fr-up-next-img {\r\n  width: 48px;\r\n  height: 48px;\r\n  border-radius: 50%;\r\n  object-fit: cover;\r\n  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);\r\n}\r\n\r\n.fr-up-next-info {\r\n  display: flex;\r\n  flex-direction: column;\r\n  max-width: 200px;\r\n}\r\n\r\n.fr-up-next-label {\r\n  font-size: 10px;\r\n  font-weight: 700;\r\n  color: var(--fr-fg-dim);\r\n  text-transform: uppercase;\r\n  letter-spacing: 0.05em;\r\n  margin-bottom: 2px;\r\n}\r\n\r\n.fr-up-next-title {\r\n  font-size: 14px;\r\n  font-weight: 700;\r\n  color: var(--fr-fg);\r\n  margin: 0 0 2px 0;\r\n  white-space: nowrap;\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n}\r\n\r\n.fr-up-next-artist {\r\n  font-size: 12px;\r\n  color: var(--fr-fg-faint);\r\n  margin: 0;\r\n  white-space: nowrap;\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n}\r\n\r\n#fullscreen-reloaded-root.fr-idle .fr-up-next {\r\n  opacity: 0;\r\n  pointer-events: none;\r\n}\r\n\n/* --- idle.css --- */\n/* ---------------- Idle Mode & Clock ---------------- */\r\n#fullscreen-reloaded-root.fr-idle,\r\n#fullscreen-reloaded-root.fr-idle * {\r\n  cursor: none !important;\r\n}\r\n\r\n#fullscreen-reloaded-root.fr-idle .fr-controls,\r\n#fullscreen-reloaded-root.fr-idle .fr-topbar,\r\n#fullscreen-reloaded-root.fr-idle .fr-side-controls,\r\n#fullscreen-reloaded-root.fr-idle .fr-settings-panel,\r\n#fullscreen-reloaded-root.fr-idle .fr-resume-sync {\r\n  opacity: 0;\r\n  pointer-events: none;\r\n  transform: translateY(12px);\r\n}\r\n\r\n.fr-controls,\r\n.fr-topbar,\r\n.fr-side-controls,\r\n.fr-settings-panel,\r\n.fr-resume-sync {\r\n  transition: opacity 400ms ease, transform 400ms ease;\r\n}\r\n\r\n/* ---------------- Clock & Idle Cinema Mode ---------------- */\r\n.fr-clock {\r\n  position: absolute;\r\n  left: 50%;\r\n  font-size: clamp(50px, 6vw, 80px);\r\n  font-weight: 700;\r\n  color: rgba(255, 255, 255, 0.9);\r\n  opacity: 0;\r\n  pointer-events: none;\r\n  z-index: 10;\r\n  letter-spacing: 0.02em;\r\n  text-shadow: 0 4px 32px rgba(0, 0, 0, 0.7);\r\n  font-variant-numeric: tabular-nums;\r\n  line-height: 1;\r\n}\r\n\r\n.fr-clock.fr-pos-top {\r\n  top: clamp(24px, 4.5vh, 48px);\r\n  bottom: auto;\r\n  transform: translateX(-50%) translateY(-20px);\r\n  transition: opacity 0.8s ease, transform 0.8s ease, top 0.4s;\r\n}\r\n\r\n.fr-clock.fr-pos-bottom {\r\n  bottom: clamp(28px, 5vh, 56px);\r\n  top: auto;\r\n  transform: translateX(-50%) translateY(20px);\r\n  transition: opacity 0.8s ease, transform 0.8s ease, bottom 0.4s;\r\n}\r\n\r\n#fullscreen-reloaded-root.fr-idle .fr-clock.fr-pos-top,\r\n#fullscreen-reloaded-root.fr-idle .fr-clock.fr-pos-bottom {\r\n  opacity: 1;\r\n  transform: translateX(-50%) translateY(0);\r\n}\r\n\r\n#fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics=\"true\"]) .fr-stage {\r\n  grid-template-columns: 1fr 0px;\r\n  gap: 0;\r\n}\r\n\r\n#fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics=\"true\"]) .fr-lyrics-panel {\r\n  opacity: 0;\r\n  pointer-events: none;\r\n  transition: opacity 0.8s ease;\r\n}\r\n\r\n/* Gracefully scale artwork in idle mode to prevent clock collision */\r\n#fullscreen-reloaded-root.fr-idle .fr-art-wrap {\r\n  width: min(48vh, 38vw, 520px);\r\n  transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n}\r\n\r\n/* Shift artwork cleanly away from clock */\r\n#fullscreen-reloaded-root.fr-idle[data-clock=\"top\"] .fr-art-panel {\r\n  transform: translateY(clamp(45px, 7vh, 80px));\r\n  transition: transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n}\r\n\r\n#fullscreen-reloaded-root.fr-idle[data-clock=\"bottom\"] .fr-art-panel {\r\n  transform: translateY(clamp(-45px, -7vh, -80px));\r\n  transition: transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);\r\n}\r\n\r\n#fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics=\"true\"]) .fr-meta {\r\n  text-align: center;\r\n  margin-left: auto;\r\n  margin-right: auto;\r\n  margin-top: clamp(20px, 2.8vh, 36px);\r\n}\r\n\r\n#fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics=\"true\"]) .fr-title {\r\n  font-size: clamp(28px, 3.2vw, 44px);\r\n}\r\n\r\n#fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics=\"true\"]) .fr-artist {\r\n  font-size: clamp(16px, 1.6vw, 22px);\r\n}\r\n\r\n/* ---------------- Responsive Styles ---------------- */\r\n@media (max-aspect-ratio: 5/4), (max-width: 900px) {\r\n  .fr-stage {\r\n    grid-template-columns: 1fr;\r\n    grid-template-rows: auto 1fr;\r\n    grid-template-areas: \"art\" \"lyrics\";\r\n    gap: clamp(10px, 1.5vh, 20px);\r\n    padding-top: clamp(88px, 9.5vh, 145px);\r\n    padding-bottom: clamp(84px, 10vh, 125px);\r\n    transition: padding-top 0.6s cubic-bezier(0.2, 0.8, 0.2, 1),\r\n      padding-bottom 0.6s cubic-bezier(0.2, 0.8, 0.2, 1),\r\n      opacity 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms,\r\n      transform 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms;\r\n  }\r\n\r\n  .fr-stage.fr-centered {\r\n    grid-template-rows: 1fr;\r\n    padding-top: clamp(40px, 5vh, 80px);\r\n  }\r\n\r\n  .fr-clock.fr-pos-top {\r\n    top: clamp(22px, 2.8vh, 42px);\r\n    font-size: clamp(38px, 6.2vw, 58px);\r\n  }\r\n\r\n  .fr-clock.fr-pos-bottom {\r\n    bottom: clamp(22px, 3vh, 42px);\r\n    font-size: clamp(38px, 6.2vw, 58px);\r\n  }\r\n\r\n  .fr-lyrics-panel {\r\n    display: flex;\r\n    min-height: 0;\r\n  }\r\n\r\n  .fr-lyrics-scroll {\r\n    padding: 1vh 8px 18vh 8px;\r\n    mask-image: linear-gradient(\r\n      180deg,\r\n      transparent 0%,\r\n      rgba(0, 0, 0, 0.65) 4%,\r\n      #000 10%,\r\n      #000 82%,\r\n      rgba(0, 0, 0, 0.45) 93%,\r\n      transparent 100%\r\n    );\r\n    -webkit-mask-image: linear-gradient(\r\n      180deg,\r\n      transparent 0%,\r\n      rgba(0, 0, 0, 0.65) 4%,\r\n      #000 10%,\r\n      #000 82%,\r\n      rgba(0, 0, 0, 0.45) 93%,\r\n      transparent 100%\r\n    );\r\n  }\r\n\r\n  /* Balanced artwork in portrait mode when lyrics are visible */\r\n  .fr-stage .fr-art-wrap,\r\n  #fullscreen-reloaded-root.fr-idle .fr-stage .fr-art-wrap {\r\n    width: min(26vh, 54vw, 340px);\r\n    margin: 0 auto;\r\n  }\r\n\r\n  .fr-stage.fr-size-medium .fr-art-wrap,\r\n  #fullscreen-reloaded-root.fr-idle .fr-stage.fr-size-medium .fr-art-wrap {\r\n    width: min(22vh, 46vw, 290px);\r\n  }\r\n\r\n  .fr-stage.fr-size-small .fr-art-wrap,\r\n  #fullscreen-reloaded-root.fr-idle .fr-stage.fr-size-small .fr-art-wrap {\r\n    width: min(18vh, 38vw, 240px);\r\n  }\r\n\r\n  /* Larger artwork when lyrics are hidden in portrait mode */\r\n  .fr-stage.fr-centered .fr-art-wrap,\r\n  #fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics=\"true\"]) .fr-stage .fr-art-wrap {\r\n    width: min(38vh, 68vw, 420px);\r\n  }\r\n\r\n  .fr-meta {\r\n    text-align: center;\r\n    margin-top: clamp(12px, 1.5vh, 20px);\r\n    margin-left: auto;\r\n    margin-right: auto;\r\n    max-width: 86vw;\r\n  }\r\n\r\n  .fr-title {\r\n    font-size: clamp(20px, 4.2vw, 28px);\r\n    margin-bottom: 3px;\r\n  }\r\n\r\n  .fr-artist {\r\n    font-size: clamp(13px, 2.8vw, 16px);\r\n  }\r\n\r\n  .fr-album {\r\n    font-size: clamp(11px, 2.2vw, 13px);\r\n  }\r\n\r\n  /* Make bottom dock more compact */\r\n  .fr-bottom-bar {\r\n    gap: 12px;\r\n    padding: 12px 16px;\r\n    width: 94vw;\r\n  }\r\n\r\n  .fr-volume-row {\r\n    width: 90px;\r\n  }\r\n\r\n  /* Override idle grid & clock clearance for portrait without overlapping lyrics */\r\n  #fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics=\"true\"]) .fr-stage {\r\n    grid-template-columns: 1fr;\r\n    grid-template-rows: 1fr;\r\n  }\r\n\r\n  #fullscreen-reloaded-root.fr-idle[data-clock=\"top\"] .fr-art-panel,\r\n  #fullscreen-reloaded-root.fr-idle[data-clock=\"bottom\"] .fr-art-panel {\r\n    transform: none;\r\n  }\r\n\r\n  #fullscreen-reloaded-root.fr-idle[data-clock=\"top\"] .fr-stage {\r\n    padding-top: clamp(110px, 11.5vh, 175px);\r\n  }\r\n\r\n  #fullscreen-reloaded-root.fr-idle[data-clock=\"bottom\"] .fr-stage {\r\n    padding-bottom: clamp(96px, 11.5vh, 145px);\r\n  }\r\n}\r\n\r\n@media (max-width: 600px) {\r\n  .fr-controls-center {\r\n    display: none; /* Hide progress bar on small screens */\r\n  }\r\n}\r\n\r\n@media (max-height: 500px) {\r\n  .fr-stage {\r\n    grid-template-columns: 1fr;\r\n    grid-template-rows: 1fr;\r\n    grid-template-areas: \"art\";\r\n  }\r\n\r\n  .fr-lyrics-panel {\r\n    display: none !important;\r\n  }\r\n\r\n  .fr-art-wrap {\r\n    width: min(46vh, 60vw, 420px);\r\n  }\r\n}\r\n\n/* --- creator.css --- */\n/* ==========================================================================\n   FullLyrics Creator Studio (Liquid Glass Modal & Word/Line Synchronizer)\n   ========================================================================== */\n\n.fr-creator-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 10020;\n  background: rgba(6, 8, 14, 0.72);\n  backdrop-filter: blur(22px) saturate(150%);\n  -webkit-backdrop-filter: blur(22px) saturate(150%);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: clamp(12px, 2.5vw, 32px);\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.25s cubic-bezier(0.22, 1, 0.36, 1);\n}\n\n.fr-creator-backdrop.fr-show {\n  opacity: 1;\n  pointer-events: auto;\n}\n\n.fr-creator-modal {\n  position: relative;\n  width: min(1140px, 96vw);\n  height: min(840px, 90vh);\n  background: linear-gradient(\n    155deg,\n    rgba(28, 32, 44, 0.92) 0%,\n    rgba(16, 18, 26, 0.95) 100%\n  );\n  border: 1px solid rgba(255, 255, 255, 0.14);\n  border-radius: 24px;\n  box-shadow:\n    0 32px 80px rgba(0, 0, 0, 0.65),\n    inset 0 1px 0 rgba(255, 255, 255, 0.18);\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  color: #f5f7fa;\n  font-family: inherit;\n}\n\n/* Toast Notification */\n.fr-creator-toast {\n  position: absolute;\n  bottom: 74px;\n  left: 50%;\n  transform: translate(-50%, 14px);\n  background: rgba(20, 24, 34, 0.95);\n  border: 1px solid rgba(255, 255, 255, 0.22);\n  color: #fff;\n  padding: 9px 18px;\n  border-radius: 999px;\n  font-size: 13px;\n  font-weight: 600;\n  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);\n  opacity: 0;\n  pointer-events: none;\n  z-index: 50;\n  transition: all 0.22s ease;\n}\n\n.fr-creator-toast.fr-show {\n  opacity: 1;\n  transform: translate(-50%, 0);\n}\n\n/* Header */\n.fr-creator-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 14px;\n  padding: 16px 22px;\n  border-bottom: 1px solid rgba(255, 255, 255, 0.09);\n  background: rgba(255, 255, 255, 0.02);\n  flex-wrap: wrap;\n}\n\n.fr-creator-title-wrap {\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  min-width: 180px;\n}\n\n.fr-creator-title-row {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.fr-creator-title {\n  margin: 0;\n  font-size: 18px;\n  font-weight: 700;\n  letter-spacing: -0.02em;\n  color: #fff;\n}\n\n.fr-creator-saved-pill {\n  font-size: 11px;\n  font-weight: 600;\n  padding: 2px 9px;\n  border-radius: 999px;\n  background: rgba(52, 211, 153, 0.18);\n  border: 1px solid rgba(52, 211, 153, 0.45);\n  color: #6ee7b7;\n}\n\n.fr-creator-sub {\n  font-size: 12.5px;\n  color: rgba(255, 255, 255, 0.62);\n  max-width: 340px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* Mode Switcher */\n.fr-creator-mode-switch {\n  display: inline-flex;\n  background: rgba(0, 0, 0, 0.35);\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  border-radius: 12px;\n  padding: 3px;\n  gap: 3px;\n}\n\n.fr-creator-mode-btn {\n  background: transparent;\n  border: none;\n  color: rgba(255, 255, 255, 0.68);\n  font-size: 12.5px;\n  font-weight: 600;\n  padding: 6px 13px;\n  border-radius: 9px;\n  cursor: pointer;\n  transition: all 0.18s ease;\n}\n\n.fr-creator-mode-btn:hover {\n  color: #fff;\n}\n\n.fr-creator-mode-btn.fr-active {\n  background: rgba(255, 255, 255, 0.16);\n  color: #fff;\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);\n}\n\n/* Header Actions */\n.fr-creator-header-actions {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.fr-creator-btn {\n  display: inline-flex;\n  align-items: center;\n  gap: 7px;\n  height: 36px;\n  padding: 0 14px;\n  border-radius: 10px;\n  font-size: 12.5px;\n  font-weight: 600;\n  cursor: pointer;\n  border: 1px solid rgba(255, 255, 255, 0.12);\n  transition: all 0.18s ease;\n}\n\n.fr-creator-btn svg {\n  width: 15px;\n  height: 15px;\n}\n\n.fr-creator-btn-ghost {\n  background: rgba(255, 255, 255, 0.06);\n  color: rgba(255, 255, 255, 0.88);\n}\n\n.fr-creator-btn-ghost:hover,\n.fr-creator-btn-ghost.fr-active {\n  background: rgba(255, 255, 255, 0.14);\n  color: #fff;\n}\n\n.fr-creator-btn-primary {\n  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);\n  border-color: rgba(255, 255, 255, 0.25);\n  color: #fff;\n  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);\n}\n\n.fr-creator-btn-primary:hover {\n  filter: brightness(1.1);\n  transform: translateY(-1px);\n}\n\n.fr-creator-icon-btn {\n  width: 36px;\n  height: 36px;\n  border-radius: 10px;\n  border: 1px solid rgba(255, 255, 255, 0.12);\n  background: rgba(255, 255, 255, 0.06);\n  color: rgba(255, 255, 255, 0.85);\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  transition: all 0.18s ease;\n}\n\n.fr-creator-icon-btn svg {\n  width: 17px;\n  height: 17px;\n}\n\n.fr-creator-icon-btn:hover,\n.fr-creator-icon-btn.fr-active {\n  background: rgba(255, 255, 255, 0.16);\n  color: #fff;\n}\n\n/* More Dropdown */\n.fr-creator-more-wrap {\n  position: relative;\n}\n\n.fr-creator-dropdown {\n  position: absolute;\n  top: calc(100% + 8px);\n  right: 0;\n  min-width: 255px;\n  background: rgba(20, 23, 33, 0.98);\n  border: 1px solid rgba(255, 255, 255, 0.16);\n  border-radius: 14px;\n  padding: 6px;\n  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.6);\n  z-index: 40;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n}\n\n.fr-creator-dropdown-item {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  width: 100%;\n  padding: 9px 12px;\n  border: none;\n  background: transparent;\n  color: rgba(255, 255, 255, 0.88);\n  font-size: 12.5px;\n  font-weight: 500;\n  border-radius: 9px;\n  cursor: pointer;\n  text-align: left;\n}\n\n.fr-creator-dropdown-item svg {\n  width: 15px;\n  height: 15px;\n  opacity: 0.85;\n}\n\n.fr-creator-dropdown-item:hover {\n  background: rgba(255, 255, 255, 0.1);\n  color: #fff;\n}\n\n.fr-creator-dropdown-item.fr-danger {\n  color: #f87171;\n}\n\n.fr-creator-dropdown-item.fr-danger:hover {\n  background: rgba(248, 113, 113, 0.14);\n}\n\n/* Step Tabs */\n.fr-creator-steps {\n  display: flex;\n  gap: 8px;\n  padding: 10px 22px;\n  border-bottom: 1px solid rgba(255, 255, 255, 0.08);\n  background: rgba(0, 0, 0, 0.2);\n}\n\n.fr-creator-step-btn {\n  background: transparent;\n  border: 1px solid transparent;\n  color: rgba(255, 255, 255, 0.6);\n  padding: 7px 16px;\n  border-radius: 10px;\n  font-size: 13px;\n  font-weight: 600;\n  cursor: pointer;\n  transition: all 0.18s ease;\n}\n\n.fr-creator-step-btn:hover {\n  color: #fff;\n  background: rgba(255, 255, 255, 0.05);\n}\n\n.fr-creator-step-btn.fr-active {\n  color: #fff;\n  background: rgba(255, 255, 255, 0.12);\n  border-color: rgba(255, 255, 255, 0.16);\n}\n\n/* Local DB Library Drawer */\n.fr-creator-library {\n  padding: 12px 22px;\n  background: rgba(10, 12, 18, 0.72);\n  border-bottom: 1px solid rgba(255, 255, 255, 0.1);\n  max-height: 210px;\n  overflow-y: auto;\n}\n\n.fr-creator-library-head {\n  margin-bottom: 8px;\n}\n\n.fr-creator-library-title {\n  font-size: 12px;\n  font-weight: 700;\n  text-transform: uppercase;\n  letter-spacing: 0.05em;\n  color: rgba(255, 255, 255, 0.55);\n}\n\n.fr-creator-library-list {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n\n.fr-creator-library-item {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 8px 12px;\n  background: rgba(255, 255, 255, 0.04);\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  border-radius: 10px;\n}\n\n.fr-creator-library-song {\n  font-size: 13px;\n  font-weight: 600;\n  color: #fff;\n}\n\n.fr-creator-library-artist {\n  font-size: 11.5px;\n  color: rgba(255, 255, 255, 0.58);\n}\n\n.fr-creator-library-actions {\n  display: flex;\n  gap: 6px;\n}\n\n/* Body Container */\n.fr-creator-body {\n  flex: 1;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n}\n\n/* ==========================================================================\n   STEP 1: Text & Visual Builder\n   ========================================================================== */\n\n.fr-creator-text-step {\n  flex: 1;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n  padding: 14px 22px;\n  gap: 12px;\n}\n\n.fr-creator-subtoolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 10px;\n  flex-wrap: wrap;\n}\n\n.fr-creator-subswitch {\n  display: inline-flex;\n  background: rgba(0, 0, 0, 0.3);\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  border-radius: 10px;\n  padding: 3px;\n  gap: 3px;\n}\n\n.fr-creator-subbtn {\n  border: none;\n  background: transparent;\n  color: rgba(255, 255, 255, 0.65);\n  font-size: 12px;\n  font-weight: 600;\n  padding: 5px 12px;\n  border-radius: 7px;\n  cursor: pointer;\n}\n\n.fr-creator-subbtn.fr-active {\n  background: rgba(255, 255, 255, 0.15);\n  color: #fff;\n}\n\n.fr-creator-quick-actions {\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  flex-wrap: wrap;\n}\n\n.fr-creator-chip-btn {\n  background: rgba(255, 255, 255, 0.08);\n  border: 1px solid rgba(255, 255, 255, 0.14);\n  color: #fff;\n  font-size: 12px;\n  font-weight: 600;\n  padding: 6px 12px;\n  border-radius: 999px;\n  cursor: pointer;\n  transition: all 0.16s ease;\n}\n\n.fr-creator-chip-btn:hover {\n  background: rgba(255, 255, 255, 0.18);\n}\n\n.fr-creator-textarea {\n  flex: 1;\n  min-height: 0;\n  width: 100%;\n  resize: none;\n  background: rgba(0, 0, 0, 0.28);\n  border: 1px solid rgba(255, 255, 255, 0.12);\n  border-radius: 14px;\n  padding: 14px 16px;\n  color: #fff;\n  font-size: 14px;\n  line-height: 1.65;\n  font-family: inherit;\n  outline: none;\n}\n\n.fr-creator-textarea:focus {\n  border-color: rgba(99, 102, 241, 0.65);\n}\n\n/* Visual Builder Cards */\n.fr-creator-builder-list {\n  flex: 1;\n  min-height: 0;\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  padding-right: 4px;\n}\n\n.fr-creator-line-card {\n  background: rgba(255, 255, 255, 0.04);\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  border-radius: 14px;\n  padding: 10px 14px;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.fr-creator-line-card.fr-is-duet {\n  border-color: rgba(168, 85, 247, 0.45);\n  background: rgba(168, 85, 247, 0.06);\n}\n\n.fr-creator-line-card.fr-is-interlude {\n  border-style: dashed;\n  border-color: rgba(255, 255, 255, 0.22);\n  background: rgba(255, 255, 255, 0.02);\n}\n\n.fr-creator-line-card-top {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  flex-wrap: wrap;\n}\n\n.fr-creator-line-num {\n  font-size: 11.5px;\n  font-weight: 700;\n  color: rgba(255, 255, 255, 0.48);\n  min-width: 28px;\n}\n\n.fr-creator-interlude-title {\n  flex: 1;\n  font-size: 13px;\n  font-weight: 600;\n  color: rgba(255, 255, 255, 0.75);\n}\n\n.fr-creator-line-input {\n  flex: 1;\n  min-width: 200px;\n  background: rgba(0, 0, 0, 0.3);\n  border: 1px solid rgba(255, 255, 255, 0.12);\n  border-radius: 9px;\n  padding: 7px 11px;\n  color: #fff;\n  font-size: 13.5px;\n  font-weight: 500;\n  outline: none;\n}\n\n.fr-creator-line-input:focus {\n  border-color: rgba(99, 102, 241, 0.65);\n}\n\n.fr-creator-line-card-controls {\n  display: flex;\n  align-items: center;\n  gap: 5px;\n  flex-wrap: wrap;\n}\n\n/* Word Pills inside Visual Builder */\n.fr-creator-word-pills {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  padding-left: 36px;\n}\n\n.fr-creator-word-pill {\n  display: inline-flex;\n  align-items: center;\n  background: rgba(255, 255, 255, 0.07);\n  border: 1px solid rgba(255, 255, 255, 0.13);\n  border-radius: 8px;\n  padding: 2px 6px;\n  gap: 4px;\n}\n\n.fr-creator-word-pill-input {\n  background: transparent;\n  border: none;\n  color: #fff;\n  font-size: 12.5px;\n  font-weight: 500;\n  outline: none;\n  min-width: 22px;\n}\n\n.fr-creator-word-pill-del {\n  background: transparent;\n  border: none;\n  color: rgba(255, 255, 255, 0.45);\n  cursor: pointer;\n  font-size: 13px;\n  padding: 0 2px;\n}\n\n.fr-creator-word-pill-del:hover {\n  color: #f87171;\n}\n\n/* Background Vocal Row inside Visual Builder */\n.fr-creator-bg-list {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding-left: 36px;\n}\n\n.fr-creator-bg-edit-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.fr-creator-bg-badge {\n  font-size: 11px;\n  font-weight: 600;\n  color: #93c5fd;\n  background: rgba(59, 130, 246, 0.16);\n  padding: 3px 8px;\n  border-radius: 6px;\n}\n\n.fr-creator-bg-input {\n  flex: 1;\n  background: rgba(0, 0, 0, 0.28);\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  border-radius: 8px;\n  padding: 5px 10px;\n  color: rgba(255, 255, 255, 0.9);\n  font-size: 12.5px;\n  outline: none;\n}\n\n.fr-creator-credit-row {\n  display: flex;\n}\n\n.fr-creator-credit-input {\n  width: 100%;\n  background: rgba(0, 0, 0, 0.25);\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  border-radius: 10px;\n  padding: 8px 12px;\n  color: #fff;\n  font-size: 12.5px;\n  outline: none;\n}\n\n/* ==========================================================================\n   STEP 2: Sync Studio\n   ========================================================================== */\n\n.fr-creator-sync-step {\n  flex: 1;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n  padding: 12px 22px;\n  gap: 10px;\n}\n\n.fr-creator-sync-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 10px;\n  flex-wrap: wrap;\n}\n\n.fr-creator-cue-btn {\n  background: linear-gradient(135deg, #10b981 0%, #059669 100%);\n  border: 1px solid rgba(255, 255, 255, 0.28);\n  color: #fff;\n  font-size: 13px;\n  font-weight: 700;\n  padding: 9px 18px;\n  border-radius: 11px;\n  cursor: pointer;\n  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);\n  transition: all 0.15s ease;\n}\n\n.fr-creator-cue-btn:hover {\n  filter: brightness(1.08);\n}\n\n.fr-creator-cue-btn:active {\n  transform: scale(0.97);\n}\n\n.fr-creator-shift-group {\n  display: flex;\n  align-items: center;\n  gap: 5px;\n  background: rgba(255, 255, 255, 0.04);\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  padding: 4px 8px;\n  border-radius: 10px;\n}\n\n.fr-creator-shift-label {\n  font-size: 11.5px;\n  color: rgba(255, 255, 255, 0.6);\n  margin-right: 4px;\n}\n\n.fr-creator-sync-right {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n\n.fr-creator-sync-progress {\n  font-size: 12px;\n  font-weight: 700;\n  color: rgba(255, 255, 255, 0.78);\n  background: rgba(255, 255, 255, 0.08);\n  padding: 5px 11px;\n  border-radius: 999px;\n}\n\n.fr-creator-shortcuts-bar {\n  display: flex;\n  align-items: center;\n  gap: 14px;\n  flex-wrap: wrap;\n  font-size: 11.5px;\n  color: rgba(255, 255, 255, 0.56);\n  padding: 4px 2px;\n}\n\n.fr-creator-shortcuts-bar kbd {\n  background: rgba(255, 255, 255, 0.12);\n  border: 1px solid rgba(255, 255, 255, 0.2);\n  border-radius: 5px;\n  padding: 1px 6px;\n  font-size: 11px;\n  color: #fff;\n  font-family: inherit;\n}\n\n.fr-creator-sync-list {\n  flex: 1;\n  min-height: 0;\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding-right: 4px;\n}\n\n.fr-creator-sync-row {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 10px 14px;\n  background: rgba(255, 255, 255, 0.04);\n  border: 1px solid rgba(255, 255, 255, 0.09);\n  border-radius: 13px;\n  cursor: pointer;\n  transition: all 0.15s ease;\n}\n\n.fr-creator-sync-row:hover {\n  background: rgba(255, 255, 255, 0.07);\n}\n\n.fr-creator-sync-row.fr-done {\n  border-color: rgba(52, 211, 153, 0.28);\n}\n\n.fr-creator-sync-row.fr-active {\n  background: rgba(59, 130, 246, 0.13);\n  border-color: rgba(96, 165, 250, 0.75);\n  box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.35);\n}\n\n.fr-creator-sync-row.fr-is-duet {\n  border-left: 3px solid #c084fc;\n}\n\n.fr-creator-word-row {\n  flex-direction: column;\n  align-items: stretch;\n  cursor: default;\n}\n\n.fr-creator-word-row-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 10px;\n  flex-wrap: wrap;\n}\n\n.fr-creator-word-row-meta {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  cursor: pointer;\n  border-radius: 8px;\n  padding: 2px 4px;\n  transition: opacity 0.15s ease;\n}\n\n.fr-creator-word-row-meta:hover .fr-creator-time-pill {\n  border-color: rgba(96, 165, 250, 0.6);\n  background: rgba(59, 130, 246, 0.18);\n  color: #fff;\n}\n\n.fr-creator-time-pill {\n  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;\n  font-size: 12px;\n  font-weight: 600;\n  color: #93c5fd;\n  background: rgba(0, 0, 0, 0.35);\n  padding: 3px 9px;\n  border-radius: 7px;\n  border: 1px solid rgba(255, 255, 255, 0.09);\n}\n\n.fr-creator-row-text {\n  flex: 1;\n  font-size: 14px;\n  font-weight: 600;\n  color: #fff;\n}\n\n.fr-creator-row-bgsub {\n  font-size: 12px;\n  color: rgba(255, 255, 255, 0.58);\n  margin-top: 2px;\n}\n\n.fr-creator-row-actions {\n  display: flex;\n  align-items: center;\n  gap: 5px;\n  flex-wrap: wrap;\n}\n\n.fr-creator-mini-btn {\n  background: rgba(255, 255, 255, 0.08);\n  border: 1px solid rgba(255, 255, 255, 0.14);\n  color: rgba(255, 255, 255, 0.88);\n  font-size: 11.5px;\n  font-weight: 600;\n  padding: 4px 9px;\n  border-radius: 7px;\n  cursor: pointer;\n  transition: all 0.15s ease;\n}\n\n.fr-creator-mini-btn:hover:not(:disabled) {\n  background: rgba(255, 255, 255, 0.18);\n  color: #fff;\n}\n\n.fr-creator-mini-btn:disabled {\n  opacity: 0.35;\n  cursor: default;\n}\n\n.fr-creator-mini-btn.fr-active-duet {\n  background: rgba(168, 85, 247, 0.28);\n  border-color: rgba(192, 132, 252, 0.65);\n  color: #e9d5ff;\n}\n\n.fr-creator-mini-btn.fr-danger,\n.fr-creator-mini-icon-btn.fr-danger {\n  color: #fca5a5;\n}\n\n.fr-creator-mini-icon-btn {\n  width: 26px;\n  height: 26px;\n  border-radius: 7px;\n  background: rgba(255, 255, 255, 0.08);\n  border: 1px solid rgba(255, 255, 255, 0.14);\n  color: rgba(255, 255, 255, 0.88);\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n}\n\n.fr-creator-mini-icon-btn svg {\n  width: 13px;\n  height: 13px;\n}\n\n.fr-creator-mini-icon-btn:disabled {\n  opacity: 0.35;\n  cursor: default;\n}\n\n/* Word Token Chips */\n.fr-creator-tokens-wrap {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 7px;\n  padding-top: 4px;\n}\n\n.fr-creator-bg-tokens {\n  margin-top: 4px;\n  padding-top: 8px;\n  border-top: 1px dashed rgba(255, 255, 255, 0.1);\n  align-items: center;\n}\n\n.fr-creator-bg-tag {\n  font-size: 11px;\n  font-weight: 700;\n  color: #93c5fd;\n  background: rgba(59, 130, 246, 0.15);\n  padding: 3px 8px;\n  border-radius: 6px;\n}\n\n.fr-creator-token {\n  display: inline-flex;\n  flex-direction: column;\n  align-items: flex-start;\n  gap: 2px;\n  padding: 6px 11px;\n  border-radius: 10px;\n  background: rgba(0, 0, 0, 0.34);\n  border: 1px solid rgba(255, 255, 255, 0.12);\n  color: #fff;\n  cursor: pointer;\n  transition: all 0.14s ease;\n}\n\n.fr-creator-token:hover {\n  background: rgba(255, 255, 255, 0.1);\n}\n\n.fr-creator-token.fr-done {\n  border-color: rgba(52, 211, 153, 0.45);\n  background: rgba(16, 185, 129, 0.12);\n}\n\n.fr-creator-token.fr-active {\n  border-color: #60a5fa;\n  background: rgba(59, 130, 246, 0.28);\n  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.4);\n  transform: translateY(-1px);\n}\n\n.fr-creator-token-word {\n  font-size: 13.5px;\n  font-weight: 700;\n  color: #fff;\n}\n\n.fr-creator-token-time {\n  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;\n  font-size: 10.5px;\n  color: rgba(255, 255, 255, 0.62);\n}\n\n.fr-creator-token-end {\n  flex-direction: row;\n  align-items: center;\n  gap: 5px;\n  padding: 6px 10px;\n  opacity: 0.85;\n}\n\n.fr-creator-token-flag svg {\n  width: 12px;\n  height: 12px;\n}\n\n/* Quick Add Bar at Bottom of Sync Step */\n.fr-creator-sync-quickadd {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding-top: 6px;\n  border-top: 1px solid rgba(255, 255, 255, 0.08);\n}\n\n.fr-creator-sync-quickinput {\n  flex: 1;\n  background: rgba(0, 0, 0, 0.3);\n  border: 1px solid rgba(255, 255, 255, 0.12);\n  border-radius: 9px;\n  padding: 7px 12px;\n  color: #fff;\n  font-size: 12.5px;\n  outline: none;\n}\n\n/* ==========================================================================\n   STEP 3: Live Preview\n   ========================================================================== */\n\n.fr-creator-preview-step {\n  flex: 1;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n  padding: 18px 28px;\n}\n\n.fr-creator-preview-scroll {\n  flex: 1;\n  min-height: 0;\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 18px;\n  padding: 40px 16px;\n}\n\n.fr-creator-preview-line {\n  font-size: 24px;\n  font-weight: 700;\n  line-height: 1.35;\n  color: rgba(255, 255, 255, 0.32);\n  cursor: pointer;\n  transition: all 0.25s ease;\n}\n\n.fr-creator-preview-line.fr-duet-right {\n  text-align: right;\n}\n\n.fr-creator-preview-line.fr-past {\n  color: rgba(255, 255, 255, 0.45);\n}\n\n.fr-creator-preview-line.fr-active {\n  color: rgba(255, 255, 255, 0.65);\n  transform: scale(1.02);\n  transform-origin: left center;\n}\n\n.fr-creator-preview-line.fr-duet-right.fr-active {\n  transform-origin: right center;\n}\n\n.fr-creator-preview-word {\n  transition: color 0.12s ease, text-shadow 0.12s ease;\n}\n\n.fr-creator-preview-word.fr-w-done,\n.fr-creator-preview-word.fr-w-active {\n  color: #fff;\n  text-shadow: 0 0 18px rgba(255, 255, 255, 0.45);\n}\n\n.fr-creator-preview-bg {\n  font-size: 16px;\n  font-weight: 600;\n  color: rgba(255, 255, 255, 0.5);\n  margin-top: 4px;\n}\n\n.fr-creator-empty-box {\n  padding: 36px 24px;\n  text-align: center;\n  color: rgba(255, 255, 255, 0.58);\n  font-size: 13.5px;\n  background: rgba(255, 255, 255, 0.03);\n  border: 1px dashed rgba(255, 255, 255, 0.14);\n  border-radius: 14px;\n  margin: auto 0;\n}\n\n/* ==========================================================================\n   Bottom Transport Bar\n   ========================================================================== */\n\n.fr-creator-transport {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 12px 22px;\n  background: rgba(0, 0, 0, 0.38);\n  border-top: 1px solid rgba(255, 255, 255, 0.1);\n}\n\n.fr-creator-play-btn {\n  width: 36px;\n  height: 36px;\n  border-radius: 50%;\n  background: #fff;\n  color: #090b10;\n  border: none;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n}\n\n.fr-creator-play-btn svg {\n  width: 17px;\n  height: 17px;\n}\n\n.fr-creator-transport-time {\n  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;\n  font-size: 12px;\n  font-weight: 600;\n  color: rgba(255, 255, 255, 0.78);\n  min-width: 48px;\n}\n\n.fr-creator-seek-bar {\n  flex: 1;\n  height: 7px;\n  background: rgba(255, 255, 255, 0.14);\n  border-radius: 999px;\n  cursor: pointer;\n  overflow: hidden;\n  position: relative;\n}\n\n.fr-creator-seek-fill {\n  height: 100%;\n  width: 0%;\n  background: linear-gradient(90deg, #60a5fa, #a78bfa);\n  border-radius: 999px;\n}\n";

function cleanupStyle(removeStyle) {
  try {
    if (typeof removeStyle === "function") {
      removeStyle();
    } else if (removeStyle && typeof removeStyle.remove === "function") {
      removeStyle.remove();
    }
  } catch (_) {}
}

exports.default = async function start(ctx) {
  if (ctx?.signal?.aborted) {
    return () => {};
  }

  // 1. Wait for SpotiKit APIs
  await SpotiKitBridge.waitForReady();
  if (ctx?.signal?.aborted) {
    return () => {};
  }

  // 2. Bind SpotiKit context & load stored user settings
  SpotiKitBridge.init(ctx);
  Settings.load();

  // 3. Register Liquid Glass styles via SpotiKit
  const removeStyle = ctx?.style?.(STYLES);
  if (ctx?.signal?.aborted) {
    cleanupStyle(removeStyle);
    return () => {};
  }

  // 4. Mount application overlay
  App.mount(ctx);

  let stopped = false;
  const teardown = () => {
    if (stopped) return;
    stopped = true;
    cleanupStyle(removeStyle);
    App.unmount();
  };

  ctx?.onStop?.(teardown);
  return teardown;
}

    },

    "./services/AppleMusicAuth.js": function(require, exports, module) {
// --- ./services/AppleMusicAuth.js ---
/**
 * Apple Music authorization & developer token manager.
 */
const {  Settings  } = require("./utils/settings.js");
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");
const {  t  } = require("./utils/i18n.js");

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
      const signal = SpotiKitBridge.createTimeoutSignal(1500);
      const html = await fetch(proxyUrl, { signal }).then((r) => (r.ok ? r.text() : ""));
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

  _getScope() {
    return typeof SpotiKit !== "undefined" ? SpotiKit.Storage?.scope?.("fullscreen-reloaded") || null : null;
  },

  _readCache() {
    try {
      const scope = this._getScope();
      let parsed = null;
      if (scope && typeof scope.get === "function") {
        const raw = scope.get("apple-dev-token", null);
        if (!raw) return null;
        parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      } else if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem("fullscreen-reloaded:apple-dev-token");
        if (!raw) return null;
        parsed = JSON.parse(raw);
      }
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof parsed.token !== "string" ||
        !parsed.token ||
        !Number.isFinite(parsed.expires) ||
        parsed.expires < Date.now()
      ) {
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  },

  _writeCache(token, expires) {
    try {
      const payload = { token, expires };
      const scope = this._getScope();
      if (scope && typeof scope.set === "function") {
        scope.set("apple-dev-token", payload);
        return;
      }
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("fullscreen-reloaded:apple-dev-token", JSON.stringify(payload));
      }
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
      SpotiKitBridge.notify(t("appleConnectError"), { type: "error" });
      return false;
    }
    try {
      const MusicKit = await this.loadMusicKit();
      await MusicKit.configure({
        developerToken: devToken,
        app: { name: "Fullscreen Reloaded", build: "1.4.0" },
      });
      const instance = MusicKit.getInstance();
      const userToken = await instance.authorize();
      Settings.set("appleMusicUserToken", userToken);
      SpotiKitBridge.notify(t("appleConnected"), { type: "default" });
      return true;
    } catch (e) {
      SpotiKitBridge.notify(t("appleConnectFailed"), { type: "error" });
      return false;
    }
  },
};

    },

    "./services/AudioMoodEngine.js": function(require, exports, module) {
// --- ./services/AudioMoodEngine.js ---
/**
 * Real-time Audio Analysis & Mood Atmosphere Engine.
 * - Uses SpotiKitBridge.getAudioData() `segments` (loudness_start, loudness_max, loudness_max_time, timbre)
 *   with true logarithmic decibel-to-amplitude conversion (10^(dB/20)) and transient onset detection.
 * - Never fires fake metronome pulses during quiet sections or when audio analysis is unavailable.
 * - Automatically classifies each track into one of 4 atmospheric moods:
 *   "energetic" | "melancholic" | "latenight" | "dreamy"
 */
const {  Settings  } = require("./utils/settings.js");
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");

const MELANCHOLIC_KEYWORDS = [
  "ağla", "agla", "veda", "yalnız", "yalniz", "hüzün", "huzun", "gözyaş", "gozyas",
  "ayrılık", "ayrilik", "gitme", "kırık", "kirik", "keder", "dert", "özlem", "ozlem",
  "bitti", "yara", "acı", "aci", "ölüm", "olum", "sensiz", "unut", "kaybet", "vazgeç",
  "sad", "cry", "tears", "lonely", "broken", "hurt", "pain", "rain", "yağmur", "yagmur",
  "sorry", "goodbye", "empty", "cold", "grief", "heartbreak",
];

const ENERGETIC_KEYWORDS = [
  "remix", "phonk", "drill", "club", "dance", "party", "hype", "trap", "bass",
  "workout", "gym", "hardstyle", "techno", "rave", "jump", "fire", "ateş", "ates",
  "patla", "uç", "hız", "enerji", "vip", "banger", "boost",
];

const LATENIGHT_KEYWORDS = [
  "gece", "karanlık", "karanlik", "sokak", "duman", "alkol", "şarap", "sarap",
  "night", "midnight", "3am", "4am", "lofi", "lo-fi", "slowed", "reverb",
  "dark", "shadow", "moon", "city", "drive", "smoke", "chill", "uyku", "sessiz",
];

const AudioMoodEngine = exports.AudioMoodEngine = {
  _currentUri: null,
  _audioCache: new Map(),

  // Extracted track properties
  bpm: 110,
  baseEnergy: 0.5,
  hasExactAudio: false,
  segments: [],
  beats: [],

  // Color & lyric signals
  _colorWarmth: 0.5,
  _colorLum: 0.4,
  _colorSat: 0.5,
  _wordsPerSec: 1.5,
  _trackText: "",

  // Computed mood & smoothed 60fps outputs
  _autoMood: "dreamy",
  _smoothBeat: 0,
  _smoothBar: 0,
  _smoothEnergy: 0.35,
  _segCursor: 0,
  _beatCursor: 0,

  /**
   * Initializes analysis for a newly loaded track.
   */
  async loadTrack(track, colors = null) {
    if (!track || !track.uri) return;
    const uri = track.uri;
    this._currentUri = uri;

    this._segCursor = 0;
    this._beatCursor = 0;
    this.segments = [];
    this.beats = [];
    this.hasExactAudio = false;
    this.bpm = 110;
    this.baseEnergy = 0.5;
    this._wordsPerSec = 1.5;
    this._smoothBeat = 0;
    this._smoothBar = 0;

    const meta = track.metadata || {};
    const title = meta.title || track.name || "";
    const artist = meta.artist_name || "";
    const album = meta.album_title || track.album?.name || "";
    this._trackText = `${title} ${artist} ${album}`.toLowerCase();

    if (colors) {
      this._analyzeColors(colors);
    }

    this._recomputeAutoMood();

    const audio = await this._fetchAudioData(uri);
    if (this._currentUri !== uri) return;

    if (audio) {
      this._parseAudioData(audio);
      this._recomputeAutoMood();
    }
  },

  updateColors(colors) {
    if (!colors) return;
    this._analyzeColors(colors);
    this._recomputeAutoMood();
  },

  updateLyricsMetrics(lines, syncType, durationMs) {
    if (!Array.isArray(lines) || !lines.length) return;

    let totalWords = 0;
    for (let i = 0; i < lines.length; i++) {
      const wLen = Array.isArray(lines[i].words)
        ? lines[i].words.length
        : String(lines[i].text || "").trim().split(/\s+/).filter(Boolean).length;
      totalWords += wLen;
    }

    const durSec = Math.max(45, (durationMs || 180000) / 1000);
    this._wordsPerSec = totalWords / durSec;
    this._recomputeAutoMood();
  },

  getEffectiveMood() {
    const setting = Settings.get("moodMode") || "auto";
    if (setting === "off") return "off";
    if (setting !== "auto") return setting;
    return this._autoMood || "dreamy";
  },

  /**
   * Called every animation frame (60fps) from App.startTicking().
   * Computes real instantaneous amplitude and bass kick transients from Spotify `segments`.
   * Quiet sections produce 0.0 bass pulse; only genuine high-energy bass/drum transients trigger a pulse.
   */
  sample(progressMs, isPlaying) {
    const mood = this.getEffectiveMood();
    const beatMode = Settings.get("beatReactive") || "normal";

    if (!isPlaying || beatMode === "off" || !this.hasExactAudio || !this.segments.length) {
      this._smoothBeat *= 0.84;
      this._smoothBar *= 0.84;
      this._smoothEnergy += (0.3 - this._smoothEnergy) * 0.05;
      return {
        mood,
        beatPulse: this._smoothBeat < 0.005 ? 0 : this._smoothBeat,
        barPulse: this._smoothBar < 0.005 ? 0 : this._smoothBar,
        sectionEnergy: this._smoothEnergy,
        bpm: this.bpm,
      };
    }

    const intensityMult = beatMode === "intense" ? 1.35 : 1.0;
    const seg = this._findInterval(this.segments, progressMs, "_segCursor");

    let rawKick = 0;
    let targetEnergy = 0.25;

    if (seg) {
      // 1. Interpolate instantaneous decibel envelope inside the current segment:
      //    loudness_start -> loudness_max (at peakOffsetMs) -> loudness_end
      const elapsedMs = Math.max(0, progressMs - seg.startMs);
      let currentDb;
      if (elapsedMs <= seg.peakOffsetMs) {
        const t = seg.peakOffsetMs > 5 ? elapsedMs / seg.peakOffsetMs : 1;
        currentDb = seg.dbStart + (seg.dbMax - seg.dbStart) * t;
      } else {
        const remDur = Math.max(20, seg.durMs - seg.peakOffsetMs);
        const t = Math.min(1, (elapsedMs - seg.peakOffsetMs) / remDur);
        currentDb = seg.dbMax + (seg.dbEnd - seg.dbMax) * t;
      }

      // Convert relative decibels (dB below track's loudest peak) to physical linear amplitude: 10^(relDb / 20)
      // e.g. 0dB below peak -> 1.0, -6dB -> 0.50, -12dB -> 0.25, -20dB -> 0.10, -30dB -> 0.03
      const relDb = currentDb - this._trackPeakDb;
      const linearAmp = Math.pow(10, Math.max(-40, Math.min(0, relDb)) / 20);
      targetEnergy = Math.max(0.15, Math.min(1, linearAmp));

      // 2. Real Bass / Kick Transient Detection:
      //    Only trigger when the segment is loud (top 6.5dB of the song, i.e. peakAmp >= 0.47)
      //    AND has a sharp percussive attack (deltaDb >= 3.8dB) + low-end bass weight.
      if (seg.kickStrength > 0) {
        const distFromPeakMs = elapsedMs - seg.peakOffsetMs;
        if (distFromPeakMs >= -25 && distFromPeakMs <= 190) {
          const env =
            distFromPeakMs < 0
              ? 1 + distFromPeakMs / 25
              : Math.pow(1 - distFromPeakMs / 190, 2.2);
          rawKick = env * seg.kickStrength * intensityMult;
        }
      }
    }

    // Fast attack on genuine kick transient, smooth natural release
    const attackRate = rawKick > this._smoothBeat ? 0.48 : 0.15;
    this._smoothBeat += (rawKick - this._smoothBeat) * attackRate;
    this._smoothBar = this._smoothBeat * 0.65;
    this._smoothEnergy += (targetEnergy - this._smoothEnergy) * 0.06;

    return {
      mood,
      beatPulse: Math.min(1.2, this._smoothBeat < 0.008 ? 0 : this._smoothBeat),
      barPulse: Math.min(1.0, this._smoothBar < 0.008 ? 0 : this._smoothBar),
      sectionEnergy: Math.max(0.15, Math.min(1, this._smoothEnergy)),
      bpm: this.bpm,
    };
  },

  _findInterval(arr, progressMs, cursorKey) {
    if (!arr.length) return null;
    let idx = Math.min(this[cursorKey] || 0, arr.length - 1);
    while (idx + 1 < arr.length && arr[idx + 1].startMs <= progressMs) idx++;
    while (idx > 0 && arr[idx].startMs > progressMs) idx--;
    this[cursorKey] = idx;
    const item = arr[idx];
    if (progressMs >= item.startMs && progressMs <= item.startMs + item.durMs + 80) {
      return item;
    }
    return null;
  },

  _analyzeColors(colors) {
    const dom = colors.dominant || [60, 60, 80];
    const acc = colors.accent || dom;

    const r = (dom[0] + acc[0]) * 0.5;
    const g = (dom[1] + acc[1]) * 0.5;
    const b = (dom[2] + acc[2]) * 0.5;

    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    this._colorLum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    this._colorSat = max === 0 ? 0 : (max - min) / max;
    this._colorWarmth = Math.max(0, Math.min(1, 0.5 + (r - b) / 320));
  },

  _recomputeAutoMood() {
    const txt = this._trackText || "";

    const hasMelancholicWord = MELANCHOLIC_KEYWORDS.some((kw) => txt.includes(kw));
    const hasEnergeticWord = ENERGETIC_KEYWORDS.some((kw) => txt.includes(kw));
    const hasLateNightWord = LATENIGHT_KEYWORDS.some((kw) => txt.includes(kw));

    let scoreEnergetic = 0;
    let scoreMelancholic = 0;
    let scoreLateNight = 0;
    let scoreDreamy = 0.35;

    if (hasEnergeticWord) scoreEnergetic += 0.65;
    if (hasMelancholicWord) scoreMelancholic += 0.65;
    if (hasLateNightWord) scoreLateNight += 0.65;

    if (this.bpm >= 124 || this._wordsPerSec >= 2.35) {
      scoreEnergetic += 0.55;
    } else if (this.bpm <= 95) {
      scoreMelancholic += 0.42;
      scoreLateNight += 0.3;
    } else {
      scoreDreamy += 0.25;
      scoreLateNight += 0.2;
    }

    if (this.baseEnergy >= 0.68) {
      scoreEnergetic += 0.45;
    } else if (this.baseEnergy <= 0.42) {
      scoreMelancholic += 0.35;
      scoreLateNight += 0.25;
    }

    if (this._colorLum < 0.32) {
      scoreLateNight += 0.38;
      scoreMelancholic += 0.22;
    }
    if (this._colorWarmth < 0.44) {
      scoreMelancholic += 0.32;
    } else if (this._colorWarmth > 0.58) {
      scoreDreamy += 0.35;
      if (this._colorSat > 0.6) scoreEnergetic += 0.2;
    }

    const candidates = [
      { id: "energetic", score: scoreEnergetic },
      { id: "melancholic", score: scoreMelancholic },
      { id: "latenight", score: scoreLateNight },
      { id: "dreamy", score: scoreDreamy },
    ];
    candidates.sort((a, b) => b.score - a.score);
    this._autoMood = candidates[0].id;
  },

  async _fetchAudioData(uri) {
    if (this._audioCache.has(uri)) {
      return this._audioCache.get(uri);
    }
    if (SpotiKitBridge.isStopped()) {
      return null;
    }

    let timer = null;
    try {
      const result = await Promise.race([
        SpotiKitBridge.getAudioData(uri),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(null), 2500);
        }),
      ]);
      if (result && Array.isArray(result.segments) && result.segments.length > 0) {
        if (this._audioCache.size > 30) {
          const oldest = this._audioCache.keys().next().value;
          this._audioCache.delete(oldest);
        }
        this._audioCache.set(uri, result);
        return result;
      }
    } catch (_) {
      // Ignore audio-analysis errors gracefully
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
    return null;
  },

  _parseAudioData(data) {
    if (!data || !Array.isArray(data.segments) || !data.segments.length) return;

    if (data.track && typeof data.track.tempo === "number" && data.track.tempo > 30) {
      this.bpm = Math.round(data.track.tempo);
    }

    const rawSegs = data.segments;
    // Find the track's 95th-percentile peak loudness (in dB) so quiet sections are accurately gated out
    const maxValues = rawSegs
      .map((s) => (typeof s.loudness_max === "number" ? s.loudness_max : -20))
      .sort((a, b) => a - b);
    const p95Idx = Math.min(maxValues.length - 1, Math.floor(maxValues.length * 0.95));
    const trackPeakDb = maxValues[p95Idx] ?? -4;
    this._trackPeakDb = trackPeakDb;

    let sumLinearAmp = 0;

    this.segments = rawSegs.map((s, idx) => {
      const startMs = Math.round((s.start || 0) * 1000);
      const durMs = Math.max(40, Math.round((s.duration || 0.25) * 1000));
      const peakOffsetMs = Math.max(
        5,
        Math.min(durMs - 5, Math.round((s.loudness_max_time || 0.03) * 1000))
      );

      const dbStart = typeof s.loudness_start === "number" ? s.loudness_start : -24;
      const dbMax = typeof s.loudness_max === "number" ? s.loudness_max : dbStart;
      const nextSeg = rawSegs[idx + 1];
      const dbEnd =
        nextSeg && typeof nextSeg.loudness_start === "number"
          ? nextSeg.loudness_start
          : typeof s.loudness_end === "number"
          ? s.loudness_end
          : dbStart;

      // Physical linear peak amplitude relative to the track's loudest peak: 10^((dbMax - trackPeakDb) / 20)
      const relPeakDb = dbMax - trackPeakDb;
      const peakAmp = Math.pow(10, Math.max(-40, Math.min(2, relPeakDb)) / 20);
      sumLinearAmp += Math.min(1, peakAmp);

      // Transient jump in dB from segment start to segment peak
      const deltaDb = Math.max(0, dbMax - dbStart);

      // Timbre low-frequency bass check: timbre[1] is spectral brightness (lower = deeper bass)
      let bassFactor = 1.0;
      if (Array.isArray(s.timbre) && s.timbre.length >= 2) {
        const brightness = s.timbre[1]; // typically -100 (sub-bass) to +100 (hi-hat/treble)
        if (brightness > 45) {
          bassFactor = 0.25; // high-hat / sibilance, not a bass kick
        } else if (brightness < -10) {
          bassFactor = 1.25; // deep low-end punch
        }
      }

      // Gate out quiet parts! A bass kick ONLY fires if:
      // 1) Segment peak is within 6.5dB of the track's loudest moments (peakAmp >= 0.47)
      // 2) Segment has a sharp percussive attack (deltaDb >= 3.5dB in <= 110ms)
      let kickStrength = 0;
      if (peakAmp >= 0.47 && deltaDb >= 3.5 && peakOffsetMs <= 110) {
        const normAttack = Math.min(1, (deltaDb - 3.0) / 9.0);
        const normLoud = Math.min(1, (peakAmp - 0.45) / 0.55);
        kickStrength = Math.min(1, normAttack * normLoud * bassFactor);
      }

      return {
        startMs,
        durMs,
        peakOffsetMs,
        dbStart,
        dbMax,
        dbEnd,
        kickStrength,
      };
    });

    this.baseEnergy = Math.max(0.2, Math.min(0.95, sumLinearAmp / rawSegs.length));
    this.hasExactAudio = true;
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

    "./services/CustomSyncStorage.js": function(require, exports, module) {
// --- ./services/CustomSyncStorage.js ---
/**
 * CustomSyncStorage
 * 100% compatible with NMWplays/Liquid-Lyrics local storage schema (`liquid-lyrics-custom-sync:<trackUri>`
 * and `liquid-lyrics-custom-sync-index`) & Spicy Lyrics universal JSON format (`Static` | `Line` | `Syllable`),
 * plus TTML and Enhanced LRC import/export and Fullscreen Reloaded line conversion.
 */
const {  parseTTML, parseLRC  } = require("./utils/parsers.js");

const SYNC_PREFIX = exports.SYNC_PREFIX = "liquid-lyrics-custom-sync:";
const INDEX_KEY = exports.INDEX_KEY = "liquid-lyrics-custom-sync-index";
const CHANGE_EVENT = exports.CHANGE_EVENT = "liquid-lyrics:custom-sync-changed";

function extractTrackId(uriOrId) {
  const s = String(uriOrId ?? "").trim();
  if (!s) return "";
  return s.includes(":") ? s.split(":")[2] || s : s;
}

function normalizeTrackUri(uriOrId) {
  const s = String(uriOrId ?? "").trim();
  if (!s) return "";
  if (s.startsWith("spotify:track:")) return s;
  const id = extractTrackId(s);
  return id ? `spotify:track:${id}` : s;
}

function isValidSyncRecord(obj) {
  if (!obj || typeof obj !== "object") return false;
  return (
    typeof obj.trackId === "string" &&
    (obj.mode === "line" || obj.mode === "word" || obj.mode === "static") &&
    Boolean(obj.lyrics) &&
    Boolean(obj.draft)
  );
}

function getCustomSync(trackOrUriOrId) {
  let rawUri = "";
  let rawId = "";
  if (trackOrUriOrId && typeof trackOrUriOrId === "object") {
    rawUri = String(trackOrUriOrId.uri || trackOrUriOrId.trackUri || "").trim();
    rawId = extractTrackId(rawUri || trackOrUriOrId.id || trackOrUriOrId.trackId || "");
  } else {
    rawUri = String(trackOrUriOrId ?? "").trim();
    rawId = extractTrackId(rawUri);
  }

  const candidates = [];
  if (rawUri) candidates.push(rawUri);
  if (rawId) {
    const fullUri = `spotify:track:${rawId}`;
    if (!candidates.includes(fullUri)) candidates.push(fullUri);
    if (!candidates.includes(rawId)) candidates.push(rawId);
  }

  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(SYNC_PREFIX + key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (isValidSyncRecord(parsed)) return parsed;
    } catch (_) {}
  }
  return null;
}

function hasCustomSync(trackOrUriOrId) {
  return getCustomSync(trackOrUriOrId) !== null;
}

function listCustomSyncs() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && (item.trackUri || item.trackId))
      .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
  } catch (_) {
    return [];
  }
}

function saveCustomSyncIndex(list) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("[FullLyrics Creator] Could not update sync index:", e);
  }
}

function dispatchSyncChange(trackUri, trackId) {
  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT, {
      detail: { trackUri, trackId },
    })
  );
}

function saveCustomSync(record) {
  const trackId = extractTrackId(record.trackUri || record.trackId);
  const trackUri = normalizeTrackUri(record.trackUri || trackId);
  if (!trackUri) throw new Error("Missing track URI or ID");

  // Keep record.mode as "line" or "word" for 100% Liquid-Lyrics `go(t)` validator compatibility
  const compatMode = record.mode === "word" ? "word" : "line";
  const updatedAt = Date.now();

  const payload = {
    ...record,
    version: 1,
    trackId,
    trackUri,
    mode: compatMode,
    updatedAt,
    draft: {
      ...record.draft,
      trackId,
      trackUri,
      updatedAt,
    },
  };

  localStorage.setItem(SYNC_PREFIX + trackUri, JSON.stringify(payload));

  // Also update index
  const existing = listCustomSyncs().filter(
    (entry) =>
      normalizeTrackUri(entry.trackUri || entry.trackId) !== trackUri &&
      extractTrackId(entry.trackId || entry.trackUri) !== trackId
  );
  existing.unshift({
    trackId,
    trackUri,
    title: payload.title || "Unknown Title",
    artist: payload.artist || "Unknown Artist",
    mode: compatMode,
    updatedAt,
  });
  saveCustomSyncIndex(existing);
  dispatchSyncChange(trackUri, trackId);
  return payload;
}

function deleteCustomSync(trackOrUriOrId) {
  const existing = getCustomSync(trackOrUriOrId);
  const trackId = extractTrackId(
    typeof trackOrUriOrId === "object"
      ? trackOrUriOrId?.uri || trackOrUriOrId?.trackUri || trackOrUriOrId?.id
      : trackOrUriOrId
  );
  const trackUri = normalizeTrackUri(
    typeof trackOrUriOrId === "object"
      ? trackOrUriOrId?.uri || trackOrUriOrId?.trackUri || trackId
      : trackOrUriOrId
  );

  if (trackUri) localStorage.removeItem(SYNC_PREFIX + trackUri);
  if (trackId) {
    localStorage.removeItem(SYNC_PREFIX + trackId);
    localStorage.removeItem(SYNC_PREFIX + `spotify:track:${trackId}`);
  }

  const nextIndex = listCustomSyncs().filter(
    (entry) =>
      normalizeTrackUri(entry.trackUri || entry.trackId) !== trackUri &&
      extractTrackId(entry.trackId || entry.trackUri) !== trackId
  );
  saveCustomSyncIndex(nextIndex);
  dispatchSyncChange(existing?.trackUri || trackUri, existing?.trackId || trackId);
}

// ============================================================================
// Draft Line Helpers & Plain Text Parser / Serializer (Liquid Lyrics Compatible)
// ============================================================================

function splitTextIntoTokens(text, prevTokens = []) {
  const words = String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.map((w, idx) => {
    const prev = prevTokens[idx];
    return {
      text: w,
      start: prev && prev.text === w ? prev.start ?? null : null,
      end: prev && prev.text === w ? prev.end ?? null : null,
    };
  });
}

function createLyricDraftLine(text = "", isDuet = false, prevLine = null) {
  const clean = String(text ?? "").trim();
  const tokens = splitTextIntoTokens(clean, prevLine?.tokens || []);
  return {
    kind: "lyric",
    text: clean,
    isDuet: Boolean(isDuet ?? prevLine?.isDuet),
    tokens,
    backgrounds: prevLine?.backgrounds ? prevLine.backgrounds.map((b) => ({ ...b })) : [],
    start: prevLine?.start ?? null,
    end: prevLine?.end ?? null,
  };
}

function createInterludeDraftLine(start = null, end = null) {
  return {
    kind: "interlude",
    start: start ?? null,
    end: end ?? null,
  };
}

function createBackgroundDraftEntry(text = "", prevBg = null) {
  const clean = String(text ?? "").trim();
  return {
    text: clean,
    tokens: splitTextIntoTokens(clean, prevBg?.tokens || []),
    start: prevBg?.start ?? null,
    end: prevBg?.end ?? null,
  };
}

/**
 * Parses bulk editor text into draft lines while preserving existing timestamps
 * whenever lines match. Supports:
 * - `#interlude` or `♪` -> instrumental break
 * - `[background text]` below a lyric line -> attaches background vocal to that line
 * - `v2: lyric text` -> sets Duet (singer 2 / right-aligned) flag on that line
 */
function parsePlainTextToDraftLines(rawText, prevLines = []) {
  const usedIndices = new Set();
  const takeMatchingPrev = (predicate) => {
    for (let i = 0; i < prevLines.length; i++) {
      if (usedIndices.has(i)) continue;
      const cand = prevLines[i];
      if (predicate(cand)) {
        usedIndices.add(i);
        return cand;
      }
    }
    return null;
  };

  const result = [];
  let lastLyricLine = null;

  for (const rawRow of String(rawText ?? "").split(/\r?\n/)) {
    let trimmed = rawRow.trim();
    if (!trimmed) continue;

    if (/^#interlude$/i.test(trimmed) || trimmed === "♪") {
      const prevInterlude = takeMatchingPrev((c) => c.kind === "interlude");
      result.push({
        kind: "interlude",
        start: prevInterlude?.start ?? null,
        end: prevInterlude?.end ?? null,
      });
      lastLyricLine = null;
      continue;
    }

    const bgMatch = trimmed.match(/^\[(.+)\]$/);
    if (bgMatch && lastLyricLine && !/^v[12]$/i.test(bgMatch[1].trim())) {
      const bgText = bgMatch[1].trim();
      if (!bgText) continue;
      const bgIdx = lastLyricLine.backgrounds.length;
      const prevBg = lastLyricLine._prevBgs?.[bgIdx];
      lastLyricLine.backgrounds.push(createBackgroundDraftEntry(bgText, prevBg));
      continue;
    }

    let isDuet = false;
    if (/^(?:v2\s*:|\[v2\])\s*/i.test(trimmed)) {
      isDuet = true;
      trimmed = trimmed.replace(/^(?:v2\s*:|\[v2\])\s*/i, "").trim();
    } else if (/^(?:v1\s*:|\[v1\])\s*/i.test(trimmed)) {
      trimmed = trimmed.replace(/^(?:v1\s*:|\[v1\])\s*/i, "").trim();
    }
    if (!trimmed) continue;

    const exactPrev =
      takeMatchingPrev((c) => c.kind === "lyric" && c.text === trimmed) ||
      takeMatchingPrev((c) => c.kind === "lyric");

    const lineObj = {
      kind: "lyric",
      text: trimmed,
      isDuet: isDuet || Boolean(exactPrev?.isDuet),
      tokens: splitTextIntoTokens(trimmed, exactPrev?.tokens || []),
      backgrounds: [],
      _prevBgs: exactPrev?.backgrounds || [],
      start: exactPrev?.start ?? null,
      end: exactPrev?.end ?? null,
    };

    result.push(lineObj);
    lastLyricLine = lineObj;
  }

  for (const item of result) {
    if (item.kind === "lyric") {
      delete item._prevBgs;
    }
  }

  return result;
}

function serializeDraftLinesToText(lines = []) {
  const out = [];
  for (const line of lines) {
    if (!line) continue;
    if (line.kind === "interlude") {
      out.push("#interlude");
      continue;
    }
    const prefix = line.isDuet ? "v2: " : "";
    out.push(`${prefix}${line.text || ""}`);
    if (Array.isArray(line.backgrounds)) {
      for (const bg of line.backgrounds) {
        if (bg && bg.text) {
          out.push(`[${bg.text}]`);
        }
      }
    }
  }
  return out.join("\n");
}

// ============================================================================
// Compiler: Draft -> Spicy Lyrics / Liquid Lyrics Universal Payload
// ============================================================================

function findPreviousTimelineEnd(lines, fromIdx, fallbackStartMs = 0) {
  for (let i = fromIdx - 1; i >= 0; i--) {
    const cand = lines[i];
    if (!cand) continue;
    if (cand.kind === "interlude" && cand.end != null) return cand.end;
    if (cand.kind === "lyric") {
      const e = cand.end ?? cand.tokens?.[cand.tokens.length - 1]?.end ?? null;
      if (e != null) return e;
      const s = cand.start ?? cand.tokens?.[0]?.start ?? null;
      if (s != null) return s + 2500;
    }
  }
  return fallbackStartMs;
}

function findNextTimelineStart(lines, fromIdx, fallbackEndMs) {
  for (let i = fromIdx + 1; i < lines.length; i++) {
    const cand = lines[i];
    if (!cand) continue;
    if (cand.kind === "interlude" && cand.start != null) return cand.start;
    if (cand.kind === "lyric") {
      const s = cand.start ?? cand.tokens?.[0]?.start ?? null;
      if (s != null) return s;
    }
  }
  return fallbackEndMs;
}

function isDraftLineComplete(line, mode) {
  if (!line) return false;
  if (mode === "static") return line.kind === "lyric" && Boolean(line.text?.trim());
  if (line.kind === "interlude") return line.start != null;
  if (mode === "line") return line.start != null;
  return (
    line.tokens.length > 0 &&
    line.tokens.every((t) => t.start != null) &&
    line.backgrounds.every((b) => b.tokens.length > 0 && b.tokens.every((t) => t.start != null))
  );
}

function compileDraftToSpicyLyrics(draft) {
  const trackId = extractTrackId(draft.trackUri || draft.trackId);
  const credit = draft.credit?.trim() || undefined;
  const syncMode = draft.syncMode || draft.mode || "line";
  const lines = Array.isArray(draft.lines) ? draft.lines : [];
  const durationFallback = draft.endMs ?? (draft.durationMs > 0 ? draft.durationMs : 180000);

  // 1. Check if static mode or if zero timestamps exist across all lines
  const hasAnyTimestamp = lines.some((l) => {
    if (!l) return false;
    if (l.start != null) return true;
    if (l.kind === "lyric" && l.tokens?.some((tok) => tok.start != null)) return true;
    return false;
  });

  if (syncMode === "static" || !hasAnyTimestamp) {
    return {
      Id: trackId,
      Type: "Static",
      SongWriters: [],
      Lines: lines
        .filter((l) => l && l.kind === "lyric" && l.text?.trim())
        .map((l) => ({
          Text: l.text.trim(),
          OppositeAligned: Boolean(l.isDuet),
          IsRTL: false,
        })),
      Provider: "local",
      ...(credit ? { LiquidLyricsCredit: credit } : {}),
    };
  }

  // 2. Line-synced mode
  if (syncMode === "line") {
    const content = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      let start = l.start ?? l.tokens?.[0]?.start ?? null;
      const prevEnd = findPreviousTimelineEnd(lines, i, 0);
      const nextStart = findNextTimelineStart(lines, i, durationFallback);

      // Gracefully interpolate untimed interludes positioned between timed lines
      if (start == null && l.kind === "interlude" && nextStart > prevEnd + 1500) {
        start = prevEnd + 200;
      }
      if (start == null) continue;

      const rawEnd = l.end != null && l.end > start ? l.end : nextStart;
      const end = Math.max(start + 200, rawEnd || start + 3000);

      if (l.kind === "interlude") {
        content.push({
          Type: "Interlude",
          Text: "♪",
          StartTime: Math.round(start),
          EndTime: Math.round(end),
          OppositeAligned: false,
          IsRTL: false,
        });
      } else {
        const bgTexts = (l.backgrounds || []).map((b) => b.text?.trim()).filter(Boolean);
        content.push({
          Type: "Line",
          Text: l.text,
          StartTime: Math.round(start),
          EndTime: Math.round(end),
          OppositeAligned: Boolean(l.isDuet),
          IsRTL: false,
          ...(bgTexts.length ? { BackgroundText: `(${bgTexts.join(" ")})` } : {}),
        });
      }
    }

    content.sort((a, b) => (Number(a.StartTime) || 0) - (Number(b.StartTime) || 0));

    return {
      Id: trackId,
      Type: "Line",
      SongWriters: [],
      Content: content,
      StartTime: content[0]?.StartTime ?? 0,
      EndTime: content[content.length - 1]?.EndTime ?? durationFallback,
      Provider: "local",
      ...(credit ? { LiquidLyricsCredit: credit } : {}),
    };
  }

  // 3. Word-synced (Karaoke / Syllable) mode
  const content = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    const prevEnd = findPreviousTimelineEnd(lines, i, 0);
    const nextLineStart = findNextTimelineStart(lines, i, durationFallback);

    if (l.kind === "interlude") {
      let intStart = l.start;
      if (intStart == null && nextLineStart > prevEnd + 1500) {
        intStart = prevEnd + 200;
      }
      if (intStart == null) continue;
      const end = Math.max(intStart + 200, l.end != null && l.end > intStart ? l.end : nextLineStart);
      content.push({
        Type: "Vocal",
        OppositeAligned: false,
        IsRTL: false,
        Lead: {
          StartTime: Math.round(intStart),
          EndTime: Math.round(end),
          Syllables: [
            {
              Text: "♪",
              IsPartOfWord: false,
              StartTime: Math.round(intStart),
              EndTime: Math.round(end),
            },
          ],
        },
      });
      continue;
    }

    // Lyric line in word mode (also gracefully handles partially-timed lines!)
    const timedTokens = (l.tokens || []).filter((t) => t.start != null);
    const lineStart = timedTokens[0]?.start ?? l.start ?? null;
    if (lineStart == null) continue;

    const lineEndRaw = l.end != null && l.end > lineStart ? l.end : nextLineStart;
    const lineEnd = Math.max(lineStart + 200, lineEndRaw || lineStart + 3000);

    const tokenCount = Math.max(1, l.tokens.length);
    const sliceMs = (lineEnd - lineStart) / tokenCount;

    const syllables = l.tokens.map((tok, idx) => {
      const tStart = tok.start != null ? tok.start : Math.round(lineStart + idx * sliceMs);
      const nextTokStart = l.tokens[idx + 1]?.start;
      let tEnd = tok.end != null && tok.end > tStart ? tok.end : nextTokStart ?? lineEnd;
      if (tEnd <= tStart) tEnd = tStart + Math.max(100, Math.round(sliceMs));
      return {
        Text: tok.text,
        IsPartOfWord: false,
        StartTime: Math.round(tStart),
        EndTime: Math.round(tEnd),
      };
    });

    const leadStart = syllables[0]?.StartTime ?? Math.round(lineStart);
    const leadEnd = syllables[syllables.length - 1]?.EndTime ?? Math.round(lineEnd);

    const backgrounds = [];
    for (const bg of l.backgrounds || []) {
      if (!bg || !bg.tokens?.length) continue;
      const bgStart = bg.tokens[0]?.start ?? bg.start ?? leadStart + Math.round((leadEnd - leadStart) * 0.35);
      const bgEndRaw = bg.end != null && bg.end > bgStart ? bg.end : leadEnd;
      const bgEnd = Math.max(bgStart + 160, bgEndRaw);
      const bgSlice = (bgEnd - bgStart) / Math.max(1, bg.tokens.length);

      const bgSyllables = bg.tokens.map((bt, bIdx) => {
        const bs = bt.start != null ? bt.start : Math.round(bgStart + bIdx * bgSlice);
        const nextBs = bg.tokens[bIdx + 1]?.start;
        let be = bt.end != null && bt.end > bs ? bt.end : nextBs ?? bgEnd;
        if (be <= bs) be = bs + Math.max(90, Math.round(bgSlice));
        return {
          Text: bt.text,
          IsPartOfWord: false,
          StartTime: Math.round(bs),
          EndTime: Math.round(be),
        };
      });

      backgrounds.push({
        StartTime: bgSyllables[0]?.StartTime ?? Math.round(bgStart),
        EndTime: bgSyllables[bgSyllables.length - 1]?.EndTime ?? Math.round(bgEnd),
        Syllables: bgSyllables,
      });
    }

    content.push({
      Type: "Vocal",
      OppositeAligned: Boolean(l.isDuet),
      IsRTL: false,
      Lead: {
        StartTime: leadStart,
        EndTime: leadEnd,
        Syllables: syllables,
      },
      ...(backgrounds.length ? { Background: backgrounds } : {}),
    });
  }

  content.sort((a, b) => {
    const aStart = a.Lead?.StartTime ?? a.StartTime ?? 0;
    const bStart = b.Lead?.StartTime ?? b.StartTime ?? 0;
    return aStart - bStart;
  });

  return {
    Id: trackId,
    Type: "Syllable",
    SongWriters: [],
    Content: content,
    StartTime: content[0]?.Lead?.StartTime ?? 0,
    EndTime: content[content.length - 1]?.Lead?.EndTime ?? durationFallback,
    Provider: "local",
    ...(credit ? { LiquidLyricsCredit: credit } : {}),
  };
}

// ============================================================================
// Converter: Spicy / Liquid Lyrics Payload -> Fullscreen Reloaded Lines
// ============================================================================

function syllablesToWords(syllables = [], fallbackStartMs = 0, fallbackEndMs = 3000) {
  const words = [];
  let current = null;

  for (let i = 0; i < syllables.length; i++) {
    const syl = syllables[i];
    if (!syl) continue;
    const rawText = String(syl.Text ?? "");
    const trimmed = rawText.trim();
    if (!trimmed) continue;

    const sStart = syl.StartTime != null ? Number(syl.StartTime) : null;
    const sEnd = syl.EndTime != null ? Number(syl.EndTime) : null;
    const isPart = Boolean(syl.IsPartOfWord);

    if (!current) {
      current = {
        text: trimmed,
        startMs: sStart,
        endMs: sEnd,
        exactWordSync: true,
      };
    } else {
      current.text += trimmed;
      if (sEnd != null) current.endMs = sEnd;
    }

    if (!isPart || i === syllables.length - 1) {
      words.push(current);
      current = null;
    }
  }

  if (current) words.push(current);

  for (let k = 0; k < words.length; k++) {
    const isLast = k === words.length - 1;
    if (!isLast && !words[k].text.endsWith(" ")) {
      words[k].text += " ";
    }
    if (words[k].startMs == null) {
      words[k].startMs = k === 0 ? fallbackStartMs : words[k - 1].endMs ?? fallbackStartMs;
    }
    if (words[k].endMs == null || words[k].endMs <= words[k].startMs) {
      words[k].endMs = words[k + 1]?.startMs ?? fallbackEndMs;
    }
  }

  return words;
}

function spicyLyricsToFullscreenLines(spicyData, defaultSource = "Spicy Lyrics") {
  if (!spicyData || typeof spicyData !== "object") return null;

  const source =
    spicyData.Provider === "local"
      ? spicyData.LiquidLyricsCredit
        ? `Local · ${spicyData.LiquidLyricsCredit}`
        : "FullLyrics Local"
      : defaultSource;

  // 1. Static (unsynced)
  if (spicyData.Type === "Static") {
    const rawLines = Array.isArray(spicyData.Lines) ? spicyData.Lines : [];
    const lines = rawLines
      .map((item) => {
        const text = String(item?.Text ?? "").trim();
        if (!text) return null;
        const parts = text.split(/\s+/).filter(Boolean);
        return {
          startMs: 0,
          endMs: 0,
          isWordSynced: false,
          isDuet: Boolean(item?.OppositeAligned),
          words: parts.map((w, idx) => ({
            text: idx < parts.length - 1 ? w + " " : w,
          })),
        };
      })
      .filter(Boolean);

    if (!lines.length) return null;
    return {
      type: "unsynced",
      source,
      lines,
    };
  }

  // 2. Line-synced
  if (spicyData.Type === "Line") {
    const content = Array.isArray(spicyData.Content) ? spicyData.Content : [];
    const lines = content
      .map((item, idx) => {
        if (!item) return null;
        const startMs = Number(item.StartTime) || 0;
        const nextStart = content[idx + 1] ? Number(content[idx + 1].StartTime) : startMs + 3500;
        const endMs = Number(item.EndTime) > startMs ? Number(item.EndTime) : nextStart;

        if (item.Type === "Interlude" || String(item.Text ?? "").trim() === "♪") {
          return {
            startMs,
            endMs,
            hasLineTime: true,
            isWordSynced: false,
            isDuet: false,
            words: [{ text: "♪", startMs, endMs }],
          };
        }

        const text = String(item.Text ?? "").trim();
        if (!text) return null;
        const parts = text.split(/\s+/).filter(Boolean);

        let bgVocal = null;
        if (item.BackgroundText) {
          const bgClean = String(item.BackgroundText).trim();
          const bgStart = startMs + Math.round((endMs - startMs) * 0.4);
          const bgParts = bgClean.split(/\s+/).filter(Boolean);
          bgVocal = {
            text: bgClean.startsWith("(") ? bgClean : `(${bgClean})`,
            startMs: bgStart,
            endMs,
            isWordSynced: false,
            words: bgParts.map((w, wIdx) => ({
              text: wIdx < bgParts.length - 1 ? w + " " : w,
              startMs: bgStart,
              endMs,
            })),
          };
        }

        return {
          startMs,
          endMs,
          hasLineTime: true,
          isWordSynced: false,
          isDuet: Boolean(item.OppositeAligned),
          bgVocal,
          words: parts.map((w, wIdx) => ({
            text: wIdx < parts.length - 1 ? w + " " : w,
            startMs,
            endMs,
          })),
        };
      })
      .filter(Boolean);

    if (!lines.length) return null;
    lines.sort((a, b) => (Number(a.startMs) || 0) - (Number(b.startMs) || 0));
    return {
      type: "synced",
      source,
      lines,
    };
  }

  // 3. Syllable / Word-synced
  if (spicyData.Type === "Syllable") {
    const content = Array.isArray(spicyData.Content) ? spicyData.Content : [];
    const lines = content
      .map((item, idx) => {
        if (!item) return null;
        if (item.Type === "Interlude") {
          const startMs = Number(item.StartTime) || 0;
          const endMs = Number(item.EndTime) || startMs + 3000;
          return {
            startMs,
            endMs,
            hasLineTime: true,
            isWordSynced: true,
            isDuet: false,
            words: [{ text: "♪", startMs, endMs }],
          };
        }

        const lead = item.Lead || item;
        const syllables = Array.isArray(lead?.Syllables) ? lead.Syllables : [];
        const startMs = Number(lead?.StartTime ?? syllables[0]?.StartTime) || 0;
        const nextStart = content[idx + 1]?.Lead?.StartTime
          ? Number(content[idx + 1].Lead.StartTime)
          : startMs + 3500;
        const endMs =
          Number(lead?.EndTime) > startMs
            ? Number(lead.EndTime)
            : Number(syllables[syllables.length - 1]?.EndTime) || nextStart;

        const words = syllablesToWords(syllables, startMs, endMs);
        if (!words.length) return null;

        // Check if it's an interlude vocal
        if (words.length === 1 && words[0].text.trim() === "♪") {
          return {
            startMs,
            endMs,
            hasLineTime: true,
            isWordSynced: true,
            isDuet: false,
            words: [{ text: "♪", startMs, endMs }],
          };
        }

        let bgVocal = null;
        if (Array.isArray(item.Background) && item.Background.length > 0) {
          const allBgWords = [];
          let bgStartMs = null;
          let bgEndMs = null;
          for (const bgItem of item.Background) {
            const bStart = Number(bgItem.StartTime) || startMs;
            const bEnd = Number(bgItem.EndTime) || endMs;
            if (bgStartMs == null || bStart < bgStartMs) bgStartMs = bStart;
            if (bgEndMs == null || bEnd > bgEndMs) bgEndMs = bEnd;
            const bWords = syllablesToWords(bgItem.Syllables || [], bStart, bEnd);
            allBgWords.push(...bWords);
          }
          if (allBgWords.length > 0) {
            // Ensure spaces between merged background groups
            for (let k = 0; k < allBgWords.length - 1; k++) {
              if (!allBgWords[k].text.endsWith(" ")) allBgWords[k].text += " ";
            }
            const rawBgText = allBgWords.map((w) => w.text).join("").trim();
            bgVocal = {
              text: rawBgText.startsWith("(") ? rawBgText : `(${rawBgText})`,
              startMs: bgStartMs ?? startMs,
              endMs: bgEndMs ?? endMs,
              isWordSynced: true,
              words: allBgWords,
            };
          }
        }

        return {
          startMs,
          endMs,
          hasLineTime: true,
          isWordSynced: true,
          isDuet: Boolean(item.OppositeAligned),
          bgVocal,
          words,
        };
      })
      .filter(Boolean);

    if (!lines.length) return null;
    lines.sort((a, b) => (Number(a.startMs) || 0) - (Number(b.startMs) || 0));
    return {
      type: "word-synced",
      source,
      lines,
    };
  }

  return null;
}

// ============================================================================
// Decompiler: Resolved Fullscreen Lines / Spicy JSON / TTML / LRC -> Draft
// ============================================================================

function fullscreenLinesToDraft(resolvedData, trackInfo = {}) {
  const trackId = extractTrackId(trackInfo.trackUri || trackInfo.uri || trackInfo.trackId || "");
  const trackUri = normalizeTrackUri(trackInfo.trackUri || trackInfo.uri || trackId);
  const title = trackInfo.title || "Unknown Title";
  const artist = trackInfo.artist || "Unknown Artist";
  const durationMs = Number(trackInfo.durationMs) || 0;

  if (!resolvedData || !Array.isArray(resolvedData.lines) || !resolvedData.lines.length) {
    return {
      trackId,
      trackUri,
      title,
      artist,
      durationMs,
      mode: "word",
      syncMode: "word",
      credit: "",
      lines: [],
      endMs: durationMs > 0 ? durationMs : null,
      updatedAt: Date.now(),
    };
  }

  const syncMode =
    resolvedData.type === "word-synced"
      ? "word"
      : resolvedData.type === "synced"
      ? "line"
      : "static";

  const draftLines = [];
  for (const line of resolvedData.lines) {
    if (!line) continue;
    const rawWords = Array.isArray(line.words) ? line.words : [];
    const joinedText = rawWords
      .map((w) => (typeof w === "string" ? w : w.text || ""))
      .join("")
      .trim();

    if (joinedText === "♪" || joinedText === "🎵" || line._isMusic) {
      draftLines.push({
        kind: "interlude",
        start: line.startMs != null ? Math.round(line.startMs) : null,
        end: line.endMs != null ? Math.round(line.endMs) : null,
      });
      continue;
    }

    if (!joinedText) continue;

    const tokens = rawWords
      .map((w) => {
        const wText = (typeof w === "string" ? w : w.text || "").trim();
        if (!wText) return null;
        return {
          text: wText,
          start:
            syncMode === "word" && w.startMs != null
              ? Math.round(w.startMs)
              : syncMode === "line" && line.startMs != null
              ? null
              : null,
          end: syncMode === "word" && w.endMs != null ? Math.round(w.endMs) : null,
        };
      })
      .filter(Boolean);

    const backgrounds = [];
    if (line.bgVocal && line.bgVocal.text) {
      const cleanBg = String(line.bgVocal.text)
        .replace(/^\(|\)$/g, "")
        .trim();
      if (cleanBg) {
        const bgWords = Array.isArray(line.bgVocal.words) ? line.bgVocal.words : [];
        const bgTokens = bgWords.length
          ? bgWords
              .map((bw) => {
                const bt = String(bw.text || "")
                  .replace(/^\(|\)$/g, "")
                  .trim();
                if (!bt) return null;
                return {
                  text: bt,
                  start:
                    line.bgVocal.isWordSynced && bw.startMs != null ? Math.round(bw.startMs) : null,
                  end: line.bgVocal.isWordSynced && bw.endMs != null ? Math.round(bw.endMs) : null,
                };
              })
              .filter(Boolean)
          : splitTextIntoTokens(cleanBg);

        backgrounds.push({
          text: cleanBg,
          tokens: bgTokens,
          start: line.bgVocal.startMs != null ? Math.round(line.bgVocal.startMs) : null,
          end: line.bgVocal.endMs != null ? Math.round(line.bgVocal.endMs) : null,
        });
      }
    }

    draftLines.push({
      kind: "lyric",
      text: tokens.map((t) => t.text).join(" "),
      isDuet: Boolean(line.isDuet),
      tokens,
      backgrounds,
      start: syncMode !== "static" && line.startMs != null ? Math.round(line.startMs) : null,
      end: syncMode !== "static" && line.endMs != null ? Math.round(line.endMs) : null,
    });
  }

  const lastLine = draftLines[draftLines.length - 1];
  const inferredEndMs = lastLine?.end ?? (durationMs > 0 ? durationMs : null);

  return {
    trackId,
    trackUri,
    title,
    artist,
    durationMs,
    mode: syncMode === "word" ? "word" : "line",
    syncMode,
    credit: "",
    lines: draftLines,
    endMs: inferredEndMs,
    updatedAt: Date.now(),
  };
}

/**
 * Imports any external lyrics file (.json, .ttml, .xml, .lrc, .txt) into a Draft object.
 */
function importFileToDraft(fileContent, fileName = "", trackInfo = {}) {
  const lower = String(fileName || "").toLowerCase();
  const trimmed = String(fileContent || "").trim();
  if (!trimmed) throw new Error("Empty file");

  // 1. JSON (Liquid Lyrics custom sync record OR raw Spicy Lyrics JSON)
  if (lower.endsWith(".json") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    if (parsed && parsed.draft && Array.isArray(parsed.draft.lines)) {
      const d = parsed.draft;
      const trackId = extractTrackId(trackInfo.trackUri || d.trackUri || d.trackId);
      const trackUri = normalizeTrackUri(trackInfo.trackUri || d.trackUri || trackId);
      return {
        ...d,
        trackId,
        trackUri,
        title: trackInfo.title || d.title || parsed.title || "Unknown Title",
        artist: trackInfo.artist || d.artist || parsed.artist || "Unknown Artist",
        durationMs: trackInfo.durationMs || d.durationMs || 0,
        syncMode: d.syncMode || d.mode || "line",
        mode: d.mode === "word" ? "word" : "line",
        lines: d.lines.map((l) =>
          l.kind === "interlude"
            ? { kind: "interlude", start: l.start ?? null, end: l.end ?? null }
            : {
                kind: "lyric",
                text: l.text || "",
                isDuet: Boolean(l.isDuet),
                tokens: (l.tokens || []).map((t) => ({
                  text: t.text,
                  start: t.start ?? null,
                  end: t.end ?? null,
                })),
                backgrounds: (l.backgrounds || []).map((b) => ({
                  text: b.text || "",
                  tokens: (b.tokens || []).map((bt) => ({
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
      };
    }

    if (parsed && (parsed.Type === "Syllable" || parsed.Type === "Line" || parsed.Type === "Static")) {
      const resolved = spicyLyricsToFullscreenLines(parsed);
      return fullscreenLinesToDraft(resolved, trackInfo);
    }
    throw new Error("Unsupported JSON format");
  }

  // 2. TTML / XML
  if (lower.endsWith(".ttml") || lower.endsWith(".xml") || trimmed.includes("<tt")) {
    const lines = parseTTML(trimmed);
    if (!lines.length) throw new Error("No valid lyrics found in TTML file");
    const isWord = lines.some((l) => l.isWordSynced);
    const isLine = lines.some((l) => l.hasLineTime);
    return fullscreenLinesToDraft(
      {
        type: isWord ? "word-synced" : isLine ? "synced" : "unsynced",
        lines,
      },
      trackInfo
    );
  }

  // 3. LRC / Enhanced LRC
  if (lower.endsWith(".lrc") || /^\s*\[\d+:\d+/m.test(trimmed)) {
    const lines = parseLRC(trimmed);
    if (!lines.length) throw new Error("No valid lyrics found in LRC file");
    const isWord = lines.some((l) => l.isWordSynced);
    return fullscreenLinesToDraft(
      {
        type: isWord ? "word-synced" : "synced",
        lines,
      },
      trackInfo
    );
  }

  // 4. Plain Text (.txt)
  const draftLines = parsePlainTextToDraftLines(trimmed, []);
  const trackId = extractTrackId(trackInfo.trackUri || trackInfo.trackId || "");
  const trackUri = normalizeTrackUri(trackInfo.trackUri || trackId);
  return {
    trackId,
    trackUri,
    title: trackInfo.title || "Unknown Title",
    artist: trackInfo.artist || "Unknown Artist",
    durationMs: Number(trackInfo.durationMs) || 0,
    mode: "word",
    syncMode: "word",
    credit: "",
    lines: draftLines,
    endMs: Number(trackInfo.durationMs) || null,
    updatedAt: Date.now(),
  };
}

// ============================================================================
// Exporters: JSON (Liquid Lyrics), TTML (Apple Music / Spicy), LRC (Enhanced)
// ============================================================================

function formatTTMLTimestamp(ms) {
  const safe = Math.max(0, Math.round(Number(ms) || 0));
  const totalSec = Math.floor(safe / 1000);
  const milli = safe % 1000;
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const msStr = String(milli).padStart(3, "0");
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${msStr}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${msStr}`;
}

function escapeXml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function exportDraftAsTTML(draft) {
  const compiled = compileDraftToSpicyLyrics(draft);
  const timingMode =
    compiled.Type === "Syllable" ? "Word" : compiled.Type === "Line" ? "Line" : "None";

  const pNodes = [];

  if (compiled.Type === "Static") {
    for (const l of compiled.Lines || []) {
      const agentAttr = l.OppositeAligned ? ' ttm:agent="v2"' : ' ttm:agent="v1"';
      pNodes.push(`      <p${agentAttr}>${escapeXml(l.Text)}</p>`);
    }
  } else if (compiled.Type === "Line") {
    for (const item of compiled.Content || []) {
      if (item.Type === "Interlude") continue;
      const begin = formatTTMLTimestamp(item.StartTime);
      const end = formatTTMLTimestamp(item.EndTime);
      const agentAttr = item.OppositeAligned ? ' ttm:agent="v2"' : ' ttm:agent="v1"';
      const bgPart = item.BackgroundText
        ? ` <span ttm:role="x-bg">${escapeXml(item.BackgroundText)}</span>`
        : "";
      pNodes.push(
        `      <p begin="${begin}" end="${end}"${agentAttr}>${escapeXml(item.Text)}${bgPart}</p>`
      );
    }
  } else if (compiled.Type === "Syllable") {
    for (const item of compiled.Content || []) {
      const lead = item.Lead;
      if (!lead || !Array.isArray(lead.Syllables) || !lead.Syllables.length) continue;
      if (lead.Syllables.length === 1 && lead.Syllables[0].Text === "♪") continue;

      const begin = formatTTMLTimestamp(lead.StartTime);
      const end = formatTTMLTimestamp(lead.EndTime);
      const agentAttr = item.OppositeAligned ? ' ttm:agent="v2"' : ' ttm:agent="v1"';

      const mainSpans = lead.Syllables.map((s) => {
        const sBegin = formatTTMLTimestamp(s.StartTime);
        const sEnd = formatTTMLTimestamp(s.EndTime);
        return `<span begin="${sBegin}" end="${sEnd}">${escapeXml(s.Text)}</span>`;
      }).join(" ");

      let bgSpans = "";
      if (Array.isArray(item.Background) && item.Background.length) {
        const bgParts = item.Background.map((bg) => {
          const bBegin = formatTTMLTimestamp(bg.StartTime);
          const bEnd = formatTTMLTimestamp(bg.EndTime);
          const inner = (bg.Syllables || [])
            .map(
              (bs) =>
                `<span begin="${formatTTMLTimestamp(bs.StartTime)}" end="${formatTTMLTimestamp(bs.EndTime)}">${escapeXml(bs.Text)}</span>`
            )
            .join(" ");
          return `<span ttm:role="x-bg" begin="${bBegin}" end="${bEnd}">${inner}</span>`;
        });
        bgSpans = " " + bgParts.join(" ");
      }

      pNodes.push(`      <p begin="${begin}" end="${end}"${agentAttr}>${mainSpans}${bgSpans}</p>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml"
    xmlns:ttm="http://www.w3.org/ns/ttml#metadata"
    xmlns:itunes="http://music.apple.com/lyric-ttml-internal"
    itunes:timing="${timingMode}">
  <head>
    <metadata>
      <ttm:title>${escapeXml(draft.title || "")}</ttm:title>
      <ttm:agent xml:id="v1" type="person"/>
      <ttm:agent xml:id="v2" type="person"/>
    </metadata>
  </head>
  <body>
    <div>
${pNodes.join("\n")}
    </div>
  </body>
</tt>
`;
}

function formatLRCTimestamp(ms, bracket = "[") {
  const close = bracket === "<" ? ">" : "]";
  const safe = Math.max(0, Math.round(Number(ms) || 0));
  const mins = Math.floor(safe / 60000);
  const secs = Math.floor((safe % 60000) / 1000);
  const cs = Math.floor((safe % 1000) / 10);
  return `${bracket}${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}${close}`;
}

function exportDraftAsLRC(draft) {
  const compiled = compileDraftToSpicyLyrics(draft);
  const header = [
    `[ti:${draft.title || ""}]`,
    `[ar:${draft.artist || ""}]`,
    `[by:${draft.credit || "FullLyrics Creator (Fullscreen Reloaded)"}]`,
    "",
  ];

  if (compiled.Type === "Static") {
    return [...header, ...(compiled.Lines || []).map((l) => l.Text)].join("\n");
  }

  if (compiled.Type === "Line") {
    const body = (compiled.Content || []).map((item) => {
      const tag = formatLRCTimestamp(item.StartTime, "[");
      if (item.Type === "Interlude") return `${tag} ♪`;
      const duetPrefix = item.OppositeAligned ? "v2: " : "";
      const bgSuffix = item.BackgroundText ? ` ${item.BackgroundText}` : "";
      return `${tag}${duetPrefix}${item.Text}${bgSuffix}`;
    });
    return [...header, ...body].join("\n");
  }

  if (compiled.Type === "Syllable") {
    const body = (compiled.Content || []).map((item) => {
      const lead = item.Lead;
      const lineTag = formatLRCTimestamp(lead.StartTime, "[");
      const duetPrefix = item.OppositeAligned ? "v2: " : "";
      const words = (lead.Syllables || [])
        .map((s) => `${formatLRCTimestamp(s.StartTime, "<")}${s.Text}`)
        .join(" ");
      let bgSuffix = "";
      if (Array.isArray(item.Background) && item.Background.length) {
        const bgWords = item.Background.flatMap((b) => b.Syllables || [])
          .map((bs) => bs.Text)
          .join(" ");
        if (bgWords) bgSuffix = ` (${bgWords})`;
      }
      return `${lineTag}${duetPrefix}${words}${bgSuffix}`;
    });
    return [...header, ...body].join("\n");
  }

  return header.join("\n");
}

function exportDraftAsJSON(draft) {
  const trackId = extractTrackId(draft.trackUri || draft.trackId);
  const trackUri = normalizeTrackUri(draft.trackUri || trackId);
  const compatMode = draft.syncMode === "word" || draft.mode === "word" ? "word" : "line";
  const lyrics = compileDraftToSpicyLyrics(draft);
  const payload = {
    version: 1,
    trackId,
    trackUri,
    title: draft.title || "Unknown Title",
    artist: draft.artist || "Unknown Artist",
    durationMs: Number(draft.durationMs) || 0,
    mode: compatMode,
    ...(draft.credit?.trim() ? { credit: draft.credit.trim() } : {}),
    updatedAt: Date.now(),
    lyrics,
    draft: {
      ...draft,
      trackId,
      trackUri,
      mode: compatMode,
      updatedAt: Date.now(),
    },
  };
  return JSON.stringify(payload, null, 2);
}

// Exported functions
exports.extractTrackId = extractTrackId;
exports.normalizeTrackUri = normalizeTrackUri;
exports.isValidSyncRecord = isValidSyncRecord;
exports.getCustomSync = getCustomSync;
exports.hasCustomSync = hasCustomSync;
exports.listCustomSyncs = listCustomSyncs;
exports.saveCustomSync = saveCustomSync;
exports.deleteCustomSync = deleteCustomSync;
exports.splitTextIntoTokens = splitTextIntoTokens;
exports.createLyricDraftLine = createLyricDraftLine;
exports.createInterludeDraftLine = createInterludeDraftLine;
exports.createBackgroundDraftEntry = createBackgroundDraftEntry;
exports.parsePlainTextToDraftLines = parsePlainTextToDraftLines;
exports.serializeDraftLinesToText = serializeDraftLinesToText;
exports.isDraftLineComplete = isDraftLineComplete;
exports.compileDraftToSpicyLyrics = compileDraftToSpicyLyrics;
exports.spicyLyricsToFullscreenLines = spicyLyricsToFullscreenLines;
exports.fullscreenLinesToDraft = fullscreenLinesToDraft;
exports.importFileToDraft = importFileToDraft;
exports.exportDraftAsTTML = exportDraftAsTTML;
exports.exportDraftAsLRC = exportDraftAsLRC;
exports.exportDraftAsJSON = exportDraftAsJSON;

    },

    "./services/LyricsService.js": function(require, exports, module) {
// --- ./services/LyricsService.js ---
/**
 * Lyrics orchestration service.
 * Manages provider priority chain (Local Custom Sync -> Apple Music -> Spicy Lyrics -> LRCLIB -> Spotify -> Genius)
 * and resolves lyrics for the active track.
 */
const {  SpotifyLyricsProvider  } = require("./services/providers/SpotifyLyricsProvider.js");
const {  LrclibLyricsProvider  } = require("./services/providers/LrclibLyricsProvider.js");
const {  GeniusLyricsProvider  } = require("./services/providers/GeniusLyricsProvider.js");
const {  AppleMusicLyricsProvider  } = require("./services/providers/AppleMusicLyricsProvider.js");
const {  SpicyLyricsProvider  } = require("./services/providers/SpicyLyricsProvider.js");
const {  getCustomSync, spicyLyricsToFullscreenLines  } = require("./services/CustomSyncStorage.js");
const {  Settings  } = require("./utils/settings.js");

const _lyricsCache = new Map();
const _inflight = new Map();

const LyricsService = exports.LyricsService = {
  providers: {
    applemusic: new AppleMusicLyricsProvider(),
    spicy: new SpicyLyricsProvider(),
    lrclib: new LrclibLyricsProvider(),
    genius: new GeniusLyricsProvider(),
    spotify: new SpotifyLyricsProvider(),
  },

  getOrderedProviders() {
    const pref = Settings.get("lyricsProvider") || "auto";

    if (pref === "applemusic") return [this.providers.applemusic];
    if (pref === "spicy") return [this.providers.spicy];
    if (pref === "lrclib") return [this.providers.lrclib];
    if (pref === "genius") return [this.providers.genius];
    if (pref === "spotify") return [this.providers.spotify];

    // Priority chain for "auto": Apple Music -> Spicy Lyrics -> LRCLIB -> Genius -> Spotify
    return [
      this.providers.applemusic,
      this.providers.spicy,
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

    // 0. Always check Local Custom Sync (FullLyrics Creator / Liquid Lyrics localStorage) first!
    const customSync = getCustomSync(track);
    if (customSync && customSync.lyrics) {
      const localRes = spicyLyricsToFullscreenLines(customSync.lyrics, "FullLyrics Local");
      if (localRes && localRes.lines?.length) {
        return localRes;
      }
    }

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

  /**
   * Resolves lyrics strictly from online providers (ignoring local custom sync),
   * used by FullLyrics Creator's "Load from Online Provider" action.
   */
  async resolveOnlineOnly(track) {
    if (!track) return { type: "none", lines: [] };
    const trackKey = "online:" + (track.uri || (track.name + "_" + (track.artists?.[0]?.name || "")));
    return this._resolveInternal(track, trackKey);
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

      // 2. Spicy Lyrics (Syllable / Word-synced & Line-synced)
      try {
        const spicyRes = await this.providers.spicy.fetch(track);
        if (spicyRes && spicyRes.lines?.length) {
          if (spicyRes.type === "synced" || spicyRes.type === "word-synced") {
            this._cacheResult(trackKey, spicyRes);
            return spicyRes;
          }
          if (!unsyncedCandidate) unsyncedCandidate = spicyRes;
        }
      } catch (_) {}

      // 3. LRCLIB & Spotify (start Spotify in background so there is zero wait if LRCLIB misses)
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
          var spotifyUnsynced = spRes;
        }
      } catch (_) {}

      // 4. Genius (unsynced lyrics — higher priority than Spotify unsynced)
      if (!unsyncedCandidate) {
        try {
          const genRes = await this.providers.genius.fetch(track);
          if (genRes && genRes.lines?.length) {
            unsyncedCandidate = genRes;
          }
        } catch (_) {}
      }

      // 5. Fallback to unsynced candidate or Spotify unsynced
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
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");
const {  parseTTML  } = require("./utils/parsers.js");

function normText(s) {
  return String(s || "")
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

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
    if (SpotiKitBridge.isStopped() || !AppleMusicAuth.isConnected()) return null;

    const devToken = await AppleMusicAuth.getDeveloperToken();
    if (!devToken || SpotiKitBridge.isStopped()) return null;

    const songId = await this.findSongId(devToken, targetTitle, artist, durationMs);
    if (!songId || SpotiKitBridge.isStopped()) return null;

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
      res = await fetch(
        `https://amp-api.music.apple.com/v1/catalog/${AppleMusicAuth.storefront}/songs/${songId}/lyrics`,
        { headers, signal: SpotiKitBridge.createTimeoutSignal(1800) }
      ).then((r) => (r.ok ? r.json() : null));
    } catch (e) {
      return null;
    }

    const ttml = res && res.data && res.data[0] && res.data[0].attributes && res.data[0].attributes.ttml;
    if (!ttml) return null;

    const lines = parseTTML(ttml);
    if (!lines.length) return null;

    const wordSynced = lines.some((l) => l.isWordSynced);
    const lineSynced = lines.some((l) => l.hasLineTime);
    return {
      type: wordSynced ? "word-synced" : lineSynced ? "synced" : "unsynced",
      source: "Apple Music",
      lines,
    };
  }

  async _fetchPublicTTML(title, artist, durationSec = 0) {
    try {
      let results = await this._queryBinimum(title, artist);
      if (!results.length && !SpotiKitBridge.isStopped() && title.includes(" - ")) {
        const shortTitle = title.split(" - ")[0].trim();
        if (shortTitle) results = await this._queryBinimum(shortTitle, artist);
      }
      if (!results.length || SpotiKitBridge.isStopped()) return null;

      const normArtist = normText(artist);
      const normTitle = normText(title);

      // Filter by artist or title match (keep all timing_types including 'none' so unsynced Apple Music tracks also work)
      const valid = results.filter((item) => {
        if (!item || !item.lyricsUrl) return false;
        const itemArtist = normText(item.artist_name);
        const itemTitle = normText(item.track_name);
        const artistMatch = itemArtist.includes(normArtist) || normArtist.includes(itemArtist);
        const titleMatch = itemTitle.includes(normTitle) || normTitle.includes(itemTitle);
        return artistMatch || titleMatch;
      });

      const pool = valid.length ? valid : results.filter((item) => item?.lyricsUrl);
      if (!pool.length) return null;

      const timingRank = (t) => (t === "word" ? 2 : t === "line" ? 1 : 0);

      // Sort: strongly prefer word > line > none, and prefer close duration
      pool.sort((a, b) => {
        const rankA = timingRank(a.timing_type);
        const rankB = timingRank(b.timing_type);

        const diffA = durationSec > 0 ? Math.abs((Number(a.duration) || 0) - durationSec) : 0;
        const diffB = durationSec > 0 ? Math.abs((Number(b.duration) || 0) - durationSec) : 0;
        const closeA = diffA <= 15 ? 1 : 0;
        const closeB = diffB <= 15 ? 1 : 0;

        if (closeA !== closeB) return closeB - closeA;
        if (rankA !== rankB) return rankB - rankA;
        return diffA - diffB;
      });

      const best = pool[0];
      if (SpotiKitBridge.isStopped()) return null;
      const ttmlRes = await fetch(best.lyricsUrl, {
        signal: SpotiKitBridge.createTimeoutSignal(2400),
      });
      if (!ttmlRes.ok) return null;

      const ttmlText = await ttmlRes.text();
      if (!ttmlText || !ttmlText.includes("<p")) return null;

      const lines = parseTTML(ttmlText);
      if (!lines.length) return null;

      const wordSynced = best.timing_type === "word" && lines.some((l) => l.isWordSynced);
      const lineSynced = best.timing_type !== "none" && lines.some((l) => l.hasLineTime || l.isWordSynced);
      return {
        type: wordSynced ? "word-synced" : lineSynced ? "synced" : "unsynced",
        source: "Apple Music",
        lines,
      };
    } catch (e) {
      return null;
    }
  }

  async _queryBinimum(title, artist) {
    try {
      const params = new URLSearchParams({
        track: title,
        artist: artist,
      });
      const r = await fetch(`https://lyrics-api.binimum.org/?${params.toString()}`, {
        signal: SpotiKitBridge.createTimeoutSignal(2400),
      });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data?.results) ? data.results : [];
    } catch (e) {
      return [];
    }
  }

  async findSongId(devToken, title, artist, durationMs) {
    const term = encodeURIComponent(`${title} ${artist}`);
    let res = null;
    try {
      res = await fetch(
        `https://amp-api.music.apple.com/v1/catalog/${AppleMusicAuth.storefront}/search?term=${term}&types=songs&limit=5`,
        {
          headers: { Authorization: `Bearer ${devToken}`, Origin: "https://music.apple.com" },
          signal: SpotiKitBridge.createTimeoutSignal(1500),
        }
      ).then((r) => (r.ok ? r.json() : null));
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
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");

async function safeProxyFetch(targetUrl, timeoutMs = 1800) {
  const proxies = [
    (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  ];

  for (let i = 0; i < proxies.length; i++) {
    if (i > 0 && SpotiKitBridge.isStopped()) return null;
    try {
      const proxyUrl = proxies[i](targetUrl);
      const res = await fetch(proxyUrl, {
        signal: SpotiKitBridge.createTimeoutSignal(timeoutMs),
      });
      if (res && res.ok) {
        return res;
      }
    } catch (e) {
      // Try next proxy if not stopped
    }
    if (SpotiKitBridge.isStopped()) return null;
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
      if (SpotiKitBridge.isStopped()) return null;
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
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");
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

    if (SpotiKitBridge.isStopped()) return null;

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
      if (attempt > 0 && SpotiKitBridge.isStopped()) {
        return null;
      }
      try {
        const r = await fetch(url, { signal: SpotiKitBridge.createTimeoutSignal(2200) });

        if (r.ok) {
          return await r.json();
        }
        // Retry once on 503 Service Unavailable
        if (r.status === 503 && attempt === 0 && !SpotiKitBridge.isStopped()) {
          await new Promise((res) => setTimeout(res, 450));
          if (SpotiKitBridge.isStopped()) return null;
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

    "./services/providers/SpicyLyricsProvider.js": function(require, exports, module) {
// --- ./services/providers/SpicyLyricsProvider.js ---
/**
 * SpicyLyricsProvider
 * Fetches syllable/word-synced, line-synced, and static lyrics from api.spicylyrics.org
 * using the exact Liquid Lyrics / Spicy Lyrics protocol (`SpicyLyrics-WebAuth` + `SLObjPack` unpacker).
 */
const {  BaseLyricsProvider  } = require("./services/providers/BaseLyricsProvider.js");
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");
const {  extractTrackId, spicyLyricsToFullscreenLines  } = require("./services/CustomSyncStorage.js");

const SPICY_API_BASE = "https://api.spicylyrics.org";
const DEFAULT_SPICY_VERSION = "6.3.12";

let _cachedVersion = null;
let _versionPromise = null;

const PACK_LIMITS = {
  depth: 512,
  arrayLength: 1048576,
  objectKeys: 65536,
  streamLength: 16777216,
  valuesLength: 4194304,
  decodeOps: 4194304,
};
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isSLObjPacked(val) {
  return (
    Array.isArray(val) &&
    val.length === 2 &&
    Array.isArray(val[0]) &&
    Array.isArray(val[1])
  );
}

/**
 * Decodes Spicy Lyrics SLObjPack `[valuesList, stream]` binary-like JSON array format.
 */
function decodeSLObjPack(packed) {
  const values = packed[0];
  const stream = packed[1];
  if (values.length > PACK_LIMITS.valuesLength) {
    throw new Error("SLObjPack: valuesList exceeds limit");
  }
  if (stream.length > PACK_LIMITS.streamLength) {
    throw new Error("SLObjPack: stream exceeds limit");
  }

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) continue;
    const t = typeof v;
    if (!(t === "string" || t === "boolean") && !(t === "number" && Number.isFinite(v))) {
      throw new Error(`SLObjPack: invalid value at ${i}`);
    }
  }

  let pos = 0;
  const nextOp = () => {
    if (pos >= stream.length) throw new Error("SLObjPack: unexpected end of stream");
    return stream[pos++];
  };
  const getVal = (ptr) => {
    if (typeof ptr !== "number" || !Number.isInteger(ptr) || ptr < 0 || ptr >= values.length) {
      throw new Error(`SLObjPack: invalid value pointer ${ptr}`);
    }
    return values[ptr];
  };
  const getKey = () => {
    const k = getVal(nextOp());
    if (typeof k !== "string") throw new Error("SLObjPack: keys must be strings");
    if (FORBIDDEN_KEYS.has(k)) throw new Error(`SLObjPack: forbidden key ${k}`);
    return k;
  };
  const setProp = (obj, k, v) => {
    Object.defineProperty(obj, k, {
      value: v,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  };
  const checkCount = (cnt, max, label) => {
    if (typeof cnt !== "number" || !Number.isInteger(cnt) || cnt < 0 || cnt > max) {
      throw new Error(`SLObjPack: invalid ${label} count ${cnt}`);
    }
    return cnt;
  };
  const checkRemaining = (needed, label) => {
    if (needed > stream.length - pos) {
      throw new Error(`SLObjPack: ${label} exceeds remaining stream`);
    }
  };

  const decodeNode = (depth) => {
    if (depth > PACK_LIMITS.depth) throw new Error("SLObjPack: max depth exceeded");
    const op = nextOp();
    if (typeof op !== "number" || !Number.isInteger(op)) {
      throw new Error(`SLObjPack: invalid opcode ${op}`);
    }
    if (op >= 0) return getVal(op);

    switch (op) {
      case -1: {
        const count = checkCount(nextOp(), PACK_LIMITS.objectKeys, "object key");
        checkRemaining(count * 2, "object");
        const keys = new Array(count);
        for (let i = 0; i < count; i++) keys[i] = getKey();
        const obj = {};
        for (let i = 0; i < count; i++) setProp(obj, keys[i], decodeNode(depth + 1));
        return obj;
      }
      case -2: {
        const count = checkCount(nextOp(), PACK_LIMITS.arrayLength, "array item");
        checkRemaining(count, "array");
        const arr = new Array(count);
        for (let i = 0; i < count; i++) arr[i] = decodeNode(depth + 1);
        return arr;
      }
      case -3: {
        const rowCount = checkCount(nextOp(), PACK_LIMITS.arrayLength, "schema array item");
        const keyCount = checkCount(nextOp(), PACK_LIMITS.objectKeys, "schema key");
        if (rowCount * keyCount > PACK_LIMITS.decodeOps) {
          throw new Error("SLObjPack: schema array budget exceeded");
        }
        checkRemaining(keyCount + rowCount * keyCount, "schema array");
        const keys = new Array(keyCount);
        for (let k = 0; k < keyCount; k++) keys[k] = getKey();
        const rows = new Array(rowCount);
        for (let r = 0; r < rowCount; r++) {
          const item = {};
          for (let k = 0; k < keyCount; k++) setProp(item, keys[k], decodeNode(depth + 1));
          rows[r] = item;
        }
        return rows;
      }
      case -4:
        return [];
      case -5:
        return [decodeNode(depth + 1)];
      case -6:
        return {};
      default:
        throw new Error(`SLObjPack: unknown opcode ${op}`);
    }
  };

  const result = decodeNode(0);
  if (pos !== stream.length) throw new Error("SLObjPack: extra data after decoding");
  return result;
}

async function getSpicyVersion() {
  if (_cachedVersion) return _cachedVersion;
  if (!_versionPromise) {
    _versionPromise = (async () => {
      try {
        const res = await fetch(`${SPICY_API_BASE}/version`, {
          signal: SpotiKitBridge.createTimeoutSignal(1800),
        });
        if (res.ok) {
          const txt = (await res.text()).trim();
          if (/^\d+\.\d+\.\d+$/.test(txt)) {
            _cachedVersion = txt;
          }
        }
      } catch (_) {}
      if (!_cachedVersion) _cachedVersion = DEFAULT_SPICY_VERSION;
    })();
  }
  await _versionPromise;
  return _cachedVersion || DEFAULT_SPICY_VERSION;
}

function convertSpicyTimesToMs(data) {
  if (!data || data.Type === "Static") return;
  const toMs = (sec) => Math.round(Number(sec || 0) * 1000);
  data.StartTime = toMs(data.StartTime);
  data.EndTime = toMs(data.EndTime);

  if (data.Type === "Syllable" && Array.isArray(data.Content)) {
    for (const item of data.Content) {
      if (item.Lead) {
        item.Lead.StartTime = toMs(item.Lead.StartTime);
        item.Lead.EndTime = toMs(item.Lead.EndTime);
        for (const s of item.Lead.Syllables || []) {
          s.StartTime = toMs(s.StartTime);
          s.EndTime = toMs(s.EndTime);
        }
      }
      if (Array.isArray(item.Background)) {
        for (const bg of item.Background) {
          bg.StartTime = toMs(bg.StartTime);
          bg.EndTime = toMs(bg.EndTime);
          for (const bs of bg.Syllables || []) {
            bs.StartTime = toMs(bs.StartTime);
            bs.EndTime = toMs(bs.EndTime);
          }
        }
      }
    }
  } else if (data.Type === "Line" && Array.isArray(data.Content)) {
    for (const item of data.Content) {
      item.StartTime = toMs(item.StartTime);
      item.EndTime = toMs(item.EndTime);
    }
  }
}

class SpicyLyricsProvider extends BaseLyricsProvider {
  async fetch(track) {
    if (!track) return null;
    const trackId = extractTrackId(track.uri || track.id || "");
    if (!trackId) return null;

    try {
      const version = await getSpicyVersion();
      const token = await SpotiKitBridge.getAccessToken();
      const authHeader = token ? `Bearer ${token}` : null;

      const res = await fetch(`${SPICY_API_BASE}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "SpicyLyrics-Version": version,
          "X-mode": "2",
          ...(authHeader ? { "SpicyLyrics-WebAuth": authHeader } : {}),
        },
        body: JSON.stringify({
          queries: [
            {
              operation: "lyrics",
              variables: {
                id: trackId,
                auth: "SpicyLyrics-WebAuth",
              },
            },
          ],
          client: { version },
        }),
        signal: SpotiKitBridge.createTimeoutSignal(3200),
      });

      if (!res.ok) return null;
      const body = await res.json();
      const queries = Array.isArray(body?.queries) ? body.queries.flat() : [];
      const job =
        queries.find((q) => q?.operation === "lyrics" && Boolean(q?.result)) ||
        queries.find((q) => Boolean(q?.result));
      if (!job?.result) return null;

      const rawResult = job.result;
      const httpStatus = rawResult.httpStatus;
      let payload = rawResult.data ?? rawResult;

      if (httpStatus && httpStatus !== 200) return null;
      if (payload && typeof payload === "object" && typeof payload.error === "string") {
        return null;
      }

      if (isSLObjPacked(payload)) {
        payload = decodeSLObjPack(payload);
      }

      if (
        !payload ||
        typeof payload !== "object" ||
        !(payload.Type === "Syllable" || payload.Type === "Line" || payload.Type === "Static")
      ) {
        return null;
      }

      payload.Provider = "spicy";
      convertSpicyTimesToMs(payload);

      return spicyLyricsToFullscreenLines(payload, "Spicy Lyrics");
    } catch (_) {
      return null;
    }
  }
}

// Exported functions
exports.decodeSLObjPack = decodeSLObjPack;

// Exported classes
exports.SpicyLyricsProvider = SpicyLyricsProvider;

    },

    "./services/providers/SpotifyLyricsProvider.js": function(require, exports, module) {
// --- ./services/providers/SpotifyLyricsProvider.js ---
/**
 * Spotify native lyrics provider.
 * Updated for Spotify 1.3.6: supports both SpotiKit.Http.get and native fetch with session token.
 */
const {  BaseLyricsProvider  } = require("./services/providers/BaseLyricsProvider.js");
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");
const {  splitParentheticalBg  } = require("./utils/parsers.js");

class SpotifyLyricsProvider extends BaseLyricsProvider {
  async fetch(track) {
    if (!track || !track.uri) return null;
    const parts = track.uri.split(":");
    const id = parts[2] || parts[parts.length - 1];
    if (!id) return null;

    const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`;
    let res = null;

    // Strategy 1: SpotiKit.Http.get
    if (!SpotiKitBridge.isStopped()) {
      let timer = null;
      try {
        const httpPromise = SpotiKitBridge.httpGet(url);
        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), 1500);
        });
        res = await Promise.race([httpPromise, timeoutPromise]);
        if (typeof res === "string") {
          try { res = JSON.parse(res); } catch (_) {}
        } else if (res && !res.lyrics && res.body) {
          res = typeof res.body === "string" ? JSON.parse(res.body) : res.body;
        }
      } catch (e) {
        // SpotiKit.Http.get failed or timed out, continue to Strategy 2
      } finally {
        if (timer !== null) clearTimeout(timer);
      }
    }

    // Strategy 2: Direct HTTP fetch with session access token (Spotify 1.3.6 compatible)
    if ((!res || !res.lyrics) && !SpotiKitBridge.isStopped()) {
      try {
        const token = await SpotiKitBridge.getAccessToken();
        if (token && !SpotiKitBridge.isStopped()) {
          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              "app-platform": "WebPlayer",
            },
            signal: SpotiKitBridge.createTimeoutSignal(1800),
          });
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
          _rawCleanText: text,
          words: this.splitWords(text, isSynced ? startMs : null),
        };
      })
      .filter((l) => l.words && l.words.length > 0);

    if (!rawLines.length) return null;

    if (isSynced) {
      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        const nextStart = rawLines[i + 1] ? rawLines[i + 1].startMs : line.startMs + 3600;
        if (!line.isWordSynced && line._rawCleanText) {
          const split = splitParentheticalBg(line._rawCleanText, line.startMs, nextStart);
          delete line._rawCleanText;
          line.isBgOnly = split.isBgOnly;
          line.bgVocal = split.bgVocal;
          line.words = this.splitWords(split.mainText, line.startMs);
        }
      }
    }

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

    "./services/SpotiKitBridge.js": function(require, exports, module) {
// --- ./services/SpotiKitBridge.js ---
/**
 * Bridge layer for interacting with SpotiKit and Spotify Desktop.
 * Provides safe wrappers, lifecycle signals, token resolution, queue normalization, and event management.
 */

const PLAYER_EVENT_MAP = {
  songchange: "track",
  playpause: "playpause",
  progress: "progress",
  state: "state",
};

function _normalizeQueueEntry(entry) {
  if (!entry) return null;
  if (entry.metadata || entry.contextTrack?.metadata) {
    return entry;
  }

  const title = entry.title || entry.name || "";
  const artistName =
    typeof entry.artist === "string"
      ? entry.artist
      : entry.artist?.name || (Array.isArray(entry.artists) ? entry.artists[0]?.name || "" : "");
  const albumName =
    typeof entry.album === "string"
      ? entry.album
      : entry.album?.name || "";
  const imageUrl = entry.image || entry.album?.images?.[0]?.url || "";

  return {
    uri: entry.uri || "",
    ...(entry.uid !== undefined ? { uid: entry.uid } : {}),
    name: title,
    metadata: {
      title,
      artist_name: artistName,
      album_title: albumName,
      image_xlarge_url: imageUrl,
    },
    artists: artistName ? [{ name: artistName }] : [],
    album: {
      name: albumName,
      images: imageUrl ? [{ url: imageUrl }] : [],
    },
  };
}

const SpotiKitBridge = exports.SpotiKitBridge = {
  _ctx: null,

  /**
   * Stores the SpotiKit extension context for lifecycle signals.
   */
  init(ctx) {
    this._ctx = ctx || null;
    return this._ctx;
  },

  getSignal() {
    return this._ctx?.signal || null;
  },

  isStopped() {
    return Boolean(this._ctx?.signal?.aborted);
  },

  /**
   * Creates an AbortSignal that aborts after `ms` milliseconds OR when `ctx.signal` aborts.
   * Cleans up timers and parent listeners once aborted.
   */
  createTimeoutSignal(ms) {
    const controller = new AbortController();
    const parentSignal = this.getSignal();

    if (parentSignal?.aborted) {
      controller.abort(parentSignal.reason);
      return controller.signal;
    }

    let timer = null;
    let onParentAbort = null;

    const cleanup = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (parentSignal && onParentAbort) {
        parentSignal.removeEventListener("abort", onParentAbort);
        onParentAbort = null;
      }
    };

    if (parentSignal) {
      onParentAbort = () => {
        cleanup();
        if (!controller.signal.aborted) {
          controller.abort(parentSignal.reason);
        }
      };
      parentSignal.addEventListener("abort", onParentAbort, { once: true });
    }

    if (typeof ms === "number" && Number.isFinite(ms) && ms >= 0) {
      timer = setTimeout(() => {
        cleanup();
        if (!controller.signal.aborted) {
          const reason =
            typeof DOMException !== "undefined"
              ? new DOMException("The operation was aborted due to timeout", "TimeoutError")
              : new Error("TimeoutError");
          controller.abort(reason);
        }
      }, ms);
    }

    controller.signal.addEventListener("abort", cleanup, { once: true });
    return controller.signal;
  },

  /**
   * Awaits SpotiKit readiness without legacy polling loops.
   */
  async waitForReady() {
    if (typeof SpotiKit === "undefined" || !SpotiKit) return null;
    try {
      if (SpotiKit.ready) {
        await SpotiKit.ready;
      }
      return SpotiKit;
    } catch (_) {
      return SpotiKit;
    }
  },

  /**
   * Retrieves Spotify session access token across Platform & Http surfaces.
   */
  async getAccessToken() {
    if (typeof SpotiKit === "undefined" || !SpotiKit) return null;

    try {
      const authApi = SpotiKit.Platform?.AuthorizationAPI;
      if (typeof authApi?.getState === "function") {
        const state = authApi.getState();
        if (
          state?.isAuthorized !== false &&
          typeof state?.token?.accessToken === "string" &&
          state.token.accessToken
        ) {
          return state.token.accessToken;
        }
      }
    } catch (_) {}

    try {
      const authApi = SpotiKit.Platform?.AuthorizationAPI;
      if (typeof authApi?.getAccessToken === "function") {
        const res = await authApi.getAccessToken();
        const token = typeof res === "string" ? res : res?.accessToken;
        if (token) return token;
      }
    } catch (_) {}

    try {
      const session = SpotiKit.Platform?.Session;
      if (typeof session?.accessToken === "string" && session.accessToken) {
        return session.accessToken;
      }
      if (typeof session?.getAccessToken === "function") {
        const res = await session.getAccessToken();
        const token = typeof res === "string" ? res : res?.accessToken;
        if (token) return token;
      }
    } catch (_) {}

    try {
      if (typeof SpotiKit.Http?.get === "function") {
        const res = await SpotiKit.Http.get("sp://oauth/v2/token");
        const parsed = typeof res === "string" ? JSON.parse(res) : res;
        const token = parsed?.accessToken || parsed?.token?.accessToken;
        if (typeof token === "string" && token) return token;
      }
    } catch (_) {}

    return null;
  },

  async httpGet(url, options) {
    if (typeof SpotiKit === "undefined" || typeof SpotiKit.Http?.get !== "function") {
      return null;
    }
    return options !== undefined
      ? SpotiKit.Http.get(url, options)
      : SpotiKit.Http.get(url);
  },

  async getAudioData(uri) {
    if (!uri || typeof SpotiKit === "undefined" || typeof SpotiKit.Audio?.analysis !== "function") {
      return null;
    }
    try {
      return await SpotiKit.Audio.analysis(uri);
    } catch (_) {
      return null;
    }
  },

  /**
   * Fetches and normalizes the next upcoming track in queue.
   */
  async getNextTrack() {
    if (typeof SpotiKit === "undefined" || !SpotiKit) return null;

    try {
      if (SpotiKit.Queue?.next?.length) {
        return _normalizeQueueEntry(SpotiKit.Queue.next[0]);
      }
    } catch (_) {}

    try {
      if (SpotiKit.Platform?.PlayerAPI?._queue?.nextTracks?.length) {
        return _normalizeQueueEntry(SpotiKit.Platform.PlayerAPI._queue.nextTracks[0]);
      }
    } catch (_) {}

    try {
      if (typeof SpotiKit.Platform?.PlayerAPI?.getQueue === "function") {
        const q = await SpotiKit.Platform.PlayerAPI.getQueue();
        if (q?.nextTracks?.length) {
          return _normalizeQueueEntry(q.nextTracks[0]);
        }
      }
    } catch (_) {}

    return null;
  },

  getCurrentTrack() {
    if (typeof SpotiKit === "undefined" || !SpotiKit.Player) return null;
    return SpotiKit.Player.track || SpotiKit.Player.state?.item || null;
  },

  getDuration() {
    return Number(typeof SpotiKit !== "undefined" ? SpotiKit.Player?.duration : 0) || 0;
  },

  getProgress() {
    return Number(typeof SpotiKit !== "undefined" ? SpotiKit.Player?.position : 0) || 0;
  },

  isPlaying() {
    return Boolean(typeof SpotiKit !== "undefined" && SpotiKit.Player?.isPlaying);
  },

  seek(ms) {
    if (typeof SpotiKit !== "undefined" && typeof SpotiKit.Player?.seek === "function") {
      SpotiKit.Player.seek(Math.max(0, Number(ms) || 0));
    }
  },

  togglePlay() {
    if (typeof SpotiKit !== "undefined") {
      SpotiKit.Player?.toggle?.();
    }
  },

  next() {
    if (typeof SpotiKit !== "undefined") {
      SpotiKit.Player?.next?.();
    }
  },

  back() {
    if (typeof SpotiKit !== "undefined") {
      SpotiKit.Player?.previous?.();
    }
  },

  toggleShuffle() {
    if (typeof SpotiKit !== "undefined" && typeof SpotiKit.Player?.setShuffle === "function") {
      SpotiKit.Player.setShuffle(!this.getShuffle());
    }
  },

  getShuffle() {
    return Boolean(typeof SpotiKit !== "undefined" && SpotiKit.Player?.shuffle);
  },

  getRepeatMode() {
    const mode = typeof SpotiKit !== "undefined" ? SpotiKit.Player?.repeat : "off";
    return mode === "context" || mode === "track" || mode === "off" ? mode : "off";
  },

  getRepeat() {
    return this.getRepeatMode() !== "off";
  },

  toggleRepeat() {
    const current = this.getRepeatMode();
    const nextMode = current === "off" ? "context" : current === "context" ? "track" : "off";
    if (typeof SpotiKit !== "undefined") {
      SpotiKit.Player?.setRepeat?.(nextMode);
    }
    return nextMode;
  },

  getVolume() {
    const v = typeof SpotiKit !== "undefined" ? SpotiKit.Player?.volume : 1;
    return typeof v === "number" && !Number.isNaN(v) ? Math.max(0, Math.min(1, v)) : 1;
  },

  setVolume(vol) {
    const n = Number(vol);
    const clamped = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
    if (typeof SpotiKit !== "undefined") {
      SpotiKit.Player?.setMuted?.(false);
      SpotiKit.Player?.setVolume?.(clamped);
    }
  },

  getMute() {
    return Boolean(typeof SpotiKit !== "undefined" && SpotiKit.Player?.muted);
  },

  toggleMute() {
    this.setMute(!this.getMute());
  },

  setMute(mute) {
    if (typeof SpotiKit !== "undefined") {
      SpotiKit.Player?.setMuted?.(Boolean(mute));
    }
  },

  addPlayerListener(event, cb) {
    const mappedEvent = PLAYER_EVENT_MAP[event] || event;
    if (typeof SpotiKit === "undefined" || typeof SpotiKit.Player?.on !== "function") {
      return () => {};
    }
    const unsub = SpotiKit.Player.on(mappedEvent, cb);
    return typeof unsub === "function"
      ? unsub
      : () => {
          if (typeof SpotiKit !== "undefined") {
            SpotiKit.Player?.off?.(mappedEvent, cb);
          }
        };
  },

  openQueue() {
    try {
      if (typeof SpotiKit !== "undefined" && typeof SpotiKit.Navigation?.go === "function") {
        SpotiKit.Navigation.go("/queue");
        return;
      }
      if (typeof SpotiKit !== "undefined" && typeof SpotiKit.Platform?.History?.push === "function") {
        SpotiKit.Platform.History.push("/queue");
        return;
      }
    } catch (_) {}

    if (typeof window !== "undefined" && window.location) {
      window.location.hash = "/queue";
    }
  },

  notify(message, options) {
    if (message === undefined || message === null || message === "") return;
    const plainText =
      typeof message === "string"
        ? message.replace(/<[^>]*>/g, "").trim()
        : String(message);
    if (!plainText) return;
    try {
      if (typeof SpotiKit !== "undefined" && typeof SpotiKit.notify === "function") {
        SpotiKit.notify(plainText, options);
      }
    } catch (_) {}
  },

  getLocale() {
    try {
      if (typeof SpotiKit !== "undefined") {
        if (typeof SpotiKit.Locale?.language === "string" && SpotiKit.Locale.language) {
          return SpotiKit.Locale.language;
        }
        const platformLocale = SpotiKit.Platform?.Translations?.getLocale?.();
        if (typeof platformLocale === "string" && platformLocale) {
          return platformLocale;
        }
      }
    } catch (_) {}

    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language;
    }
    return "en";
  },

  /**
   * Determines whether a DOM element is Spotify's native fullscreen button.
   */
  isSpotifyFullscreenButton(target) {
    if (!target || typeof target.closest !== "function") return false;
    if (typeof Element !== "undefined" && !(target instanceof Element)) return false;

    const selectors = [
      '[data-testid="fullscreen-mode-button"]',
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

    if (target.closest(selectors.join(", "))) {
      return true;
    }

    const button = target.closest("button");
    if (button) {
      const label = (button.getAttribute("aria-label") || "").toLowerCase();
      if (
        label.includes("fullscreen") ||
        label.includes("full screen") ||
        label.includes("tam ekran")
      ) {
        return true;
      }

      const extraControls = target.closest(
        '.now-playing-bar-extra-controls, .main-nowPlayingBar-extraControls, [data-testid="now-playing-bar"], .now-playing-bar'
      );
      if (
        extraControls &&
        (label.includes("screen") || label.includes("ekran") || label.includes("full"))
      ) {
        return true;
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
const {  SpotiKitBridge  } = require("./services/SpotiKitBridge.js");

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
    providerAutoSub: "Local · Apple · Spicy · LRCLIB · Spotify",
    providerApple: "Apple Music",
    providerSpicy: "Spicy Lyrics",
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
    bgVocalsDuet: "Bg Vocals & Duet View",
    customPalette: "Palette & Custom Color",
    moodAtmosphere: "Mood Atmosphere",
    moodAuto: "Auto (Song Mood)",
    moodAutoSub: "BPM · Energy · Cover Palette",
    moodEnergetic: "Energetic / Hype ⚡",
    moodMelancholic: "Melancholic / Rain 🌧️",
    moodLateNight: "Late Night / Lo-Fi 🌙",
    moodDreamy: "Dreamy / Bokeh ✨",
    moodOff: "Off",
    beatReactive: "Beat & Bass Pulse",
    beatNormal: "Normal Pulse",
    beatIntense: "Deep Bass Pulse",
    beatOff: "Off",
    // FullLyrics Creator
    creatorTitle: "FullLyrics Creator",
    creatorStepText: "1 · Text & Builder",
    creatorStepSync: "2 · Sync Studio",
    creatorStepPreview: "3 · Live Preview",
    creatorModeBlock: "Block (Line)",
    creatorModeKaraoke: "Karaoke (Word)",
    creatorModeStatic: "Static",
    creatorVisualBuilder: "Visual Line & Word Builder",
    creatorRawText: "Raw Text (Liquid Syntax)",
    creatorLoadCurrent: "Pull Active Lyrics",
    creatorImport: "Import (.json / .ttml / .lrc / .txt)",
    creatorExportJson: "Export Liquid/Spicy (.json)",
    creatorExportTtml: "Export Apple TTML (.ttml)",
    creatorExportLrc: "Export Enhanced LRC (.lrc)",
    creatorDeleteSync: "Delete Local Sync",
    creatorSavedLibrary: "Local DB Library",
    creatorSaveBtn: "Save to Local DB",
    creatorSavedBadge: "Local Sync Active",
    creatorSetCue: "Stamp Time (Space / R-Alt)",
    creatorUndoCue: "Undo (Backspace)",
    creatorShiftAll: "Shift All",
    creatorClearAllTimes: "Reset Timings",
    creatorAddSentence: "+ Add Line",
    creatorAddInterlude: "+ Interlude (• • •)",
    creatorAddWord: "+ Word",
    creatorAddBgVocal: "+ Bg Vocal",
    creatorDuetToggle: "v2 Duet",
    creatorCreditPlaceholder: "Credit (optional) — e.g. Synced by Mustafa",
    creatorTextPlaceholder:
      "Paste or type lyrics here, one line per row.\n\n• Type #interlude for an instrumental break (• • •)\n• Type [background vocal] on the line below a lyric to attach sub-vocals\n• Prefix a line with v2: for right-aligned Duet singer",
    appleConnectError: "Could not reach Apple Music, please try again.",
    appleConnected: "Apple Music connected.",
    appleConnectFailed: "Apple Music connection failed.",
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
    providerAutoSub: "Local · Apple · Spicy · LRCLIB · Spotify",
    providerApple: "Apple Music",
    providerSpicy: "Spicy Lyrics",
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
    bgVocalsDuet: "Arka Vokal & Düet Görünümü",
    customPalette: "Palet & Özel Renk",
    moodAtmosphere: "Ruh Hali Atmosferi",
    moodAuto: "Otomatik (Şarkıya Göre)",
    moodAutoSub: "BPM · Enerji · Kapak Tonu",
    moodEnergetic: "Enerjik / Hype ⚡",
    moodMelancholic: "Melankolik / Yağmur 🌧️",
    moodLateNight: "Gece / Lo-Fi 🌙",
    moodDreamy: "Rüya / Bokeh ✨",
    moodOff: "Kapalı",
    beatReactive: "Ritim & Bas Tepkisi",
    beatNormal: "Normal Tepki",
    beatIntense: "Yoğun Bas Nabzı",
    beatOff: "Kapalı",
    // FullLyrics Creator
    creatorTitle: "FullLyrics Creator",
    creatorStepText: "1 · Metin & Oluşturucu",
    creatorStepSync: "2 · Senkron Stüdyosu",
    creatorStepPreview: "3 · Canlı Önizleme",
    creatorModeBlock: "Blok (Satır)",
    creatorModeKaraoke: "Karaoke (Kelime)",
    creatorModeStatic: "Statik (Düz)",
    creatorVisualBuilder: "Görsel Cümle & Kelime Editörü",
    creatorRawText: "Toplu Metin (Liquid Söz Dizimi)",
    creatorLoadCurrent: "Aktif Sözleri Çek",
    creatorImport: "Dosya İçe Aktar (.json / .ttml / .lrc / .txt)",
    creatorExportJson: "Dışa Aktar: Liquid/Spicy (.json)",
    creatorExportTtml: "Dışa Aktar: Apple TTML (.ttml)",
    creatorExportLrc: "Dışa Aktar: Enhanced LRC (.lrc)",
    creatorDeleteSync: "Local Kaydı Sil",
    creatorSavedLibrary: "Local DB Kütüphanesi",
    creatorSaveBtn: "Local DB'ye Kaydet",
    creatorSavedBadge: "Local Kayıt Aktif",
    creatorSetCue: "Zamanla (Space / Sağ Alt)",
    creatorUndoCue: "Geri Al (Backspace)",
    creatorShiftAll: "Tümünü Kaydır",
    creatorClearAllTimes: "Zamanları Sıfırla",
    creatorAddSentence: "+ Cümle Ekle",
    creatorAddInterlude: "+ İnterlude (• • •)",
    creatorAddWord: "+ Kelime",
    creatorAddBgVocal: "+ Arka Vokal",
    creatorDuetToggle: "v2 Düet",
    creatorCreditPlaceholder: "Hazırlayan notu (isteğe bağlı) — örn. Synced by Mustafa",
    creatorTextPlaceholder:
      "Şarkı sözlerini her satıra bir cümle gelecek şekilde yazın veya yapıştırın.\n\n• Enstrümantal ara için #interlude yazın\n• Arka vokal eklemek için cümlenin hemen alt satırına [arka vokal] yazın\n• Sağ hizalı Düet şarkıcı için satır başına v2: ekleyin",
    appleConnectError: "Apple Music'e ulaşılamadı, tekrar deneyin.",
    appleConnected: "Apple Music bağlandı.",
    appleConnectFailed: "Apple Music bağlantısı başarısız oldu.",
  },
};

function t(key) {
  let lang = Settings.get("language") || "auto";
  if (lang === "auto") {
    const spLocale = SpotiKitBridge.getLocale() || "en";
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
  creator: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/><path d="m15 5 3 3"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  library: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg>`,
  wand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 4-1 1 4 4 1-1a2.83 2.83 0 1 0-4-4Z"/><path d="m13 6-8.5 8.5a2.12 2.12 0 1 0 3 3L16 9"/><path d="M18 13v5"/><path d="M15.5 15.5h5"/></svg>`,
  undo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`,
  flag: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3v18h2v-7h12l-2.5-4.5L19 5H7V3H5z"/></svg>`,
  more: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  up: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`,
  down: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  fullscreen: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
};

    },

    "./utils/parsers.js": function(require, exports, module) {
// --- ./utils/parsers.js ---
/**
 * Parsers for synchronized lyrics formats (TTML, Enhanced LRC, and standard LRC).
 * - Preserves true word/syllable timestamps.
 * - Extracts Apple Music Background Vocals (`ttm:role="x-bg"` and parenthetical ad-libs)
 *   and Duet singer alignment (`ttm:agent="v2"` / `v2:`).
 */

function isBgSpan(span, stopNode) {
  let curr = span;
  while (curr && curr !== stopNode) {
    const role = curr.getAttribute?.("ttm:role") || curr.getAttribute?.("role") || "";
    if (role === "x-bg") return true;
    curr = curr.parentElement || curr.parentNode;
  }
  return false;
}

function isIgnoredRole(span, stopNode) {
  let curr = span;
  while (curr && curr !== stopNode) {
    const role = curr.getAttribute?.("ttm:role") || curr.getAttribute?.("role") || "";
    if (role === "x-translation" || role === "x-roman") return true;
    curr = curr.parentElement || curr.parentNode;
  }
  return false;
}

function extractWordsFromSpans(spans, fallbackStartMs, fallbackEndMs) {
  const words = [];
  let currentWord = null;

  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    const rawText = s.textContent || "";
    const trimmed = rawText.trim();
    if (!trimmed.length) continue;

    const wStart = parseTTMLTime(s.getAttribute("begin"));
    const wEnd = parseTTMLTime(s.getAttribute("end"));

    let hasTrailingSpace = /\s$/.test(rawText);
    if (!hasTrailingSpace && s.nextSibling) {
      if (s.nextSibling.nodeType === 3 && /\s/.test(s.nextSibling.nodeValue || "")) {
        hasTrailingSpace = true;
      }
    }
    if (i === spans.length - 1) {
      hasTrailingSpace = true;
    }

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
      const isLast = i === spans.length - 1;
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
    const startMs = fallbackStartMs != null ? fallbackStartMs : words[0].startMs || 0;
    const endMs = fallbackEndMs != null ? fallbackEndMs : words[words.length - 1].endMs || startMs + 3000;

    for (let k = 0; k < words.length; k++) {
      if (words[k].startMs == null) {
        words[k].startMs = k === 0 ? startMs : words[k - 1].endMs || startMs;
      }
      if (words[k].endMs == null || words[k].endMs <= words[k].startMs) {
        words[k].endMs = words[k + 1]?.startMs || endMs;
      }
    }
  }

  return { words, hasValidWordTimes };
}

/**
 * Splits trailing parenthetical background vocals from a line-synced text string:
 * e.g. "Neden ağlattın? (neden, neden)" -> main: "Neden ağlattın?", bg: "(neden, neden)"
 * Also detects standalone parenthetical lines like "(Yeah, ooh)".
 */
function splitParentheticalBg(rawText, startMs = 0, endMs = 3000) {
  const trimmed = String(rawText || "").trim();
  if (!trimmed) return { mainText: "", bgVocal: null, isBgOnly: false };

  // Case 1: Entire line is inside parentheses "(...)" with no outside text
  if (/^\([^()]+\)$/.test(trimmed) && trimmed.length >= 4) {
    return { mainText: trimmed, bgVocal: null, isBgOnly: true };
  }

  // Case 2: Main lyric followed by a trailing parenthetical vocal at the end: "Main lyric (bg vocal)"
  const m = trimmed.match(/^(.*?[^\s(])\s+(\([^()]{2,65}\))$/);
  if (m) {
    const mainText = m[1].trim();
    const bgText = m[2].trim();
    if (mainText.length >= 2 && bgText.length >= 3) {
      const dur = Math.max(800, (endMs || startMs + 3000) - startMs);
      const bgStart = startMs + Math.round(dur * 0.42);
      const bgEnd = startMs + Math.round(dur * 0.98);
      const bgParts = bgText.split(/\s+/).filter(Boolean);
      return {
        mainText,
        isBgOnly: false,
        bgVocal: {
          text: bgText,
          startMs: bgStart,
          endMs: bgEnd,
          isWordSynced: false,
          words: bgParts.map((w, idx) => ({
            text: idx < bgParts.length - 1 ? w + " " : w,
            startMs: bgStart,
            endMs: bgEnd,
          })),
        },
      };
    }
  }

  return { mainText: trimmed, bgVocal: null, isBgOnly: false };
}

function parseTTML(ttmlString) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(ttmlString, "application/xml");
  } catch (e) {
    return [];
  }

  const ttEl = doc.documentElement;
  const rootTiming = (
    ttEl?.getAttribute("lrc:timing") ||
    ttEl?.getAttribute("itunes:timing") ||
    ""
  ).toLowerCase();

  const paragraphs = Array.from(doc.getElementsByTagName("p"));
  const lines = [];
  let primaryAgent = null;

  for (const p of paragraphs) {
    const agent = (p.getAttribute("ttm:agent") || p.getAttribute("agent") || "").trim();
    if (agent && !primaryAgent) {
      primaryAgent = agent;
    }
    const isDuet = Boolean(agent && primaryAgent && agent !== primaryAgent);
    const pRole = p.getAttribute("ttm:role") || p.getAttribute("role") || "";

    // Collect only leaf spans (spans that do not wrap nested child spans)
    // so container <span ttm:role="x-bg"> elements are not duplicated alongside their children
    const rawSpans = Array.from(p.getElementsByTagName("span")).filter(
      (s) => !isIgnoredRole(s, p)
    );
    const leafSpans = rawSpans.filter((s) => {
      const childSpans = Array.from(s.getElementsByTagName("span")).filter(
        (cs) => !isIgnoredRole(cs, p)
      );
      return childSpans.length === 0;
    });

    const lineStart = parseTTMLTime(p.getAttribute("begin"));
    const lineEnd = parseTTMLTime(p.getAttribute("end"));

    if (leafSpans.length && rootTiming !== "line") {
      const mainSpans = [];
      const bgSpans = [];

      for (const s of leafSpans) {
        if (pRole === "x-bg" || isBgSpan(s, p)) {
          bgSpans.push(s);
        } else {
          mainSpans.push(s);
        }
      }

      const mainRes = extractWordsFromSpans(mainSpans, lineStart, lineEnd);
      const bgRes = extractWordsFromSpans(bgSpans, null, lineEnd);

      let bgVocal = null;
      if (bgRes.words.length > 0) {
        const bgStartMs = bgRes.words[0].startMs ?? lineStart ?? 0;
        const bgEndMs =
          bgRes.words[bgRes.words.length - 1].endMs ?? lineEnd ?? bgStartMs + 2200;
        bgVocal = {
          text: bgRes.words.map((w) => w.text).join("").trim(),
          startMs: bgStartMs,
          endMs: bgEndMs,
          isWordSynced: bgRes.hasValidWordTimes,
          words: bgRes.words,
        };
      }

      if (mainRes.words.length && mainRes.hasValidWordTimes) {
        const startMs = lineStart != null ? lineStart : mainRes.words[0].startMs || 0;
        const endMs =
          lineEnd != null
            ? lineEnd
            : mainRes.words[mainRes.words.length - 1].endMs || startMs + 3000;

        lines.push({
          startMs,
          endMs,
          hasLineTime: true,
          isWordSynced: true,
          isDuet,
          isBgOnly: false,
          words: mainRes.words,
          bgVocal,
        });
        continue;
      } else if (!mainRes.words.length && bgVocal && bgRes.hasValidWordTimes) {
        // Standalone background vocal paragraph
        lines.push({
          startMs: bgVocal.startMs,
          endMs: bgVocal.endMs,
          hasLineTime: true,
          isWordSynced: true,
          isDuet,
          isBgOnly: true,
          words: bgVocal.words,
          bgVocal: null,
        });
        continue;
      }
    }

    // Fallback: line-synced or unsynced <p>
    let mainText = "";
    let bgTextFromSpan = "";

    // Check if there is a direct <span ttm:role="x-bg"> inside a line-timed <p>
    const bgContainers = Array.from(p.getElementsByTagName("span")).filter(
      (s) => (s.getAttribute("ttm:role") || s.getAttribute("role")) === "x-bg"
    );
    if (bgContainers.length > 0) {
      bgTextFromSpan = bgContainers.map((b) => (b.textContent || "").trim()).join(" ").trim();
      const clone = p.cloneNode(true);
      Array.from(clone.getElementsByTagName("span")).forEach((s) => {
        const r = s.getAttribute("ttm:role") || s.getAttribute("role") || "";
        if (r === "x-bg" || r === "x-translation" || r === "x-roman") {
          s.parentNode?.removeChild(s);
        }
      });
      mainText = (clone.textContent || "").trim();
    } else {
      mainText = (p.textContent || "").trim();
    }

    if (mainText.length || bgTextFromSpan.length) {
      const hasLineTime = lineStart != null;
      const startMs = lineStart || 0;
      const endMs = lineEnd || startMs + 3500;

      let bgVocal = null;
      let isBgOnly = pRole === "x-bg";

      if (bgTextFromSpan && mainText) {
        const bgStart = startMs + Math.round((endMs - startMs) * 0.4);
        const bgParts = bgTextFromSpan.split(/\s+/).filter(Boolean);
        bgVocal = {
          text: bgTextFromSpan,
          startMs: bgStart,
          endMs,
          isWordSynced: false,
          words: bgParts.map((w, idx) => ({
            text: idx < bgParts.length - 1 ? w + " " : w,
            startMs: bgStart,
            endMs,
          })),
        };
      } else if (!mainText && bgTextFromSpan) {
        mainText = bgTextFromSpan;
        isBgOnly = true;
      } else if (hasLineTime) {
        const split = splitParentheticalBg(mainText, startMs, endMs);
        mainText = split.mainText;
        bgVocal = split.bgVocal;
        if (split.isBgOnly) isBgOnly = true;
      }

      const parts = mainText.split(/\s+/).filter(Boolean);
      if (parts.length) {
        lines.push({
          startMs,
          endMs,
          hasLineTime,
          isWordSynced: false,
          isDuet,
          isBgOnly,
          bgVocal,
          words: parts.map((w, idx) => ({
            text: idx < parts.length - 1 ? w + " " : w,
            startMs: hasLineTime ? startMs : null,
            endMs: hasLineTime ? endMs : null,
          })),
        });
      }
    }
  }

  const hasAnyTime = lines.some((l) => l.hasLineTime || l.isWordSynced);
  return hasAnyTime ? lines.sort((a, b) => a.startMs - b.startMs) : lines;
}

function parseTTMLTime(value) {
  if (!value) return null;
  const str = String(value).trim();

  let m = str.match(/^(\d+(?:\.\d+)?)s?$/);
  if (m) return Math.round(parseFloat(m[1]) * 1000);

  m = str.match(/^(\d+):(\d\d):(\d\d)[.:](\d+)$/);
  if (m) {
    const [, h, mi, s, frac] = m;
    const ms = frac.length === 2 ? Number(frac) * 10 : Number(frac.slice(0, 3).padEnd(3, "0"));
    return (Number(h) * 3600 + Number(mi) * 60 + Number(s)) * 1000 + ms;
  }

  m = str.match(/^(\d+):(\d\d)[.:](\d+)$/);
  if (m) {
    const [, mi, s, frac] = m;
    const ms = frac.length === 2 ? Number(frac) * 10 : Number(frac.slice(0, 3).padEnd(3, "0"));
    return (Number(mi) * 60 + Number(s)) * 1000 + ms;
  }

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

    let content = rawContent.replace(/^\s*(\[\d+:\d+(?:\.\d+)?\])+/, "").trim();
    if (!content.length) continue;

    // Detect optional duet singer markers like "v2:" or "[v2]"
    let isDuet = false;
    if (/^(?:\[?v2\]?\s*:?\s+)/i.test(content)) {
      isDuet = true;
      content = content.replace(/^(?:\[?v2\]?\s*:?\s+)/i, "").trim();
    } else if (/^(?:\[?v1\]?\s*:?\s+)/i.test(content)) {
      content = content.replace(/^(?:\[?v1\]?\s*:?\s+)/i, "").trim();
    }

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
          isDuet,
          isBgOnly: false,
          words,
        });
        continue;
      }
    }

    const cleanText = content.replace(/<[^>]+>/g, "").trim();
    if (!cleanText.length) continue;

    lines.push({
      startMs,
      isWordSynced: false,
      isDuet,
      _rawCleanText: cleanText,
      words: [],
    });
  }

  const sorted = lines.sort((a, b) => a.startMs - b.startMs);
  for (let i = 0; i < sorted.length; i++) {
    const line = sorted[i];
    if (!line.endMs) {
      line.endMs = sorted[i + 1] ? sorted[i + 1].startMs : line.startMs + 4000;
    }
    if (!line.isWordSynced && line._rawCleanText) {
      const split = splitParentheticalBg(line._rawCleanText, line.startMs, line.endMs);
      delete line._rawCleanText;
      line.isBgOnly = split.isBgOnly;
      line.bgVocal = split.bgVocal;
      const parts = split.mainText.split(/\s+/).filter(Boolean);
      line.words = parts.map((w, idx) => ({
        text: idx < parts.length - 1 ? w + " " : w,
        startMs: line.startMs,
        endMs: line.endMs,
      }));
    }
  }
  return sorted;
}

// Exported functions
exports.splitParentheticalBg = splitParentheticalBg;
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
  SETTINGS_KEY: "settings",
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
    bgVocalsDuet: true,
    moodMode: "auto", // auto | energetic | melancholic | latenight | dreamy | off
    beatReactive: "normal", // normal | intense | off
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

  _getScope() {
    return typeof SpotiKit !== "undefined" ? SpotiKit.Storage?.scope?.("fullscreen-reloaded") || null : null;
  },

  load() {
    let stored = null;
    let migratedFromLocalStorage = false;
    const scope = this._getScope();
    try {
      const scopeValue = scope && typeof scope.get === "function" ? scope.get(this.SETTINGS_KEY, null) : null;
      if (scopeValue !== null && scopeValue !== undefined) {
        const parsed = typeof scopeValue === "string" ? JSON.parse(scopeValue) : scopeValue;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          stored = parsed;
        }
      } else if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(this.KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            stored = parsed;
            if (scope) migratedFromLocalStorage = true;
          }
        }
      }
    } catch (e) {
      /* ignore corrupt settings */
    }
    this.data = Object.assign({}, this.defaults, stored || {});
    let needsSave = migratedFromLocalStorage;
    if (!this.data._migratedIdleLyricsV2) {
      this.data.idleLyrics = true;
      this.data.showLyrics = true;
      this.data._migratedIdleLyricsV2 = true;
      needsSave = true;
    }
    if (needsSave) {
      this.save();
    }
  },

  save() {
    try {
      const scope = this._getScope();
      if (scope && typeof scope.set === "function") {
        scope.set(this.SETTINGS_KEY, { ...this.data });
        return;
      }
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(this.KEY, JSON.stringify(this.data));
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

  return __require;
}

export default async function start(context) {
  const __require = __createRuntime();
  const entry = __require("./index.js");
  const fn = entry && entry.default ? entry.default : entry;
  return typeof fn === "function" ? await fn(context) : undefined;
}
