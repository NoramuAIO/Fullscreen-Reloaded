// ==========================================================================
// Fullscreen Reloaded
// A cinematic, modern fullscreen replacement for Spicetify.
//
// Install:
//   1. Copy this file to your Spicetify Extensions folder
//      (find it with `spicetify config-dir`, then go into /Extensions).
//   2. spicetify config extensions fullscreen-reloaded.js
//   3. spicetify apply
//
// Usage:
//   F      -> open Fullscreen Reloaded
//   ESC    -> close it
//   (gear icon inside the overlay opens the settings panel)
//
// Design notes:
//   Spotify's internal DOM is not a public API and changes between
//   versions, so this extension avoids reading/writing Spotify's own
//   markup wherever possible. It talks only to the documented
//   Spicetify.Player / Spicetify.Platform / Spicetify.CosmosAsync
//   surfaces, and renders its own independent overlay layer that is
//   appended directly to <body>. When Spotify's fullscreen opens, it
//   hides the rest of the app behind an opaque layer instead of trying
//   to remove/restyle Spotify's own elements, so it keeps working even
//   if Spotify's internal class names change.
// ==========================================================================

(function FullscreenReloaded() {
  "use strict";

  // ------------------------------------------------------------------
  // 0. Bootstrap: wait for the Spicetify APIs we depend on
  // ------------------------------------------------------------------
  const REQUIRED = ["Player", "Platform", "CosmosAsync", "Keyboard", "URI"];

  function waitForSpicetify() {
    if (
      typeof Spicetify !== "undefined" &&
      REQUIRED.every((k) => typeof Spicetify[k] !== "undefined")
    ) {
      init();
      return;
    }
    setTimeout(waitForSpicetify, 50);
  }
  waitForSpicetify();

  function init() {
    Settings.load();
    Styles.inject();
    App.mount();
    IdleTracker.register();
    Hotkeys.register();
    console.log("[Fullscreen Reloaded] ready");
  }

  // ------------------------------------------------------------------
  // 1. Settings (persisted via Spicetify.LocalStorage, with fallback)
  // ------------------------------------------------------------------
  const Settings = {
    KEY: "fullscreen-reloaded:settings",
    defaults: {
      backgroundMode: "dynamic-gradient", // solid | gradient | dynamic-gradient | blurred-artwork | artwork | darkened-artwork | custom-color
      customColor: "#101014",
      showLyrics: true,
      albumArtSize: "large", // small | medium | large
      albumArtRadius: 18,
      albumArtShadow: true,
      albumArtGlow: true,
      transitionMs: 900,
      appleMusicUserToken: null,
    },
    data: {},
    load() {
      let stored = null;
      try {
        const raw =
          (Spicetify.LocalStorage && Spicetify.LocalStorage.get(this.KEY)) ||
          window.localStorage.getItem(this.KEY);
        if (raw) stored = JSON.parse(raw);
      } catch (e) {
        /* ignore corrupt settings */
      }
      this.data = Object.assign({}, this.defaults, stored || {});
    },
    save() {
      const raw = JSON.stringify(this.data);
      try {
        if (Spicetify.LocalStorage) Spicetify.LocalStorage.set(this.KEY, raw);
        else window.localStorage.setItem(this.KEY, raw);
      } catch (e) {
        /* storage unavailable, settings just won't persist */
      }
    },
    set(key, value) {
      this.data[key] = value;
      this.save();
      App.onSettingsChanged(key, value);
    },
    get(key) {
      return this.data[key];
    },
  };

  // ------------------------------------------------------------------
  // 2. Stylesheet (design tokens + component styles)
  // ------------------------------------------------------------------
  const Styles = {
    id: "fullscreen-reloaded-styles",
    inject() {
      if (document.getElementById(this.id)) return;
      const style = document.createElement("style");
      style.id = this.id;
      style.textContent = CSS;
      document.head.appendChild(style);
    },
  };

  const CSS = `
  :root {
    --fr-bg: #060607;
    --fr-fg: #f5f5f2;
    --fr-fg-dim: rgba(245, 245, 242, 0.62);
    --fr-fg-faint: rgba(245, 245, 242, 0.34);
    --fr-accent: #d8d8d6;
    --fr-accent-2: #101014;
    --fr-radius: 18px;
    --fr-font: "Spotify Circular", "Circular Std", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    --fr-transition: 900ms;
  }

  #fullscreen-reloaded-root {
    position: fixed;
    inset: 0;
    z-index: 999999;
    font-family: var(--fr-font);
    color: var(--fr-fg);
    visibility: hidden;
    opacity: 0;
    transition: opacity 600ms cubic-bezier(0.2, 0.8, 0.2, 1), visibility 600ms;
    overflow: hidden;
    user-select: none;
  }
  #fullscreen-reloaded-root.fr-open { visibility: visible; opacity: 1; }
  #fullscreen-reloaded-root * { box-sizing: border-box; }

  /* ---------------- Background ---------------- */
  .fr-bg-layer {
    position: absolute;
    inset: -5%;
    width: 110%;
    height: 110%;
    background-position: center;
    background-size: cover;
    opacity: 0;
    transition: opacity var(--fr-transition) ease;
    will-change: opacity;
  }
  .fr-bg-layer.fr-bg-active { opacity: 1; }
  .fr-bg-tint {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 30% 20%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 75%);
    pointer-events: none;
  }
  .fr-bg-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.55) 100%);
    pointer-events: none;
  }

  /* ---------------- Layout ---------------- */
  .fr-stage {
    position: relative;
    z-index: 2;
    height: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    grid-template-rows: 1fr;
    grid-template-areas: "art lyrics";
    padding: clamp(24px, 3.2vw, 64px);
    padding-bottom: clamp(100px, 14vh, 160px);
    gap: clamp(16px, 2vw, 40px);
    opacity: 0;
    transform: translateY(24px) scale(0.98);
    transition: grid-template-columns 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), gap 0.8s, opacity 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms, transform 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 150ms;
  }
  #fullscreen-reloaded-root.fr-open .fr-stage { opacity: 1; transform: translateY(0) scale(1); }
  .fr-stage.fr-centered {
    grid-template-columns: 1fr;
    grid-template-areas: "art";
  }
  .fr-stage.fr-centered .fr-lyrics-panel { display: none; }

  /* ---------------- Album art ---------------- */
  .fr-art-panel {
    grid-area: art;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    min-width: 0;
  }
  .fr-art-wrap {
    position: relative;
    width: min(58vh, 44vw, 640px);
    aspect-ratio: 1 / 1;
    transition: width 300ms ease;
  }
  .fr-stage.fr-size-medium .fr-art-wrap { width: min(48vh, 35vw, 520px); }
  .fr-stage.fr-size-small .fr-art-wrap { width: min(38vh, 28vw, 420px); }
  .fr-stage.fr-centered .fr-art-wrap { width: min(62vh, 40vw, 720px); }
  .fr-art-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: var(--fr-radius);
    box-shadow: 0 30px 80px -20px rgba(0,0,0,0.65);
    opacity: 0;
    transform: scale(0.985);
    transition: opacity 520ms ease, transform 520ms cubic-bezier(.2,.8,.2,1), box-shadow 300ms ease;
  }
  .fr-art-img.fr-art-active { opacity: 1; transform: scale(1); }
  .fr-art-wrap.fr-no-shadow .fr-art-img { box-shadow: none; }
  .fr-art-wrap.fr-glow::after {
    content: "";
    position: absolute;
    inset: -6%;
    border-radius: calc(var(--fr-radius) + 10px);
    background: var(--fr-art-glow, transparent);
    filter: blur(48px);
    opacity: 0.55;
    z-index: -1;
    transition: background 700ms ease;
  }
  .fr-art-wrap:hover .fr-art-img { transform: scale(1.012); }

  .fr-meta {
    margin-top: clamp(18px, 2vw, 32px);
    text-align: left;
    max-width: min(58vh, 44vw, 640px);
    transition: opacity 300ms ease, transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .fr-meta.fr-meta-animating {
    opacity: 0;
    transform: translateY(8px);
  }
  .fr-stage.fr-centered .fr-meta { text-align: center; margin-left: auto; margin-right: auto; }
  .fr-title {
    font-size: clamp(22px, 2.4vw, 38px);
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1.15;
    margin: 0 0 6px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fr-artist {
    font-size: clamp(14px, 1.2vw, 18px);
    color: var(--fr-fg-dim);
    margin: 0 0 2px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fr-album {
    font-size: clamp(12px, 1vw, 15px);
    color: var(--fr-fg-faint);
    margin: 0;
  }

  /* ---------------- Lyrics ---------------- */
  .fr-lyrics-panel {
    grid-area: lyrics;
    position: relative;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .fr-lyrics-scroll {
    flex: 1;
    overflow-y: auto;
    mask-image: linear-gradient(180deg, transparent 0%, #000 15%, #000 85%, transparent 100%);
    -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 15%, #000 85%, transparent 100%);
    padding: 10vh 4px 20vh 4px;
    scrollbar-width: none;
    scroll-behavior: smooth;
  }
  .fr-lyrics-scroll::-webkit-scrollbar { display: none; }
  .fr-lyric-line {
    font-size: clamp(24px, 3.5vw, 42px);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.3;
    color: var(--fr-fg-faint);
    opacity: 0.2;
    transform-origin: left center;
    transform: scale(0.9);
    transition: opacity 800ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 800ms cubic-bezier(0.2, 0.8, 0.2, 1), filter 800ms ease;
    padding: 12px 0;
    cursor: default;
    filter: blur(4px);
    will-change: transform, opacity, filter;
  }
  .fr-lyric-line.fr-future { opacity: 0.2; filter: blur(3px); transform: scale(0.9); }
  .fr-lyric-line.fr-past { opacity: 0.2; filter: blur(3px); transform: scale(0.9); }
  .fr-lyric-line.fr-prev, .fr-lyric-line.fr-next {
    opacity: 0.6;
    filter: blur(1.5px);
    transform: scale(0.95);
  }
  .fr-lyric-line.fr-active {
    color: var(--fr-fg);
    opacity: 1;
    transform: scale(1);
    filter: blur(0px);
  }
  .fr-lyric-line.fr-synced {
    cursor: pointer;
  }
  .fr-lyric-line.fr-synced:hover {
    color: rgba(255,255,255,0.8);
  }
  .fr-lyric-word { 
    display: inline-block;
    white-space: pre-wrap;
    transition: color 400ms ease, opacity 400ms ease, transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1), text-shadow 400ms ease; 
    opacity: 0.4; 
  }
  .fr-lyric-word.fr-word-active { 
    opacity: 1; 
    color: var(--fr-word-accent, #ffffff); 
    transform: translateY(-2px) scale(1.02);
  }
  .fr-lyric-line.fr-is-music {
    font-size: 2.5em;
    text-align: center;
    transform-origin: center center;
    animation: frMusicBounce 2s infinite alternate ease-in-out;
  }
  @keyframes frMusicBounce {
    0% { transform: scale(1) translateY(0); opacity: 0.6; }
    100% { transform: scale(1.1) translateY(-8px); opacity: 1; filter: brightness(1.2); }
  }
  .fr-lyric-line.fr-is-music .fr-lyric-word { opacity: 1; }
  .fr-lyrics-empty {
    color: var(--fr-fg-faint);
    font-size: 16px;
    margin-top: 20%;
  }
  .fr-resume-sync {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255,255,255,0.12);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.18);
    color: var(--fr-fg);
    padding: 8px 16px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms ease, transform 200ms ease;
  }
  .fr-resume-sync.fr-show { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(-4px); }
  .fr-resume-sync:hover { background: rgba(255,255,255,0.18); }

  /* ---------------- Bottom Dock (Controls + Volume + Queue) ---------------- */
  .fr-bottom-bar {
    position: absolute;
    bottom: clamp(24px, 3.2vw, 40px);
    left: 50%;
    transform: translateX(-50%);
    width: min(92vw, 1000px);
    background: rgba(30, 30, 35, 0.35);
    backdrop-filter: blur(60px) saturate(2.5);
    border: none;
    box-shadow: 0 30px 60px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 1px rgba(0,0,0,0.1);
    border-radius: 999px;
    padding: 12px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 32px;
    z-index: 5;
    transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  #fullscreen-reloaded-root.fr-idle .fr-bottom-bar {
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 40px) scale(0.95);
  }

  .fr-controls-left, .fr-controls-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .fr-controls-center {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 12px;
    color: var(--fr-fg-dim);
    font-variant-numeric: tabular-nums;
  }

  .fr-progress-bar {
    flex: 1;
    height: 6px;
    border-radius: 999px;
    background: rgba(255,255,255,0.12);
    position: relative;
    cursor: pointer;
    overflow: hidden;
  }
  .fr-progress-bar:hover { overflow: visible; }
  .fr-progress-fill {
    position: absolute;
    inset: 0 auto 0 0;
    width: 0%;
    border-radius: 999px;
    background: var(--fr-fg);
  }
  .fr-progress-bar:hover .fr-progress-fill { background: var(--fr-word-accent, #ffffff); }
  .fr-progress-handle {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--fr-fg);
    left: 0%;
    transform: translate(-50%, -50%) scale(0);
    transition: transform 120ms ease;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  }
  .fr-progress-bar:hover .fr-progress-handle { transform: translate(-50%, -50%) scale(1); }

  .fr-btn {
    background: transparent;
    border: none;
    color: var(--fr-fg-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
    border-radius: 50%;
    transition: color 150ms ease, transform 100ms ease, background 150ms ease;
  }
  .fr-btn:hover { color: var(--fr-fg); background: rgba(255,255,255,0.08); }
  .fr-btn:active { transform: scale(0.92); }
  .fr-btn.fr-active { color: var(--fr-word-accent, #1ed760); }
  .fr-btn-play {
    width: 48px;
    height: 48px;
    background: var(--fr-fg);
    color: #000;
  }
  .fr-btn-play:hover { background: var(--fr-fg); transform: scale(1.04); color: #000; }
  .fr-btn svg { width: 22px; height: 22px; }
  .fr-btn-play svg { width: 24px; height: 24px; }

  .fr-volume-row { display: flex; align-items: center; gap: 8px; width: 140px; }
  .fr-volume-bar {
    flex: 1;
    height: 6px;
    border-radius: 999px;
    background: rgba(255,255,255,0.12);
    position: relative;
    cursor: pointer;
    overflow: hidden;
  }
  .fr-volume-bar:hover { overflow: visible; }
  .fr-volume-fill {
    position: absolute; inset: 0 auto 0 0; width: 100%;
    border-radius: 999px; background: var(--fr-fg);
    transition: width 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .fr-volume-bar:hover .fr-volume-fill { background: var(--fr-word-accent, #ffffff); }
  .fr-volume-handle {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--fr-fg);
    left: 100%;
    transform: translate(-50%, -50%) scale(0);
    transition: transform 150ms ease, left 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  }
  .fr-volume-bar:hover .fr-volume-handle { transform: translate(-50%, -50%) scale(1); }

  /* ---------------- Top bar ---------------- */
  .fr-topbar {
    position: absolute;
    top: clamp(18px, 2.4vw, 36px);
    right: clamp(18px, 2.4vw, 36px);
    z-index: 14;
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(30,30,35,0.35);
    backdrop-filter: blur(60px) saturate(2.5);
    border-radius: 999px;
    padding: 6px 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 1px rgba(0,0,0,0.1);
    transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  #fullscreen-reloaded-root.fr-idle .fr-topbar {
    opacity: 0; pointer-events: none; transform: translateY(-20px) scale(0.95);
  }
  .fr-topbar .fr-btn { padding: 8px; border-radius: 50%; width: 36px; height: 36px; }
  .fr-topbar .fr-btn svg { width: 18px; height: 18px; }
  .fr-topbar-sep { width: 1px; height: 20px; background: rgba(255,255,255,0.12); margin: 0 2px; }
  .fr-topbar .fr-btn.fr-active { color: var(--fr-word-accent, #1ed760); }
  .fr-topbar .fr-btn.fr-heart-active { color: #ff4d6a; }

  /* ---------------- Settings panel ---------------- */
  .fr-settings-panel {
    position: absolute;
    top: clamp(60px, 6vw, 90px);
    right: clamp(18px, 2.4vw, 40px);
    z-index: 15;
    width: 320px;
    background: rgba(30, 30, 35, 0.35);
    backdrop-filter: blur(60px) saturate(2.5);
    border: none;
    border-radius: 36px;
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 30px 60px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 1px rgba(0,0,0,0.1);
    opacity: 0;
    pointer-events: none;
    transform: translateY(-10px) scale(0.95);
    transform-origin: top right;
    transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .fr-settings-panel.fr-show {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0) scale(1);
  }
  .fr-settings-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .fr-settings-divider {
    height: 1px;
    background: rgba(255,255,255,0.06);
    margin: 4px 0;
  }
  .fr-settings-title {
    font-size: 11px;
    font-weight: 800;
    color: rgba(255,255,255,0.4);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0 0 4px 0;
  }
  .fr-settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .fr-settings-row label {
    font-size: 14px;
    font-weight: 500;
    color: rgba(255,255,255,0.9);
  }
  .fr-settings-row select, .fr-settings-row input[type="color"] {
    background: rgba(255,255,255,0.1);
    border: none;
    box-shadow: inset 0 1px 1px rgba(0,0,0,0.1), 0 1px 1px rgba(255,255,255,0.05);
    color: var(--fr-fg);
    border-radius: 999px;
    padding: 8px 16px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    outline: none;
    cursor: pointer;
    transition: background 0.2s, transform 0.2s;
  }
  .fr-settings-row select:hover, .fr-settings-row input[type="color"]:hover {
    background: rgba(255,255,255,0.18);
    transform: scale(1.02);
  }
  .fr-toggle {
    width: 48px; height: 26px; border-radius: 999px;
    background: rgba(0,0,0,0.25);
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.4), 0 1px 1px rgba(255,255,255,0.05);
    position: relative; cursor: pointer; border: none;
    transition: background 0.3s ease;
  }
  .fr-toggle::after {
    content: ""; position: absolute; top: 3px; left: 3px;
    width: 20px; height: 20px; border-radius: 50%; background: #fff;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    transition: left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .fr-toggle.fr-on { 
    background: var(--fr-word-accent, #1ed760); 
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.2), 0 1px 1px rgba(255,255,255,0.05);
  }
  .fr-toggle.fr-on::after { left: 25px; }
  .fr-settings-hint {
    font-size: 11px;
    line-height: 1.5;
    color: var(--fr-fg-faint);
    margin-top: -4px;
  }
  .fr-text-btn {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.16);
    color: var(--fr-fg);
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }
  .fr-text-btn:hover { background: rgba(255,255,255,0.18); }

  /* ---------------- Idle Mode ---------------- */
  #fullscreen-reloaded-root.fr-idle,
  #fullscreen-reloaded-root.fr-idle * { cursor: none !important; }
  #fullscreen-reloaded-root.fr-idle .fr-controls,
  #fullscreen-reloaded-root.fr-idle .fr-topbar,
  #fullscreen-reloaded-root.fr-idle .fr-side-controls,
  #fullscreen-reloaded-root.fr-idle .fr-settings-panel,
  #fullscreen-reloaded-root.fr-idle .fr-resume-sync {
    opacity: 0;
    pointer-events: none;
    transform: translateY(12px);
  }
  .fr-controls, .fr-topbar, .fr-side-controls, .fr-settings-panel, .fr-resume-sync {
    transition: opacity 400ms ease, transform 400ms ease;
  }

  /* ---------------- Ambient Effects ---------------- */
  .fr-ambient { position: absolute; inset: 0; pointer-events: none; z-index: 1; overflow: hidden; mix-blend-mode: screen; opacity: 0; transition: opacity 2s ease; }
  .fr-ambient.fr-show { opacity: 0.55; }
  .fr-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.6; animation: floatOrb 20s infinite alternate ease-in-out; }
  @keyframes floatOrb {
    0% { transform: translate(0, 0) scale(1); }
    100% { transform: translate(100px, -100px) scale(1.2); }
  }
  .fr-particle { position: absolute; border-radius: 50%; opacity: 0; animation: floatUp linear infinite; }
  @keyframes floatUp {
    0% { transform: translateY(110vh) scale(0.5); opacity: 0; }
    20% { opacity: 0.3; }
    80% { opacity: 0.3; }
    100% { transform: translateY(-10vh) scale(1.5); opacity: 0; }
  }

  /* ---------------- Progress Ring ---------------- */
  .fr-progress-ring { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; z-index: 3; transform: rotate(-90deg); transform-origin: center; opacity: 0; transition: opacity 400ms ease; }
  #fullscreen-reloaded-root.fr-open .fr-progress-ring { opacity: 0.75; }
  .fr-progress-ring-rect { fill: transparent; stroke: var(--fr-word-accent, #fff); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 100; stroke-dashoffset: 100; transition: stroke-dashoffset 0.1s linear, stroke 0.3s ease; }

  /* ---------------- Instrumental / No-Lyrics Panel ---------------- */
  .fr-instrumental {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) scale(0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.8s ease, transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
    z-index: 3;
  }
  .fr-instrumental.fr-show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  .fr-instrumental-bars {
    display: flex;
    align-items: flex-end;
    gap: 5px;
    height: 48px;
  }
  .fr-instrumental-bar {
    width: 6px;
    border-radius: 3px;
    background: var(--fr-word-accent, rgba(255,255,255,0.7));
    animation: instrBar 1.2s ease-in-out infinite alternate;
  }
  .fr-instrumental-bar:nth-child(1) { animation-delay: 0s;    animation-duration: 0.9s; }
  .fr-instrumental-bar:nth-child(2) { animation-delay: 0.15s; animation-duration: 1.1s; }
  .fr-instrumental-bar:nth-child(3) { animation-delay: 0.3s;  animation-duration: 0.8s; }
  .fr-instrumental-bar:nth-child(4) { animation-delay: 0.1s;  animation-duration: 1.3s; }
  .fr-instrumental-bar:nth-child(5) { animation-delay: 0.25s; animation-duration: 1.0s; }
  .fr-instrumental-bar:nth-child(6) { animation-delay: 0.4s;  animation-duration: 0.85s; }
  .fr-instrumental-bar:nth-child(7) { animation-delay: 0.05s; animation-duration: 1.2s; }
  @keyframes instrBar {
    0%   { height: 6px; opacity: 0.4; }
    100% { height: 44px; opacity: 1; }
  }
  .fr-instrumental-label {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* ---------------- Up Next Card ---------------- */
  .fr-up-next { position: absolute; bottom: clamp(24px, 3.2vw, 64px); right: clamp(24px, 3.2vw, 64px); background: rgba(30, 30, 35, 0.35); backdrop-filter: blur(60px) saturate(2.5); border: none; box-shadow: 0 20px 40px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 1px rgba(0,0,0,0.1); border-radius: 999px; padding: 12px 24px 12px 12px; display: flex; align-items: center; gap: 16px; z-index: 10; transform: translateX(120%); opacity: 0; transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.6s ease; pointer-events: auto; cursor: pointer; }
  .fr-up-next.fr-show { transform: translateX(0); opacity: 1; }
  .fr-up-next-img { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
  .fr-up-next-info { display: flex; flex-direction: column; max-width: 200px; }
  .fr-up-next-label { font-size: 10px; font-weight: 700; color: var(--fr-fg-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
  .fr-up-next-title { font-size: 14px; font-weight: 700; color: var(--fr-fg); margin: 0 0 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fr-up-next-artist { font-size: 12px; color: var(--fr-fg-faint); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #fullscreen-reloaded-root.fr-idle .fr-up-next { opacity: 0; pointer-events: none; }

  /* ---------------- Clock & Idle Cinema Mode ---------------- */
  .fr-clock { position: absolute; left: 50%; font-size: clamp(64px, 8vw, 100px); font-weight: 700; color: rgba(255,255,255,0.85); opacity: 0; pointer-events: none; z-index: 10; letter-spacing: 0.02em; text-shadow: 0 4px 32px rgba(0,0,0,0.6); font-variant-numeric: tabular-nums; }
  .fr-clock.fr-pos-top { top: clamp(20px, 4vh, 60px); bottom: auto; transform: translateX(-50%) translateY(-20px); transition: opacity 0.8s ease, transform 0.8s ease, top 0.4s; }
  .fr-clock.fr-pos-bottom { bottom: clamp(40px, 8vh, 100px); top: auto; transform: translateX(-50%) translateY(20px); transition: opacity 0.8s ease, transform 0.8s ease, bottom 0.4s; }
  #fullscreen-reloaded-root.fr-idle .fr-clock.fr-pos-top, #fullscreen-reloaded-root.fr-idle .fr-clock.fr-pos-bottom { opacity: 1; transform: translateX(-50%) translateY(0); }

  #fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics="true"]) .fr-stage { 
    grid-template-columns: 1fr 0px; 
    gap: 0;
  }
  #fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics="true"]) .fr-lyrics-panel { opacity: 0; pointer-events: none; transition: opacity 0.8s ease; }
  
  /* Shift artwork away from clock */
  #fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics="true"])[data-clock="top"] .fr-art-panel { transform: scale(1.1) translateY(4vh); transition: transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); }
  #fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics="true"])[data-clock="bottom"] .fr-art-panel { transform: scale(1.1) translateY(-4vh); transition: transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); }
  
  #fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics="true"]) .fr-meta { text-align: center; margin-left: auto; margin-right: auto; margin-top: 50px; }
  #fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics="true"]) .fr-title { font-size: clamp(32px, 3.5vw, 48px); }
  #fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics="true"]) .fr-artist { font-size: clamp(18px, 1.8vw, 24px); }

  @media (max-aspect-ratio: 5/4), (max-width: 900px) {
    .fr-stage { 
      grid-template-columns: 1fr; 
      grid-template-rows: auto 1fr; 
      grid-template-areas: "art" "lyrics";
      gap: 16px;
      padding-top: clamp(24px, 4vh, 40px);
    }
    .fr-stage.fr-centered {
      grid-template-rows: 1fr;
    }
    .fr-lyrics-panel { display: flex; }
    .fr-lyrics-scroll { padding: 4vh 4px 15vh 4px; }
    
    .fr-art-wrap { width: min(35vh, 65vw, 400px); margin: 0 auto; }
    .fr-meta { text-align: center; margin-left: auto; margin-right: auto; max-width: 80vw; }
    
    /* Make bottom dock more compact */
    .fr-bottom-bar { gap: 12px; padding: 12px 16px; width: 94vw; }
    .fr-volume-row { width: 90px; }
    
    /* Override idle grid for portrait */
    #fullscreen-reloaded-root.fr-idle:not([data-idle-lyrics="true"]) .fr-stage {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr;
    }
    #fullscreen-reloaded-root.fr-idle[data-clock="top"] .fr-art-panel { transform: scale(1.05) translateY(4vh); }
    #fullscreen-reloaded-root.fr-idle[data-clock="bottom"] .fr-art-panel { transform: scale(1.05) translateY(-4vh); }
  }
  
  @media (max-width: 600px) {
    .fr-controls-center { display: none; } /* Hide progress bar on phones */
  }

  @media (max-height: 500px) {
    .fr-stage { grid-template-columns: 1fr; grid-template-rows: 1fr; grid-template-areas: "art"; }
    .fr-lyrics-panel { display: none !important; }
    .fr-art-wrap { width: min(46vh, 60vw, 420px); }
  }
  `;

  // ------------------------------------------------------------------
  // 3. I18N / Translations
  // ------------------------------------------------------------------
  const Locales = {
    en: {
      appearance: "Appearance", showLyrics: "Show Lyrics", idleLyrics: "Idle Mode Lyrics",
      ambientGlow: "Ambient Glow", glowShadow: "Glow Shadow", artworkRadius: "Artwork Radius",
      artworkSize: "Artwork Size", idleClockPos: "Idle Clock Pos", trackInfo: "Track Info",
      position: "Position", left: "Left", center: "Center", right: "Right",
      albumArt: "Album Art", trackTitle: "Track Title", artists: "Artists", albumName: "Album Name",
      background: "Background", mode: "Mode", gradient: "Gradient", dynamicGradient: "Dynamic Gradient",
      solidColor: "Solid Color", blurredArtwork: "Blurred Artwork", artwork: "Artwork",
      darkenedArtwork: "Darkened Artwork", customColor: "Custom Color", transitionSpeed: "Transition Speed",
      resumeSync: "Resume Sync", instrumental: "Instrumental", unknownTitle: "Unknown title",
      unknownArtist: "Unknown artist", upNext: "UP NEXT", language: "Language", auto: "Auto (Spotify)",
      small: "Small", medium: "Medium", large: "Large", top: "Top", bottom: "Bottom", none: "None"
    },
    tr: {
      appearance: "Görünüm", showLyrics: "Şarkı Sözleri", idleLyrics: "Bekleme Modunda Sözler",
      ambientGlow: "Ortam Parlaması", glowShadow: "Parlamaya Gölge", artworkRadius: "Kapak Ovalliği",
      artworkSize: "Kapak Boyutu", idleClockPos: "Bekleme Saati", trackInfo: "Şarkı Bilgileri",
      position: "Konum", left: "Sol", center: "Orta", right: "Sağ",
      albumArt: "Kapak Fotoğrafı", trackTitle: "Şarkı Adı", artists: "Sanatçılar", albumName: "Albüm Adı",
      background: "Arka Plan", mode: "Mod", gradient: "Gradyan", dynamicGradient: "Dinamik Gradyan",
      solidColor: "Düz Renk", blurredArtwork: "Bulanık Kapak", artwork: "Kapak",
      darkenedArtwork: "Karartılmış Kapak", customColor: "Özel Renk", transitionSpeed: "Geçiş Hızı",
      resumeSync: "Senkronize Et", instrumental: "Enstrümantal", unknownTitle: "Bilinmeyen Şarkı",
      unknownArtist: "Bilinmeyen Sanatçı", upNext: "SIRADAKİ", language: "Dil", auto: "Otomatik (Spotify)",
      small: "Küçük", medium: "Orta", large: "Büyük", top: "Üst", bottom: "Alt", none: "Yok"
    }
  };

  const t = (key) => {
    let lang = Settings.get("language") || "auto";
    if (lang === "auto") {
      const spLocale = (Spicetify.Locale && Spicetify.Locale.getLocale()) || "en";
      lang = spLocale.split("-")[0];
    }
    const dict = Locales[lang] || Locales.en;
    return dict[key] || Locales.en[key] || key;
  };

  // ------------------------------------------------------------------
  // 3.5 Color extraction (dominant / accent colors from album artwork)
  // ------------------------------------------------------------------
  const ColorExtractor = {
    cache: new Map(),
    MAX_CACHE: 30,
    async extract(imageUrl) {
      if (!imageUrl) return this.fallback();
      if (this.cache.has(imageUrl)) return this.cache.get(imageUrl);
      try {
        const img = await this.loadImage(imageUrl);
        const result = this.quantize(img);
        // Bug fix: cache was growing unbounded — evict oldest entry when full
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
      return { dominant: [16, 16, 20], accent: [216, 216, 214], dark: [8, 8, 10] };
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
    // Lightweight bucket-quantization: downsample the image onto a small
    // canvas, bucket pixels by coarse RGB, and pick the most common bucket
    // plus a higher-saturation "accent" bucket. This avoids pulling in a
    // full k-means implementation while still tracking the artwork well.
    quantize(img) {
      const size = 48;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);

      const buckets = new Map();
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 128) continue;
        const key = [r >> 4, g >> 4, b >> 4].join(",");
        const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
        bucket.r += r; bucket.g += g; bucket.b += b; bucket.n += 1;
        buckets.set(key, bucket);
      }

      const colors = [...buckets.values()]
        .map((b) => ({ r: b.r / b.n, g: b.g / b.n, b: b.b / b.n, n: b.n }))
        .sort((a, b) => b.n - a.n);

      if (!colors.length) return this.fallback();

      const dominant = colors[0];
      const bySaturation = [...colors].sort(
        (a, b) => saturation(b) - saturation(a)
      );
      const accent = bySaturation[0] || dominant;

      function saturation(c) {
        const max = Math.max(c.r, c.g, c.b);
        const min = Math.min(c.r, c.g, c.b);
        return max === 0 ? 0 : (max - min) / max;
      }
      function darken(c, f) {
        return [c.r * f, c.g * f, c.b * f];
      }

      return {
        dominant: [dominant.r, dominant.g, dominant.b],
        accent: [accent.r, accent.g, accent.b],
        dark: darken(dominant, 0.35),
      };
    },
  };

  function rgb(arr) {
    return `rgb(${Math.round(arr[0])}, ${Math.round(arr[1])}, ${Math.round(arr[2])})`;
  }
  function rgba(arr, a) {
    return `rgba(${Math.round(arr[0])}, ${Math.round(arr[1])}, ${Math.round(arr[2])}, ${a})`;
  }

  // ------------------------------------------------------------------
  // 4. Background manager — crossfades between two stacked layers so
  //    switching artwork never causes a hard cut.
  // ------------------------------------------------------------------
  const BackgroundManager = {
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

      // Bug fix: reset styles on the incoming layer so previous mode settings
      // (e.g. filter from blurred-artwork) don't bleed into the next mode.
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
          next.style.backgroundImage = `radial-gradient(ellipse at 20% 15%, ${rgba(colors.accent, 0.55)}, transparent 60%), linear-gradient(160deg, ${rgb(colors.dominant)}, ${rgb(colors.dark)})`;
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

      // Force layout so the opacity transition actually runs.
      next.offsetHeight; // eslint-disable-line no-unused-expressions
      next.classList.add("fr-bg-active");
      prev.classList.remove("fr-bg-active");
      this.activeIsA = !this.activeIsA;

      return colors;
    },
  };

  const AmbientManager = {
    root: null,
    orbs: [],
    particles: [],
    build() {
      this.root = el("div", "fr-ambient fr-show");
      
      const orbsCont = el("div", "");
      for(let i = 0; i < 3; i++) {
        const orb = el("div", "fr-orb");
        orb.style.width = orb.style.height = (40 + Math.random() * 40) + "vh";
        orb.style.top = (10 + Math.random() * 50) + "%";
        orb.style.left = (10 + Math.random() * 50) + "%";
        orb.style.animationDelay = "-" + (Math.random() * 15) + "s";
        orb.style.animationDuration = (15 + Math.random() * 10) + "s";
        this.orbs.push(orb);
        orbsCont.appendChild(orb);
      }
      
      const partsCont = el("div", "");
      for(let i = 0; i < 25; i++) {
        const p = el("div", "fr-particle");
        p.style.width = p.style.height = (3 + Math.random() * 4) + "px";
        p.style.left = (Math.random() * 100) + "%";
        p.style.animationDuration = (12 + Math.random() * 15) + "s";
        p.style.animationDelay = "-" + (Math.random() * 25) + "s";
        this.particles.push(p);
        partsCont.appendChild(p);
      }
      
      this.root.append(orbsCont, partsCont);
      return this.root;
    },
    updateColors(colors) {
      if(!this.root) return;
      this.orbs[0].style.backgroundColor = rgb(colors.dominant);
      this.orbs[1].style.backgroundColor = rgb(colors.accent);
      this.orbs[2].style.backgroundColor = rgb(colors.dark);
    },
    setIdle(isIdle) {
      if(this.root) this.root.classList.toggle("fr-show", !isIdle);
    }
  };

  // ------------------------------------------------------------------
  // 5. Lyrics provider abstraction
  // ------------------------------------------------------------------
  //   LyricsProvider (base)
  //   ├── SpotifyLyricsProvider     (Spotify's own internal color-lyrics
  //   │                              endpoint, via CosmosAsync — needs
  //   │                              Premium, no key required)
  //   ├── AppleMusicLyricsProvider  (Apple's internal catalog + lyrics
  //   │                              endpoint, via fetch — no manual API
  //   │                              key: a public "web player" developer
  //   │                              token is scraped automatically, the
  //   │                              user only signs in once through
  //   │                              Apple's own consent popup. Can return
  //   │                              true word-level (karaoke) timing.)
  //   ├── LrclibLyricsProvider      (lrclib.net — fully open, no signup,
  //   │                              no key at all, line-synced + plain)
  //   └── NetEaseLyricsProvider     (music.163.com public search/lyric
  //                                  endpoints — no key, same approach
  //                                  Spicetify's own lyrics-plus app uses)
  //
  //   Every provider resolves to a normalized shape:
  //   {
  //     type: "synced" | "word-synced" | "unsynced" | "none",
  //     lines: [{ startMs, words: [{ text, startMs?, endMs? }] }]
  //   }
  //
  //   None of these endpoints are officially documented public APIs —
  //   exactly like the Spotify one below, they're the same internal
  //   endpoints those services' own apps use. That means: no key/signup
  //   screen for the user, but also no uptime guarantee — if a service
  //   changes its endpoint, that single provider just returns null and
  //   the chain falls through to the next one.
  // ------------------------------------------------------------------
  class LyricsProvider {
    // eslint-disable-next-line no-unused-vars
    async fetch(track) {
      throw new Error("fetch() not implemented");
    }
  }

  class SpotifyLyricsProvider extends LyricsProvider {
    async fetch(track) {
      if (!track || !track.uri) return null;
      const id = track.uri.split(":")[2];
      if (!id) return null;
      const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`;
      let res;
      try {
        res = await Spicetify.CosmosAsync.get(url);
      } catch (e) {
        return null; // no lyrics for this track, or not Premium
      }
      if (!res || !res.lyrics || !Array.isArray(res.lyrics.lines)) return null;

      const syncType = res.lyrics.syncType; // "LINE_SYNCED" | "UNSYNCED"
      const lines = res.lyrics.lines.map((l) => ({
        startMs: Number(l.startTimeMs) || 0,
        words: this.splitWords(l.words, syncType === "LINE_SYNCED" ? Number(l.startTimeMs) : null),
      }));

      return {
        type: syncType === "LINE_SYNCED" ? "synced" : "unsynced",
        source: "Spotify",
        lines,
      };
    }
    splitWords(text, lineStartMs) {
      const parts = (text || "").split(/(\s+)/).filter((p) => p.length);
      // Spotify's public lyrics endpoint does not expose per-word timing;
      // word objects are still produced so the renderer can later light
      // words up progressively across the line's duration as an
      // approximation, or a true word-synced provider can supply real
      // per-word startMs values in the same shape.
      return parts.map((text) => ({ text, startMs: lineStartMs }));
    }
  }

  // ---- Apple Music -----------------------------------------------------
  // Two-step lookup: (1) find the Apple catalog song id for the currently
  // playing track by searching title + artist and matching duration,
  // (2) request that song's lyrics. Both calls use Apple's own "web
  // player" developer token (public, embedded in music.apple.com's own
  // page, refreshed automatically — never typed in by the user) plus,
  // for the lyrics call specifically, a Music-User-Token obtained by the
  // user once through Apple's normal sign-in popup (AppleMusicAuth
  // below). Without that sign-in, search still works but lyrics will be
  // unavailable and this provider quietly falls through to the next one.
  class AppleMusicLyricsProvider extends LyricsProvider {
    async fetch(track) {
      if (!track) return null;
      const meta = track.metadata || {};
      const title = meta.title;
      const artist = meta.artist_name;
      const durationMs = Number(meta.duration) || 0;
      if (!title || !artist) return null;

      const devToken = await AppleMusicAuth.getDeveloperToken();
      if (!devToken) return null;

      const songId = await this.findSongId(devToken, title, artist, durationMs);
      if (!songId) return null;

      const userToken = AppleMusicAuth.getUserToken();
      if (!userToken) return null; // signed out of Apple Music — skip silently

      let res;
      try {
        res = await fetch(
          `https://amp-api.music.apple.com/v1/catalog/${AppleMusicAuth.storefront}/songs/${songId}/lyrics`,
          {
            headers: {
              Authorization: `Bearer ${devToken}`,
              "Music-User-Token": userToken,
              Origin: "https://music.apple.com",
            },
          }
        ).then((r) => (r.ok ? r.json() : null));
      } catch (e) {
        return null;
      }

      const ttml = res && res.data && res.data[0] && res.data[0].attributes && res.data[0].attributes.ttml;
      if (!ttml) return null;

      const lines = parseTTML(ttml);
      if (!lines.length) return null;

      const wordSynced = lines.some((l) => l.words.some((w) => w.startMs != null));
      return {
        type: wordSynced ? "word-synced" : "synced",
        source: "Apple Music",
        lines,
      };
    }

    async findSongId(devToken, title, artist, durationMs) {
      const term = encodeURIComponent(`${title} ${artist}`);
      let res;
      try {
        res = await fetch(
          `https://amp-api.music.apple.com/v1/catalog/${AppleMusicAuth.storefront}/search?term=${term}&types=songs&limit=5`,
          { headers: { Authorization: `Bearer ${devToken}`, Origin: "https://music.apple.com" } }
        ).then((r) => (r.ok ? r.json() : null));
      } catch (e) {
        return null;
      }
      const songs = res && res.results && res.results.songs && res.results.songs.data;
      if (!songs || !songs.length) return null;

      // Prefer the candidate whose duration is closest to Spotify's, since
      // title/artist text matches alone are unreliable across catalogs.
      let best = songs[0];
      if (durationMs) {
        let bestDiff = Infinity;
        for (const s of songs) {
          const d = Number(s.attributes && s.attributes.durationInMillis) || 0;
          const diff = Math.abs(d - durationMs);
          if (diff < bestDiff) { bestDiff = diff; best = s; }
        }
      }
      return best.id;
    }
  }

  // ---- LRCLIB (with 503 retry + search fallback) --------------------------
  class LrclibLyricsProvider extends LyricsProvider {
    async fetch(track) {
      if (!track) return null;
      const meta = track.metadata || {};

      // First attempt: exact metadata match
      const params = new URLSearchParams({
        track_name: meta.title || "",
        artist_name: meta.artist_name || "",
        album_name: meta.album_title || "",
        duration: meta.duration ? String(Math.round(Number(meta.duration) / 1000)) : "",
      });

      const result = await this._tryFetch(`https://lrclib.net/api/get?${params.toString()}`);
      if (result) return result;

      // Second attempt: search endpoint (no album/duration required, works better for obscure tracks)
      const searchParams = new URLSearchParams({
        track_name: meta.title || "",
        artist_name: meta.artist_name || "",
      });
      return await this._tryFetch(`https://lrclib.net/api/search?${searchParams.toString()}`, true);
    }

    async _tryFetch(url, isSearch = false) {
      let res;
      try {
        const r = await fetch(url);
        // 503/502 = server overloaded, wait and retry once
        if (r.status === 503 || r.status === 502) {
          await new Promise(r => setTimeout(r, 1500));
          const r2 = await fetch(url);
          res = r2.ok ? await r2.json() : null;
        } else {
          res = r.ok ? await r.json() : null;
        }
      } catch (e) {
        return null;
      }
      if (!res) return null;

      // Search endpoint returns an array, pick the best match
      if (isSearch && Array.isArray(res)) {
        res = res[0];
      }
      if (!res) return null;

      if (res.syncedLyrics) {
        return { type: "synced", source: "LRCLIB", lines: parseLRC(res.syncedLyrics) };
      }
      if (res.plainLyrics) {
        const lines = res.plainLyrics
          .split("\n")
          .filter((l) => l.length)
          .map((text) => ({ startMs: 0, words: [{ text, startMs: null }] }));
        return { type: "unsynced", source: "LRCLIB", lines };
      }
      return null;
    }
  }

  const LyricsProviderManager = {
    providers: [
      new SpotifyLyricsProvider(),
      new LrclibLyricsProvider(),
    ],
    async resolve(track) {
      for (const provider of this.providers) {
        try {
          const result = await provider.fetch(track);
          if (result && result.lines && result.lines.length) return result;
        } catch (e) {
          // this provider failed — try the next one in the chain
        }
      }
      return { type: "none", lines: [] };
    },
  };

  // ------------------------------------------------------------------
  // 5b. Apple Music auth — scrapes the public web-player developer
  //     token automatically, and lets the user connect their own Apple
  //     Music account through Apple's normal sign-in popup (MusicKit
  //     JS). No key is ever typed in by hand.
  // ------------------------------------------------------------------
  const AppleMusicAuth = {
    storefront: "us",
    _devToken: null,
    _devTokenExpires: 0,
    _musicKitLoading: null,

    async getDeveloperToken() {
      if (this._devToken && Date.now() < this._devTokenExpires) return this._devToken;
      const cached = this._readCache();
      if (cached) {
        this._devToken = cached.token;
        this._devTokenExpires = cached.expires;
        return this._devToken;
      }
      try {
        const proxyUrl = "https://api.allorigins.win/get?url=" + encodeURIComponent("https://music.apple.com/us/browse");
        const res = await fetch(proxyUrl).then(r => r.json());
        const html = res && res.contents ? res.contents : "";
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

    // Primary strategy: Apple's own page used to embed the token as JSON
    // inside a <meta name="desktop-music-app/config/environment"> tag.
    _extractFromMetaTag(html) {
      const match = html.match(
        /<meta name="desktop-music-app\/config\/environment" content="([^"]+)"/
      );
      if (!match) return null;
      try {
        const config = JSON.parse(decodeURIComponent(match[1]));
        return (config && config.MEDIA_API && config.MEDIA_API.token) || null;
      } catch (e) {
        return null;
      }
    },

    // Fallback strategy: Apple's web-player developer tokens are always
    // signed with the same "WebPlayKid" key id, so this exact base64 JWT
    // header is a stable fingerprint to grep for directly in the page
    // even if the surrounding HTML/meta-tag structure changes — which is
    // exactly what broke the meta-tag approach on some Apple Music pages.
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

    // Opens Apple's own sign-in popup. On success, stores the resulting
    // Music-User-Token so the lyrics provider can use it from then on.
    async connect() {
      const devToken = await this.getDeveloperToken();
      if (!devToken) {
        Spicetify.showNotification && Spicetify.showNotification("Apple Music'e ulaşılamadı, tekrar deneyin.");
        return false;
      }
      try {
        const MusicKit = await this.loadMusicKit();
        await MusicKit.configure({
          developerToken: devToken,
          app: { name: "Fullscreen Reloaded", build: "1.0.0" },
        });
        const instance = MusicKit.getInstance();
        const userToken = await instance.authorize();
        Settings.set("appleMusicUserToken", userToken);
        Spicetify.showNotification && Spicetify.showNotification("Apple Music bağlandı.");
        return true;
      } catch (e) {
        Spicetify.showNotification && Spicetify.showNotification("Apple Music bağlantısı başarısız oldu.");
        return false;
      }
    },
  };

  // ------------------------------------------------------------------
  // 5c. Lyric text parsers (TTML for Apple, LRC for LRCLIB/NetEase)
  // ------------------------------------------------------------------
  function parseTTML(ttmlString) {
    let doc;
    try {
      doc = new DOMParser().parseFromString(ttmlString, "application/xml");
    } catch (e) {
      return [];
    }
    const paragraphs = Array.from(doc.getElementsByTagName("p"));
    const lines = [];
    for (const p of paragraphs) {
      const spans = Array.from(p.getElementsByTagName("span"));
      const lineStart = parseTTMLTime(p.getAttribute("begin"));
      if (spans.length) {
        // Word-level spans: <span begin="12.34s" end="12.56s">word</span>
        const words = spans
          .map((s) => ({
            text: (s.textContent || "").trim(),
            startMs: parseTTMLTime(s.getAttribute("begin")),
            endMs: parseTTMLTime(s.getAttribute("end")),
          }))
          .filter((w) => w.text.length);
        if (words.length) {
          lines.push({ startMs: lineStart != null ? lineStart : words[0].startMs || 0, words });
          continue;
        }
      }
      const text = (p.textContent || "").trim();
      if (text.length) {
        lines.push({
          startMs: lineStart || 0,
          words: text.split(/(\s+)/).filter((w) => w.length).map((w) => ({ text: w, startMs: lineStart })),
        });
      }
    }
    return lines;
  }

  function parseTTMLTime(value) {
    if (!value) return null;
    // "12.34s" style offset-time
    let m = value.match(/^([\d.]+)s$/);
    if (m) return Math.round(parseFloat(m[1]) * 1000);
    // "00:00:12.340" or "00:00:12:340" clock-time
    m = value.match(/^(\d+):(\d\d):(\d\d)[.:](\d+)$/);
    if (m) {
      const [, h, mi, s, frac] = m;
      const ms = frac.length === 2 ? Number(frac) * 10 : Number(frac.slice(0, 3).padEnd(3, "0"));
      return (Number(h) * 3600 + Number(mi) * 60 + Number(s)) * 1000 + ms;
    }
    return null;
  }

  // Parses standard [mm:ss.xx] LRC format into the same {startMs, words}
  // line shape the rest of the app expects.
  function parseLRC(lrcString) {
    const lines = [];
    const re = /\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)/;
    for (const raw of lrcString.split("\n")) {
      const m = raw.match(re);
      if (!m) continue;
      const [, min, sec, text] = m;
      if (!text.trim().length) continue;
      const startMs = (Number(min) * 60 + parseFloat(sec)) * 1000;
      lines.push({
        startMs,
        words: text.split(/(\s+)/).filter((w) => w.length).map((w) => ({ text: w, startMs })),
      });
    }
    return lines.sort((a, b) => a.startMs - b.startMs);
  }

  // ------------------------------------------------------------------
  // 6. Lyrics view — rendering, active-line sync, auto-scroll
  // ------------------------------------------------------------------
  const LyricsView = {
    panel: null,
    scrollEl: null,
    resumeBtn: null,
    lines: [],
    lineEls: [],
    activeIndex: -1,
    userScrolling: false,
    userScrollTimer: null,
    requestId: 0,

    build() {
      this.panel = el("div", "fr-lyrics-panel");
      this.scrollEl = el("div", "fr-lyrics-scroll");
      this.scrollEl.style.transition = "opacity 500ms ease, transform 500ms cubic-bezier(0.2, 0.8, 0.2, 1)";
      
      // Instrumental / no-lyrics panel
      this.instrPanel = el("div", "fr-instrumental");
      const bars = el("div", "fr-instrumental-bars");
      for (let i = 0; i < 7; i++) bars.appendChild(el("div", "fr-instrumental-bar"));
      this.instrPanel.append(bars, el("div", "fr-instrumental-label", t("instrumental")));

      this.resumeBtn = el("button", "fr-resume-sync", t("resumeSync"));
      this.resumeBtn.addEventListener("click", () => {
        this.userScrolling = false;
        this.resumeBtn.classList.remove("fr-show");
        this.scrollActiveIntoView(true);
      });
      this.panel.append(this.scrollEl, this.instrPanel, this.resumeBtn);

      this.scrollEl.addEventListener("wheel", () => this.onUserScroll());
      this.scrollEl.addEventListener("touchmove", () => this.onUserScroll());

      return this.panel;
    },

    onUserScroll() {
      this.userScrolling = true;
      this.resumeBtn.classList.add("fr-show");
      clearTimeout(this.userScrollTimer);
      // Auto re-sync after a long idle period even without pressing the button.
      this.userScrollTimer = setTimeout(() => {
        this.userScrolling = false;
        this.resumeBtn.classList.remove("fr-show");
      }, 12000);
    },

    hasLyrics: true,
    
    async loadForTrack(track, retryCount = 0) {
      const myRequest = ++this.requestId;

      if (retryCount === 0) {
        this.hasLyrics = true;
        if (typeof App !== "undefined" && App.applyLayoutSettings) App.applyLayoutSettings();
      }

      // Show loading indicator instead of blank screen while fetching
      this.scrollEl.style.opacity = 0;
      this.scrollEl.style.transform = "translateY(16px)";

      // Small delay on first load to let Spotify's CosmosAsync auth warm up
      if (retryCount === 0) await new Promise(r => setTimeout(r, 400));
      if (myRequest !== this.requestId) return;

      const data = await LyricsProviderManager.resolve(track);
      if (myRequest !== this.requestId) return;

      this.scrollEl.innerHTML = "";
      this.lines = [];
      this.lineEls = [];
      this.activeIndex = -1;

      if (!data.lines.length) {
        if (retryCount < 3) {
          // Auto-retry: Spotify's token / LRCLIB network may not be ready yet.
          // Wait progressively longer (1s, 2s, 4s) then try again silently.
          const delay = 1000 * Math.pow(2, retryCount);
          const retryEl = el("div", "fr-lyrics-empty", "♩");
          this.scrollEl.appendChild(retryEl);
          this.revealLyrics();
          await new Promise(r => setTimeout(r, delay));
          if (myRequest !== this.requestId) return; // track changed while waiting
          this.loadForTrack(track, retryCount + 1);
          return;
        }
        // All retries exhausted — show instrumental panel
        this.scrollEl.innerHTML = "";
        this.hasLyrics = false;
        if (this.instrPanel) this.instrPanel.classList.add("fr-show");
        if (typeof App !== "undefined" && App.applyLayoutSettings) App.applyLayoutSettings();
        return;
      }

      this.hasLyrics = true;
      if (this.instrPanel) this.instrPanel.classList.remove("fr-show");
      if (typeof App !== "undefined" && App.applyLayoutSettings) App.applyLayoutSettings();
      
      this.lines = data.lines;
      this.syncType = data.type;

      this.lines.forEach((line, i) => {
        const lineEl = el("div", "fr-lyric-line fr-future");
        
        let fullText = "";
        line.words.forEach((w) => {
          fullText += w.text + " ";
          const wordEl = el("span", "fr-lyric-word", w.text);
          lineEl.appendChild(wordEl);
          w.el = wordEl;
        });

        const textClean = fullText.trim().toLowerCase();
        if (textClean === "♪" || textClean === "🎵" || textClean === "🎶" || textClean === "instrumental" || textClean === "[instrumental]") {
          lineEl.classList.add("fr-is-music");
        }

        if (this.syncType === "synced" || this.syncType === "word-synced") {
          lineEl.classList.add("fr-synced");
        }

        lineEl.addEventListener("click", () => {
          if (this.syncType === "synced" || this.syncType === "word-synced") {
            Spicetify.Player.seek(line.startMs);
          }
        });
        this.scrollEl.appendChild(lineEl);
        this.lineEls.push(lineEl);
      });

      this.revealLyrics();
    },

    revealLyrics() {
      // Force DOM reflow so transition applies
      void this.scrollEl.offsetWidth;
      this.scrollEl.style.opacity = 1;
      this.scrollEl.style.transform = "translateY(0)";
    },

    update(progressMs) {
      if (!this.lines.length) return;

      // --- Unsynced lyrics: show all lines as active/visible immediately ---
      if (this.syncType !== "synced" && this.syncType !== "word-synced") {
        if (this.activeIndex === -1) {
          this.activeIndex = 0;
          for (let i = 0; i < this.lineEls.length; i++) {
            // Show unsynced lines progressively visible, top ones brighter
            const el = this.lineEls[i];
            el.classList.remove("fr-future", "fr-past", "fr-active", "fr-prev", "fr-next");
            el.className = "fr-lyric-line fr-future";
            // Make them all look identical (no white active line) but fade out at the bottom
            el.style.opacity = Math.max(0.4, 0.9 - i * 0.03);
            el.style.filter = "blur(0px)";
            el.style.transform = "scale(1)";
          }
        }
        return;
      }

      // --- Synced lyrics ---
      // Pre-show first line: if we haven't reached startMs yet, make line 0 partially visible
      if (this.activeIndex < 0) {
        if (this.lines[0] && this.lines[0].startMs > progressMs) {
          // Show first line dimly so panel isn't blank
          if (this.lineEls[0] && !this.lineEls[0].classList.contains("fr-next")) {
            this.lineEls[0].classList.remove("fr-future", "fr-past", "fr-active", "fr-prev");
            this.lineEls[0].classList.add("fr-next");
          }
          return;
        }
      }

      let idx = this.activeIndex < 0 ? 0 : this.activeIndex;
      // Advance/rewind to the line whose window contains the current progress.
      while (idx + 1 < this.lines.length && this.lines[idx + 1].startMs <= progressMs) idx++;
      while (idx > 0 && this.lines[idx].startMs > progressMs) idx--;

      if (idx !== this.activeIndex) {
        this.activeIndex = idx;

        for (let i = 0; i < this.lineEls.length; i++) {
          const lineEl = this.lineEls[i];
          let cls = "fr-lyric-line";
          if (i === idx) cls += " fr-active";
          else if (i === idx - 1) cls += " fr-prev";
          else if (i === idx + 1) cls += " fr-next";
          else if (i < idx) cls += " fr-past";
          else cls += " fr-future";

          if (lineEl.className !== cls) lineEl.className = cls;

          // Scrub fix: words in past lines should be fully active, future lines inactive
          if (i < idx) {
            this.lines[i].words.forEach(w => { if (w.el) w.el.classList.add("fr-word-active"); });
          } else if (i > idx) {
            this.lines[i].words.forEach(w => { if (w.el) w.el.classList.remove("fr-word-active"); });
          }
        }

        if (!this.userScrolling) this.scrollActiveIntoView();
      }

      // Word-level highlight.
      const line = this.lines[this.activeIndex];
      const nextLine = this.lines[this.activeIndex + 1];
      // Guard against undefined line (e.g. activeIndex is -1 during initial load)
      if (!line || !line.words || line.words.length <= 1) return;

      const hasRealWordTimes = this.syncType === "word-synced";
      if (hasRealWordTimes) {
        line.words.forEach((w) => {
          if (!w.el) return;
          const started = w.startMs != null && progressMs >= w.startMs;
          w.el.classList.toggle("fr-word-active", started);
        });
      } else {
        const lineEnd = nextLine ? nextLine.startMs : line.startMs + 6000;
        const span = Math.max(1, lineEnd - line.startMs);
        const t = (progressMs - line.startMs) / span;
        const activeWordCount = Math.max(0, Math.floor(t * line.words.length) + 1);
        line.words.forEach((w, i) => {
          if (!w.el) return;
          w.el.classList.toggle("fr-word-active", i < activeWordCount);
        });
      }
    },

    scrollActiveIntoView() {
      const activeEl = this.lineEls[this.activeIndex];
      if (!activeEl) return;
      // Bug fix: was always passing "smooth" regardless of the parameter —
      // use scrollIntoView with smooth behavior, offset for the mask gradient
      const panelHeight = this.scrollEl.clientHeight;
      const maskOffset = panelHeight * 0.08; // 8% mask at top/bottom
      const target = activeEl.offsetTop - (panelHeight / 2) + (activeEl.clientHeight / 2) - maskOffset;
      this.scrollEl.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    },
  };

  // ------------------------------------------------------------------
  // 7. Playback controls
  // ------------------------------------------------------------------
  const Icons = {
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

  const BottomDock = {
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

    build() {
      this.root = el("div", "fr-bottom-bar");

      // --- Left: Playback Controls ---
      const left = el("div", "fr-controls-left");
      this.shuffleBtn = iconBtn(Icons.shuffle, () => Spicetify.Player.toggleShuffle());
      const prevBtn = iconBtn(Icons.prev, () => Spicetify.Player.back());
      this.playBtn = iconBtn(Icons.play, () => Spicetify.Player.togglePlay(), "fr-btn-play");
      const nextBtn = iconBtn(Icons.next, () => Spicetify.Player.next());
      this.repeatBtn = iconBtn(Icons.repeat, () => Spicetify.Player.toggleRepeat());
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
        const up = () => { this.seeking = false; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      });

      // --- Right: Volume & Queue ---
      const right = el("div", "fr-controls-right");
      const volRow = el("div", "fr-volume-row");
      const volIcon = iconBtn(Icons.volume, () => Spicetify.Player.toggleMute());
      const volBar = el("div", "fr-volume-bar");
      this.volFill = el("div", "fr-volume-fill");
      this.volHandle = el("div", "fr-volume-handle");
      volBar.append(this.volFill, this.volHandle);
      volRow.append(volIcon, volBar);

      volBar.addEventListener("mousedown", (e) => {
        this.volSeeking = true;
        this.volFromEvent(e, volBar);
        const move = (ev) => this.volFromEvent(ev, volBar);
        const up = () => { this.volSeeking = false; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      });

      volRow.addEventListener("wheel", (e) => {
        e.preventDefault();
        const dir = e.deltaY < 0 ? 1 : -1;
        let vol = Spicetify.Player.getVolume() + (dir * 0.05);
        vol = Math.max(0, Math.min(1, vol));
        Spicetify.Player.setMute(false);
        Spicetify.Player.setVolume(vol);
        
        this._lastKnownVolume = vol;
        const volPct = vol * 100;
        this.volFill.style.width = volPct + "%";
        this.volHandle.style.left = volPct + "%";
      });

      const queueBtn = iconBtn(Icons.queue, () => {
        App.close();
        Spicetify.Platform.History.push("/queue");
      });
      right.append(volRow, queueBtn);

      this.root.append(left, center, right);
      return this.root;
    },

    seekFromEvent(e, bar) {
      const rect = bar.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const duration = Spicetify.Player.getDuration();
      Spicetify.Player.seek(pct * duration);
    },

    volFromEvent(e, bar) {
      const rect = bar.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      Spicetify.Player.setMute(false);
      Spicetify.Player.setVolume(pct);
      
      this._lastKnownVolume = pct;
      const volPct = pct * 100;
      this.volFill.style.width = volPct + "%";
      this.volHandle.style.left = volPct + "%";
    },

    _lastKnownProgress: 0,
    _lastKnownTime: 0,
    _lastKnownPlaying: false,
    _lastKnownVolume: -1,
    _lastKnownCurSec: -1,
    _lastKnownDurSec: -1,

    tick() {
      // Progress Sync
      const rawProgress = Spicetify.Player.getProgress();
      const duration    = Spicetify.Player.getDuration();
      const isPlaying   = Spicetify.Player.isPlaying();
      const now         = Date.now();

      if (rawProgress !== this._lastKnownProgress || isPlaying !== this._lastKnownPlaying) {
        this._lastKnownProgress = rawProgress;
        this._lastKnownTime     = now;
        this._lastKnownPlaying  = isPlaying;
      }
      let progress = isPlaying ? Math.min(duration || Infinity, this._lastKnownProgress + (now - this._lastKnownTime)) : rawProgress;

      if (!this.seeking) {
        const pct = duration ? (progress / duration) * 100 : 0;
        this.progressFill.style.width = pct + "%";
        this.progressHandle.style.left = pct + "%";
        
        // Performance fix: Only update DOM text if the second changed
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

      // Buttons Sync
      if (this._wasPlaying !== isPlaying) {
        this._wasPlaying = isPlaying;
        this.playBtn.innerHTML = isPlaying ? Icons.pause : Icons.play;
      }
      const shuffle = !!Spicetify.Player.getShuffle();
      if (this._wasShuffle !== shuffle) {
        this._wasShuffle = shuffle;
        this.shuffleBtn.classList.toggle("fr-active", shuffle);
      }
      const repeat = !!Spicetify.Player.getRepeat();
      if (this._wasRepeat !== repeat) {
        this._wasRepeat = repeat;
        this.repeatBtn.classList.toggle("fr-active", repeat);
      }

      // Volume Sync (Continuous!)
      if (!this.volSeeking) {
        const vol = Spicetify.Player.getMute() ? 0 : Spicetify.Player.getVolume();
        // Performance fix: Only update DOM styles if volume actually changed
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

  // ------------------------------------------------------------------
  // 8. Settings panel UI
  // ------------------------------------------------------------------
  const SettingsPanel = {
    root: null,
    build() {
      const panel = el("div", "fr-settings-panel");
      
      const sec1 = el("div", "fr-settings-section");
      sec1.appendChild(el("div", "fr-settings-title", t("background")));

      const bgRow = el("div", "fr-settings-row");
      const bgSelect = document.createElement("select");
      [
        ["solid", t("solidColor")],
        ["gradient", t("gradient")],
        ["dynamic-gradient", t("dynamicGradient")],
        ["blurred-artwork", t("blurredArtwork")],
        ["artwork", t("artwork")],
        ["darkened-artwork", t("darkenedArtwork")],
        ["custom-color", t("customColor")],
      ].forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        bgSelect.appendChild(opt);
      });
      bgSelect.value = Settings.get("backgroundMode");
      bgSelect.addEventListener("change", () => Settings.set("backgroundMode", bgSelect.value));
      bgRow.append(el("label", null, t("mode")), bgSelect);
      sec1.appendChild(bgRow);

      const colorRow = el("div", "fr-settings-row");
      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = Settings.get("customColor");
      colorInput.addEventListener("input", () => Settings.set("customColor", colorInput.value));
      colorRow.append(el("label", null, t("customColor")), colorInput);
      sec1.appendChild(colorRow);

      panel.appendChild(sec1);
      panel.appendChild(el("div", "fr-settings-divider"));

      const sec2 = el("div", "fr-settings-section");
      sec2.appendChild(el("div", "fr-settings-title", t("appearance")));

      const lyricsRow = el("div", "fr-settings-row");
      const lyricsToggle = toggle(Settings.get("showLyrics"), (v) => Settings.set("showLyrics", v));
      lyricsRow.append(el("label", null, t("showLyrics")), lyricsToggle);
      sec2.appendChild(lyricsRow);

      const idleLyricsRow = el("div", "fr-settings-row");
      const idleLyricsToggle = toggle(Settings.get("idleLyrics"), (v) => Settings.set("idleLyrics", v));
      idleLyricsRow.append(el("label", null, t("idleLyrics")), idleLyricsToggle);
      sec2.appendChild(idleLyricsRow);

      const glowRow = el("div", "fr-settings-row");
      const glowToggle = toggle(Settings.get("albumArtGlow"), (v) => Settings.set("albumArtGlow", v));
      glowRow.append(el("label", null, t("ambientGlow")), glowToggle);
      sec2.appendChild(glowRow);

      const shadowRow = el("div", "fr-settings-row");
      const shadowToggle = toggle(Settings.get("albumArtShadow"), (v) => Settings.set("albumArtShadow", v));
      shadowRow.append(el("label", null, t("glowShadow")), shadowToggle);
      sec2.appendChild(shadowRow);

      const sizeRow = el("div", "fr-settings-row");
      const sizeSelect = document.createElement("select");
      [["small", t("small")], ["medium", t("medium")], ["large", t("large")]].forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        sizeSelect.appendChild(opt);
      });
      sizeSelect.value = Settings.get("albumArtSize") || "large";
      sizeSelect.addEventListener("change", () => Settings.set("albumArtSize", sizeSelect.value));
      sizeRow.append(el("label", null, t("artworkSize")), sizeSelect);
      sec2.appendChild(sizeRow);

      const clockRow = el("div", "fr-settings-row");
      const clockSelect = document.createElement("select");
      [["top", t("top")], ["bottom", t("bottom")]].forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        clockSelect.appendChild(opt);
      });
      clockSelect.value = Settings.get("clockPosition") || "top";
      clockSelect.addEventListener("change", () => Settings.set("clockPosition", clockSelect.value));
      clockRow.append(el("label", null, t("idleClockPos")), clockSelect);
      sec2.appendChild(clockRow);

      // Language
      const langRow = el("div", "fr-settings-row");
      const langSelect = document.createElement("select");
      [["auto", t("auto")], ["en", "English"], ["tr", "Türkçe"]].forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value; opt.textContent = label;
        langSelect.appendChild(opt);
      });
      langSelect.value = Settings.get("language") || "auto";
      langSelect.addEventListener("change", () => {
        Settings.set("language", langSelect.value);
        // Reload UI to apply translations
        location.reload();
      });
      langRow.append(el("label", null, t("language")), langSelect);
      sec2.appendChild(langRow);

      panel.appendChild(sec2);
      panel.appendChild(el("div", "fr-settings-divider"));

      const sec3 = el("div", "fr-settings-section");
      sec3.appendChild(el("div", "fr-settings-title", t("trackInfo")));

      // Position
      const metaPosRow = el("div", "fr-settings-row");
      const metaPosSelect = document.createElement("select");
      [["left", t("left")], ["center", t("center")], ["right", t("right")]].forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value; opt.textContent = label;
        metaPosSelect.appendChild(opt);
      });
      metaPosSelect.value = Settings.get("metaPosition") || "left";
      metaPosSelect.addEventListener("change", () => Settings.set("metaPosition", metaPosSelect.value));
      metaPosRow.append(el("label", null, t("position")), metaPosSelect);
      sec3.appendChild(metaPosRow);

      // Show Album Art
      const showArtRow = el("div", "fr-settings-row");
      const showArtToggle = toggle(Settings.get("showAlbumArt") !== false, (v) => Settings.set("showAlbumArt", v));
      showArtRow.append(el("label", null, t("albumArt")), showArtToggle);
      sec3.appendChild(showArtRow);

      // Show Track Title
      const showTitleRow = el("div", "fr-settings-row");
      const showTitleToggle = toggle(Settings.get("showTitle") !== false, (v) => Settings.set("showTitle", v));
      showTitleRow.append(el("label", null, t("trackTitle")), showTitleToggle);
      sec3.appendChild(showTitleRow);

      // Show Artist
      const showArtistRow = el("div", "fr-settings-row");
      const showArtistToggle = toggle(Settings.get("showArtist") !== false, (v) => Settings.set("showArtist", v));
      showArtistRow.append(el("label", null, t("artists")), showArtistToggle);
      sec3.appendChild(showArtistRow);

      // Show Album Name
      const showAlbumRow = el("div", "fr-settings-row");
      const showAlbumToggle = toggle(Settings.get("showAlbum") !== false, (v) => Settings.set("showAlbum", v));
      showAlbumRow.append(el("label", null, t("albumName")), showAlbumToggle);
      sec3.appendChild(showAlbumRow);

      panel.appendChild(sec3);

      this.root = panel;
      return panel;
    },
    toggleOpen() {
      this.root.classList.toggle("fr-show");
    },
  };

  function toggle(initial, onChange) {
    const btn = document.createElement("button");
    btn.className = "fr-toggle" + (initial ? " fr-on" : "");
    btn.addEventListener("click", () => {
      const next = !btn.classList.contains("fr-on");
      btn.classList.toggle("fr-on", next);
      onChange(next);
    });
    return btn;
  }

  // ------------------------------------------------------------------
  // 8.5 Clock and Up Next Card
  // ------------------------------------------------------------------
  const Clock = {
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
      this.timer = setInterval(tick, 1000);
    },
    stop() {
      clearInterval(this.timer);
    }
  };

  const UpNextCard = {
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
      this.root.addEventListener("click", () => Spicetify.Player.next());
      return this.root;
    },
    update(duration, progress) {
      if (!this.root) return;
      const remaining = duration - progress;
      const shouldShow = duration > 40000 && remaining > 0 && remaining < 20000;
      
      if (shouldShow && !this.shown) {
        // Fetch next track
        const queue = Spicetify.Queue;
        const nextTrack = queue && queue.nextTracks && queue.nextTracks[0];
        if (nextTrack) {
          const meta = nextTrack.metadata || nextTrack.contextTrack?.metadata || {};
          this.title.textContent = meta.title || "Unknown title";
          this.artist.textContent = meta.artist_name || "Unknown artist";
          this.img.src = resolveImageUrl(meta.image_xlarge_url || meta.image_large_url || meta.image_url);
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
    }
  };

  // ------------------------------------------------------------------
  // 9. Main app: mounts the overlay, wires track/progress updates
  // ------------------------------------------------------------------
  const App = {
    root: null,
    stage: null,
    artImg: null,
    artImgAlt: null,
    artActiveIsImg: true,
    artWrap: null,
    titleEl: null,
    artistEl: null,
    albumEl: null,
    open: false,
    tickHandle: null,
    songChangeListener: null,

    mount() {
      const root = el("div", "");
      root.id = "fullscreen-reloaded-root";

      root.appendChild(BackgroundManager.build());
      root.appendChild(AmbientManager.build());
      root.appendChild(Clock.build());

      this.stage = el("div", "fr-stage");

      // Album art + progress ring + meta
      const artPanel = el("div", "fr-art-panel");
      const artColumn = el("div", "");
      artColumn.style.display = "flex";
      artColumn.style.flexDirection = "column";
      artColumn.style.alignItems = "flex-start";
      
      this.artWrap = el("div", "fr-art-wrap fr-glow");
      
      // The SVG progress ring inside the artwork wrapper
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

      // Lyrics
      const lyricsPanel = LyricsView.build();

      this.stage.append(artPanel, lyricsPanel);
      root.appendChild(this.stage);
      
      // Bottom Dock (Playback, Progress, Volume, Queue)
      const bottomDock = BottomDock.build();
      root.appendChild(bottomDock);
      
      // Up Next Card
      root.appendChild(UpNextCard.build());

      // Top bar — liquid pill with all controls
      const topbar = el("div", "fr-topbar");

      // Lyrics toggle
      const lyricsBtn = iconBtn(Icons.lyrics, () => this.toggleLyricsVisible());
      this.lyricsBtn = lyricsBtn;
      
      // PiP button
      const pipBtn = iconBtn(Icons.pip, async () => {
        try {
          // If Document PiP is open, close it
          if (window.documentPictureInPicture && window.documentPictureInPicture.window) {
            window.documentPictureInPicture.window.close();
            pipBtn.classList.remove("fr-active");
            return;
          }
          // If Legacy Video PiP is open, close it
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
            pipBtn.classList.remove("fr-active");
            return;
          }

          // Modern Document PiP API (Provides a clean window without video controls!)
          if (window.documentPictureInPicture) {
            const pipWindow = await window.documentPictureInPicture.requestWindow({
              width: 400, height: 400
            });
            pipWindow.document.body.style.margin = "0";
            pipWindow.document.body.style.backgroundColor = "#121212";
            pipWindow.document.body.style.overflow = "hidden";
            
            const img = document.createElement("img");
            img.src = this.currentImage || "";
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            
            // Save reference to update it when track changes
            this.pipImg = img;
            pipWindow.document.body.appendChild(img);
            
            pipWindow.addEventListener("pagehide", () => {
              pipBtn.classList.remove("fr-active");
              this.pipImg = null;
            });
            pipBtn.classList.add("fr-active");
          } 
          // Fallback for older Chromium versions: Legacy Canvas Video PiP
          else {
            const canvas = document.createElement("canvas");
            canvas.width = 800; canvas.height = 800;
            const ctx = canvas.getContext("2d");
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = this.currentImage || "";
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
              video.addEventListener("leavepictureinpicture", () => pipBtn.classList.remove("fr-active"));
            };
            pipBtn.classList.add("fr-active");
          }
        } catch(e) {}
      });

      const sep2 = el("div", "fr-topbar-sep");
      
      // Settings
      const gearBtn = iconBtn(Icons.gear, () => SettingsPanel.toggleOpen());
      // Close
      const closeBtn = iconBtn(Icons.close, () => this.close());

      topbar.append(lyricsBtn, pipBtn, sep2, gearBtn, closeBtn);
      root.appendChild(topbar);
      root.appendChild(SettingsPanel.build());

      document.body.appendChild(root);
      this.root = root;

      this.applyLayoutSettings();

      this.songChangeListener = () => this.onTrackChange();
      Spicetify.Player.addEventListener("songchange", this.songChangeListener);
    },

    _applyMetaVisibility() {
      if (!this.metaWrap) return;
      const pos        = Settings.get("metaPosition") || "left";
      const showArt    = Settings.get("showAlbumArt") !== false;
      const showTitle  = Settings.get("showTitle")    !== false;
      const showArtist = Settings.get("showArtist")   !== false;
      const showAlbum  = Settings.get("showAlbum")    !== false;

      // Alignment
      this.metaWrap.style.textAlign   = pos;
      this.metaWrap.style.marginLeft  = (pos === "center" || pos === "right") ? "auto" : "0";
      this.metaWrap.style.marginRight = (pos === "center" || pos === "left")  ? "auto" : "0";

      // Visibility
      if (this.artWrap) this.artWrap.style.display = showArt ? "" : "none";
      this.titleEl.style.display  = showTitle  ? "" : "none";
      this.artistEl.style.display = showArtist ? "" : "none";
      this.albumEl.style.display  = showAlbum  ? "" : "none";
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

    onSettingsChanged(key) {
      if (["showLyrics","albumArtGlow","albumArtShadow","albumArtRadius","albumArtSize","clockPosition","idleLyrics","metaPosition","showArtist","showAlbum","showAlbumArt","showTitle"].includes(key)) {
        this.applyLayoutSettings();
      }
      if (["backgroundMode", "customColor"].includes(key) && this.currentTrack) {
        BackgroundManager.update(this.currentImage);
      }
    },

    toggleLyricsVisible() {
      Settings.set("showLyrics", !Settings.get("showLyrics"));
    },

    currentTrack: null,
    currentImage: null,
    _metaGen: 0, // Bug fix: generation counter prevents stale setTimeout writing new text

    async onTrackChange() {
      const state = Spicetify.Player.data;
      const track = state && (state.track || state.item);
      if (!track) return;

      const isSameTrack = this.currentTrack && this.currentTrack.uri === track.uri;
      this.currentTrack = track;

      const meta = track.metadata || {};

      // Multi-artist fix: Spicetify exposes artist_name as single string,
      // but the full track object may have a richer artists array
      const artists = (track.artists && track.artists.length)
        ? track.artists.map(a => a.name || a.displayName || "").filter(Boolean).join(", ")
        : (meta.artist_name || t("unknownArtist"));

      const updateMeta = () => {
        this.titleEl.textContent  = meta.title || t("unknownTitle");
        this.artistEl.textContent = artists;
        this.albumEl.textContent  = meta.album_title || "";
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
        meta.image_xlarge_url || meta.image_large_url || meta.image_url
      );
      this.currentImage = image;

      if (!isSameTrack) {
        UpNextCard.reset();

        // Heart button tracking removed
        
        // Update Document PiP image if active
        if (this.pipImg) {
          this.pipImg.src = image;
        }

        // Crossfade album art between the two stacked <img> layers.
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
        
        LyricsView.loadForTrack(track);
      } else {
        // Just reload lyrics in case we closed/reopened
        LyricsView.loadForTrack(track);
      }
    },

    startTicking() {
      if (this.tickHandle) return;
      const loop = () => {
        const progress = BottomDock.tick();
        const duration = Spicetify.Player.getDuration();
        if (typeof progress === "number") {
          LyricsView.update(progress);
          UpNextCard.update(duration, progress);
          
          if (duration && this.ringRect) {
            const pct = Math.max(0, Math.min(1, progress / duration));
            // Dasharray is 100 (normalized via pathLength="100"), so 100 to 0 is the full circle
            this.ringRect.style.strokeDashoffset = 100 - (pct * 100);
          }
        }
        this.tickHandle = requestAnimationFrame(loop);
      };
      this.tickHandle = requestAnimationFrame(loop);
    },

    stopTicking() {
      if (this.tickHandle) cancelAnimationFrame(this.tickHandle);
      this.tickHandle = null;
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
        // user interaction might be required, or already in fullscreen
      }

      await this.onTrackChange();
      this.startTicking();
    },

    close() {
      this.open = false;
      this.root.classList.remove("fr-open");
      SettingsPanel.root.classList.remove("fr-show");
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
  };

  // ------------------------------------------------------------------
  // 9.5. Idle Tracker — Hides UI and cursor when mouse stops moving
  // ------------------------------------------------------------------
  const IdleTracker = {
    timer: null,
    register() {
      const reset = () => this.reset();
      window.addEventListener("mousemove", reset);
      window.addEventListener("mousedown", reset);
      window.addEventListener("keydown", reset);
      window.addEventListener("wheel", reset);
      window.addEventListener("mouseleave", () => this.setIdle(true));
    },
    reset() {
      // Bug fix: do nothing when fullscreen is not open to avoid wasted timers
      if (!App.open) return;
      if (App.root && App.root.classList.contains("fr-idle")) {
        App.root.classList.remove("fr-idle");
      }
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.setIdle(true), 2500);
    },
    setIdle(isIdle) {
      if (!App.root || !App.open) return;
      if (SettingsPanel.root && SettingsPanel.root.classList.contains("fr-show")) return;
      App.root.classList.toggle("fr-idle", isIdle);
      AmbientManager.setIdle(isIdle);
    },
  };

  // ------------------------------------------------------------------
  // 10. Hotkeys — F to open, ESC to close. Ignored while the user is
  //     typing in a text field anywhere in the app (search box, etc).
  // ------------------------------------------------------------------
  const Hotkeys = {
    register() {
      document.addEventListener("keydown", (e) => this.onKeyDown(e), true);
      document.addEventListener("click", (e) => this.onClick(e), true);
    },
    onClick(e) {
      // Intercept Spotify's native Fullscreen button (by aria-label, testid, or class)
      const btn = e.target.closest(
        'button[data-testid="fullscreen-control"], button[data-testid="control-button-fullscreen"], button.control-button--fullscreen, button[aria-label*="ull screen"], button[aria-label*="am ekran"]'
      );
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        App.toggleOpen();
      }
    },
    onKeyDown(e) {
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
        App.toggleOpen();
        return;
      }

      if (!App.open && (e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        App.launch();
      } else if (App.open && e.key === "Escape") {
        e.preventDefault();
        App.close();
      }
    },
  };

  // ------------------------------------------------------------------
  // Small DOM helpers
  // ------------------------------------------------------------------
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function iconBtn(svg, onClick, extraClass) {
    const btn = document.createElement("button");
    btn.className = "fr-btn" + (extraClass ? " " + extraClass : "");
    btn.innerHTML = svg;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function formatMs(ms) {
    if (!ms || ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // Spicetify's own docs flag metadata.image_*_url as "internal URL paths,
  // not URLs" — in practice these come through as identifiers like
  // "spotify:image:ab67616d0000b273<hash>" rather than something an <img>
  // tag or CSS background-image can load directly. This resolves either
  // shape into a real https://i.scdn.co/image/<hash> URL; a value that's
  // already a full URL (some older client versions return one) passes
  // through unchanged.
  function resolveImageUrl(value) {
    if (!value) return "";
    if (value.startsWith("http")) return value;
    const hash = value.split(":").pop();
    return `https://i.scdn.co/image/${hash}`;
  }
})();
