/**
 * Apple Music Liquid Top Bar component (Lyrics, Creator, Redesigned PiP with Live Lyrics + Mini Controls, Settings, Close).
 */
import { el, iconBtn } from "../utils/dom.js";
import { Icons } from "../utils/icons.js";
import { t } from "../utils/i18n.js";
import { Settings } from "../utils/settings.js";
import { SettingsModal } from "./SettingsModal.js";
import { FullLyricsCreator } from "./FullLyricsCreator.js";
import { SpotiKitBridge } from "../services/SpotiKitBridge.js";

const PIP_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 100%; height: 100%; overflow: hidden;
    background: #09090e; color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Helvetica, Arial, sans-serif;
    user-select: none;
  }
  .fr-pip-shell {
    position: relative; width: 100%; height: 100%;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 16px 18px 18px; overflow: hidden;
    -webkit-app-region: drag;
    app-region: drag;
    cursor: grab;
  }
  .fr-pip-shell:active { cursor: grabbing; }
  .fr-pip-bg {
    position: absolute; inset: -22%; background-size: cover; background-position: center;
    filter: blur(46px) saturate(1.85) brightness(0.46);
    transform: scale(1.12); transition: background-image 600ms ease; z-index: 0;
  }
  .fr-pip-scrim {
    position: absolute; inset: 0; z-index: 1;
    background: radial-gradient(circle at 50% 25%, rgba(0,0,0,0.12) 0%, rgba(6,6,12,0.72) 100%);
  }
  .fr-pip-header {
    position: relative; z-index: 2; display: flex; align-items: center; gap: 10px;
    padding: 4px 2px;
  }
  .fr-pip-art {
    width: 38px; height: 38px; border-radius: 10px; object-fit: cover; flex-shrink: 0;
    box-shadow: 0 6px 18px rgba(0,0,0,0.48);
    -webkit-user-drag: none; pointer-events: none;
  }
  .fr-pip-meta { min-width: 0; flex: 1; }
  .fr-pip-title {
    font-size: 13.5px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .fr-pip-artist {
    font-size: 11.5px; font-weight: 500; color: rgba(255,255,255,0.62); margin-top: 1px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .fr-pip-mini-ctrl {
    display: inline-flex; align-items: center; gap: 2px; flex-shrink: 0;
    -webkit-app-region: no-drag;
    app-region: no-drag;
  }
  .fr-pip-ctrl-btn {
    width: 28px; height: 28px; border-radius: 50%; border: none;
    background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.9);
    display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
    -webkit-app-region: no-drag;
    app-region: no-drag;
    transition: background 180ms ease, transform 160ms ease;
  }
  .fr-pip-ctrl-btn:hover { background: rgba(255,255,255,0.22); transform: scale(1.06); }
  .fr-pip-ctrl-btn:active { transform: scale(0.92); }
  .fr-pip-ctrl-btn svg { width: 14px; height: 14px; fill: currentColor; }
  .fr-pip-lyrics {
    position: relative; z-index: 2; flex: 1;
    display: flex; flex-direction: column; justify-content: center; gap: 11px;
    padding: 8px 4px 4px;
    mask-image: linear-gradient(180deg, transparent 0%, #000 16%, #000 84%, transparent 100%);
    -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 16%, #000 84%, transparent 100%);
  }
  .fr-pip-lyric-prev {
    font-size: clamp(13px, 3.6vw, 16px); font-weight: 600; line-height: 1.3;
    color: rgba(255,255,255,0.28); filter: blur(0.4px);
    transition: opacity 320ms ease;
  }
  .fr-pip-lyric-active {
    font-size: clamp(20px, 6vw, 28px); font-weight: 800; line-height: 1.22;
    letter-spacing: -0.025em; color: #ffffff;
    text-shadow: 0 3px 22px rgba(255,255,255,0.34);
    transition: opacity 280ms cubic-bezier(0.32, 0.72, 0, 1), transform 340ms cubic-bezier(0.32, 0.72, 0, 1);
  }
  .fr-pip-lyric-next {
    font-size: clamp(14px, 4vw, 17px); font-weight: 600; line-height: 1.32;
    color: rgba(255,255,255,0.46);
    transition: opacity 320ms ease;
  }
  .fr-pip-shell.fr-pip-no-lyrics .fr-pip-lyrics { display: none; }
  .fr-pip-shell.fr-pip-no-lyrics { padding: 0; }
  .fr-pip-shell.fr-pip-no-lyrics .fr-pip-header {
    position: absolute; inset: 0; padding: 0;
  }
  .fr-pip-shell.fr-pip-no-lyrics .fr-pip-art {
    width: 100%; height: 100%; border-radius: 0;
  }
  .fr-pip-shell.fr-pip-no-lyrics .fr-pip-meta,
  .fr-pip-shell.fr-pip-no-lyrics .fr-pip-mini-ctrl { display: none; }
`;

export const TopBar = {
  root: null,
  lyricsBtn: null,
  creatorBtn: null,
  pipBtn: null,
  pipImg: null,
  _pipShell: null,
  _pipBg: null,
  _pipTitle: null,
  _pipArtist: null,
  _pipPrevLine: null,
  _pipActiveLine: null,
  _pipNextLine: null,
  _pipPlayBtn: null,
  _lastPipPrevText: "",
  _lastPipActiveText: "",
  _lastPipNextText: "",
  _lastPipPlaying: null,

  build(app) {
    const topbar = el("div", "fr-topbar");

    this.lyricsBtn = iconBtn(Icons.lyrics, () => app.toggleLyricsVisible());
    this.creatorBtn = iconBtn(Icons.creator, () => FullLyricsCreator.toggleOpen());
    this.creatorBtn.title = "FullLyrics Creator Studio (E)";
    this.pipBtn = iconBtn(Icons.pip, async () => {
      await this.togglePiP(app);
    });

    const sep = el("div", "fr-topbar-sep");
    const gearBtn = iconBtn(Icons.gear, () => SettingsModal.toggleOpen());
    const closeBtn = iconBtn(Icons.close, () => app.close());

    topbar.append(this.lyricsBtn, this.creatorBtn, this.pipBtn, sep, gearBtn, closeBtn);
    this.root = topbar;
    return topbar;
  },

  _clearPiPRefs() {
    this.pipImg = null;
    this._pipShell = null;
    this._pipBg = null;
    this._pipTitle = null;
    this._pipArtist = null;
    this._pipPrevLine = null;
    this._pipActiveLine = null;
    this._pipNextLine = null;
    this._pipPlayBtn = null;
    this._lastPipPrevText = "";
    this._lastPipActiveText = "";
    this._lastPipNextText = "";
    this._lastPipPlaying = null;
  },

  updatePiPImage(imageUrl) {
    if (this.pipImg && imageUrl) {
      this.pipImg.src = imageUrl;
    }
    if (this._pipBg && imageUrl) {
      this._pipBg.style.backgroundImage = `url("${imageUrl}")`;
    }
  },

  updatePiPTrack(track, imageUrl) {
    this.updatePiPImage(imageUrl);
    if (!track) return;
    const meta = track.metadata || {};
    const title = meta.title || track.name || t("unknownTitle");
    const artists =
      SpotiKitBridge.getTrackArtists(track)
        .map((a) => a.name)
        .join(", ") ||
      meta.artist_name ||
      t("unknownArtist");
    if (this._pipTitle) this._pipTitle.textContent = title;
    if (this._pipArtist) this._pipArtist.textContent = artists;
  },

  updatePiPLyrics(snapshot) {
    if (!this._pipActiveLine || !this._pipNextLine) return;
    const prevText = snapshot?.prevText || "";
    const activeText = snapshot?.isMusic
      ? "♪  •  •  •"
      : snapshot?.activeText || (snapshot ? "" : t("sidebarNoLyrics"));
    const nextText = snapshot?.nextText || "";

    if (this._pipPrevLine && prevText !== this._lastPipPrevText) {
      this._lastPipPrevText = prevText;
      this._pipPrevLine.textContent = prevText;
    }
    if (activeText !== this._lastPipActiveText) {
      this._lastPipActiveText = activeText;
      this._pipActiveLine.textContent = activeText;
    }
    if (nextText !== this._lastPipNextText) {
      this._lastPipNextText = nextText;
      this._pipNextLine.textContent = nextText;
    }
    if (this._pipPlayBtn) {
      const playing = SpotiKitBridge.isPlaying();
      if (playing !== this._lastPipPlaying) {
        this._lastPipPlaying = playing;
        this._pipPlayBtn.innerHTML = playing ? Icons.pause : Icons.play;
      }
    }
  },

  applyPiPLyricsVisibility() {
    if (!this._pipShell) return;
    const enabled = Settings.get("pipLyrics") !== false;
    this._pipShell.classList.toggle("fr-pip-no-lyrics", !enabled);
  },

  async togglePiP(app) {
    try {
      if (window.documentPictureInPicture && window.documentPictureInPicture.window) {
        window.documentPictureInPicture.window.close();
        this.pipBtn?.classList.remove("fr-active");
        this._clearPiPRefs();
        return;
      }

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        this.pipBtn?.classList.remove("fr-active");
        return;
      }

      if (window.documentPictureInPicture) {
        const pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 400,
          height: 360,
        });
        if (!this.root || SpotiKitBridge.isStopped()) {
          try {
            pipWindow?.close?.();
          } catch (_) {}
          return;
        }

        const pipDoc = pipWindow.document;
        if (pipDoc.head && typeof pipDoc.createElement === "function") {
          const styleEl = pipDoc.createElement("style");
          styleEl.textContent = PIP_STYLES;
          pipDoc.head.appendChild(styleEl);
        }
        pipDoc.body.style.margin = "0";
        pipDoc.body.style.backgroundColor = "#09090e";
        pipDoc.body.style.overflow = "hidden";

        const createEl = (tag, cls, text) => {
          const node =
            typeof pipDoc.createElement === "function"
              ? pipDoc.createElement(tag)
              : document.createElement(tag);
          if (cls) node.className = cls;
          if (text !== undefined) node.textContent = text;
          return node;
        };

        const shell = createEl("div", "fr-pip-shell");
        if (Settings.get("pipLyrics") === false) {
          shell.classList.add("fr-pip-no-lyrics");
        }

        const bg = createEl("div", "fr-pip-bg");
        if (app?.currentImage) bg.style.backgroundImage = `url("${app.currentImage}")`;
        const scrim = createEl("div", "fr-pip-scrim");

        const header = createEl("div", "fr-pip-header");
        const img = createEl("img", "fr-pip-art");
        img.src = app?.currentImage || "";
        img.draggable = false;

        const metaBox = createEl("div", "fr-pip-meta");
        const titleEl = createEl("div", "fr-pip-title", "");
        const artistEl = createEl("div", "fr-pip-artist", "");
        metaBox.append(titleEl, artistEl);

        const miniCtrl = createEl("div", "fr-pip-mini-ctrl");
        const prevBtn = createEl("button", "fr-pip-ctrl-btn");
        prevBtn.setAttribute("type", "button");
        prevBtn.innerHTML = Icons.prev;
        prevBtn.addEventListener("click", () => SpotiKitBridge.back());

        const playBtn = createEl("button", "fr-pip-ctrl-btn");
        playBtn.setAttribute("type", "button");
        playBtn.innerHTML = SpotiKitBridge.isPlaying() ? Icons.pause : Icons.play;
        playBtn.addEventListener("click", () => SpotiKitBridge.togglePlay());

        const nextBtn = createEl("button", "fr-pip-ctrl-btn");
        nextBtn.setAttribute("type", "button");
        nextBtn.innerHTML = Icons.next;
        nextBtn.addEventListener("click", () => SpotiKitBridge.next());

        miniCtrl.append(prevBtn, playBtn, nextBtn);
        header.append(img, metaBox, miniCtrl);

        const lyricsBox = createEl("div", "fr-pip-lyrics");
        const prevLineEl = createEl("div", "fr-pip-lyric-prev", "");
        const activeLineEl = createEl("div", "fr-pip-lyric-active", "");
        const nextLineEl = createEl("div", "fr-pip-lyric-next", "");
        lyricsBox.append(prevLineEl, activeLineEl, nextLineEl);

        shell.append(bg, scrim, header, lyricsBox);
        pipDoc.body.appendChild(shell);

        this.pipImg = img;
        this._pipShell = shell;
        this._pipBg = bg;
        this._pipTitle = titleEl;
        this._pipArtist = artistEl;
        this._pipPrevLine = prevLineEl;
        this._pipActiveLine = activeLineEl;
        this._pipNextLine = nextLineEl;
        this._pipPlayBtn = playBtn;
        this._lastPipPrevText = "";
        this._lastPipActiveText = "";
        this._lastPipNextText = "";
        this._lastPipPlaying = SpotiKitBridge.isPlaying();

        this.updatePiPTrack(app?.currentTrack, app?.currentImage);

        pipWindow.addEventListener("pagehide", () => {
          this.pipBtn?.classList.remove("fr-active");
          this._clearPiPRefs();
        });
        this.pipBtn?.classList.add("fr-active");
      } else {
        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = 800;
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = app?.currentImage || "";
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

    this._clearPiPRefs();
    this.root?.remove();
    this.root = null;
    this.lyricsBtn = null;
    this.creatorBtn = null;
    this.pipBtn = null;
  },
};
