/**
 * Main application coordinator for Fullscreen Reloaded.
 */
import { el } from "./utils/dom.js";
import { resolveImageUrl, rgb, rgba } from "./utils/formatters.js";
import { Icons } from "./utils/icons.js";
import { t } from "./utils/i18n.js";
import { Settings } from "./utils/settings.js";
import { SpotiKitBridge } from "./services/SpotiKitBridge.js";
import { BackgroundManager } from "./components/BackgroundManager.js";
import { AmbientManager } from "./components/AmbientManager.js";
import { Clock } from "./components/Clock.js";
import { UpNextCard } from "./components/UpNextCard.js";
import { SettingsModal } from "./components/SettingsModal.js";
import { TopBar } from "./components/TopBar.js";
import { BottomDock } from "./components/BottomDock.js";
import { LyricsView } from "./components/LyricsView.js";
import { FullLyricsCreator } from "./components/FullLyricsCreator.js";
import { destroyCustomSelects } from "./components/CustomSelect.js";
import { destroyCustomColorPickers } from "./components/CustomColorPicker.js";
import { LyricsService } from "./services/LyricsService.js";
import { AudioMoodEngine } from "./services/AudioMoodEngine.js";

export const App = {
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
