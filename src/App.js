/**
 * Main application coordinator for Fullscreen Reloaded.
 */
import { el } from "./utils/dom.js";
import { resolveImageUrl, rgb, rgba } from "./utils/formatters.js";
import { t } from "./utils/i18n.js";
import { Settings } from "./utils/settings.js";
import { SpicetifyBridge } from "./services/SpicetifyBridge.js";
import { BackgroundManager } from "./components/BackgroundManager.js";
import { AmbientManager } from "./components/AmbientManager.js";
import { Clock } from "./components/Clock.js";
import { UpNextCard } from "./components/UpNextCard.js";
import { SettingsModal } from "./components/SettingsModal.js";
import { TopBar } from "./components/TopBar.js";
import { BottomDock } from "./components/BottomDock.js";
import { LyricsView } from "./components/LyricsView.js";
import { LyricsService } from "./services/LyricsService.js";

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
