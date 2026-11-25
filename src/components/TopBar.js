/**
 * Apple Music Liquid Top Bar component (Lyrics, Creator, Picture-in-Picture with Live Lyrics, Settings, Close).
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
    background: #0b0b0f; color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Helvetica, Arial, sans-serif;
    user-select: none;
  }
  .fr-pip-shell {
    position: relative; width: 100%; height: 100%;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 18px; overflow: hidden;
  }
  .fr-pip-bg {
    position: absolute; inset: -18%; background-size: cover; background-position: center;
    filter: blur(42px) saturate(1.7) brightness(0.55);
    transform: scale(1.1); transition: background-image 600ms ease; z-index: 0;
  }
  .fr-pip-scrim {
    position: absolute; inset: 0; z-index: 1;
    background: linear-gradient(180deg, rgba(10,10,16,0.28) 0%, rgba(10,10,16,0.52) 55%, rgba(8,8,14,0.82) 100%);
  }
  .fr-pip-header {
    position: relative; z-index: 2; display: flex; align-items: center; gap: 12px;
    padding: 10px 12px; border-radius: 18px;
    background: rgba(255,255,255,0.1);
    backdrop-filter: blur(28px) saturate(1.8);
    border: 1px solid rgba(255,255,255,0.2);
    box-shadow: 0 12px 30px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.26);
  }
  .fr-pip-art {
    width: 50px; height: 50px; border-radius: 12px; object-fit: cover; flex-shrink: 0;
    box-shadow: 0 6px 18px rgba(0,0,0,0.45);
    -webkit-user-drag: none; pointer-events: none;
  }
  .fr-pip-meta { min-width: 0; flex: 1; }
  .fr-pip-title {
    font-size: 14px; font-weight: 700; color: #fff;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .fr-pip-artist {
    font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.72); margin-top: 2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .fr-pip-lyrics {
    position: relative; z-index: 2; flex: 1;
    display: flex; flex-direction: column; justify-content: center; gap: 12px;
    padding: 14px 6px 6px;
  }
  .fr-pip-lyric-active {
    font-size: clamp(19px, 5.4vw, 26px); font-weight: 800; line-height: 1.24;
    letter-spacing: -0.02em; color: #ffffff;
    text-shadow: 0 2px 18px rgba(255,255,255,0.34);
    transition: opacity 280ms cubic-bezier(0.32, 0.72, 0, 1), transform 320ms cubic-bezier(0.32, 0.72, 0, 1);
  }
  .fr-pip-lyric-next {
    font-size: clamp(14px, 3.8vw, 17px); font-weight: 600; line-height: 1.3;
    color: rgba(255,255,255,0.46);
    transition: opacity 280ms ease;
  }
  .fr-pip-shell.fr-pip-no-lyrics .fr-pip-lyrics { display: none; }
  .fr-pip-shell.fr-pip-no-lyrics { padding: 0; }
  .fr-pip-shell.fr-pip-no-lyrics .fr-pip-header {
    position: absolute; inset: 0; padding: 0; border: none; border-radius: 0; background: none;
    box-shadow: none;
  }
  .fr-pip-shell.fr-pip-no-lyrics .fr-pip-art {
    width: 100%; height: 100%; border-radius: 0;
  }
  .fr-pip-shell.fr-pip-no-lyrics .fr-pip-meta { display: none; }
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
  _pipActiveLine: null,
  _pipNextLine: null,
  _lastPipActiveText: "",
  _lastPipNextText: "",

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

  _clearPiPRefs() {
    this.pipImg = null;
    this._pipShell = null;
    this._pipBg = null;
    this._pipTitle = null;
    this._pipArtist = null;
    this._pipActiveLine = null;
    this._pipNextLine = null;
    this._lastPipActiveText = "";
    this._lastPipNextText = "";
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
    const artists = SpotiKitBridge.getTrackArtists(track)
      .map((a) => a.name)
      .join(", ") || meta.artist_name || t("unknownArtist");
    if (this._pipTitle) this._pipTitle.textContent = title;
    if (this._pipArtist) this._pipArtist.textContent = artists;
  },

  updatePiPLyrics(snapshot) {
    if (!this._pipActiveLine || !this._pipNextLine) return;
    const activeText = snapshot?.isMusic
      ? "♪  •  •  •"
      : snapshot?.activeText || (snapshot ? "" : t("sidebarNoLyrics"));
    const nextText = snapshot?.nextText || "";

    if (activeText !== this._lastPipActiveText) {
      this._lastPipActiveText = activeText;
      this._pipActiveLine.textContent = activeText;
    }
    if (nextText !== this._lastPipNextText) {
      this._lastPipNextText = nextText;
      this._pipNextLine.textContent = nextText;
    }
  },

  applyPiPLyricsVisibility() {
    if (!this._pipShell) return;
    const enabled = Settings.get("pipLyrics") !== false;
    this._pipShell.classList.toggle("fr-pip-no-lyrics", !enabled);
  },

  async togglePiP(app) {
    try {
      // If Document PiP is open, close it
      if (window.documentPictureInPicture && window.documentPictureInPicture.window) {
        window.documentPictureInPicture.window.close();
        this.pipBtn?.classList.remove("fr-active");
        this._clearPiPRefs();
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
          width: 420,
          height: 460,
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
        pipDoc.body.style.backgroundColor = "#0b0b0f";
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
        header.append(img, metaBox);

        const lyricsBox = createEl("div", "fr-pip-lyrics");
        const activeLineEl = createEl("div", "fr-pip-lyric-active", "");
        const nextLineEl = createEl("div", "fr-pip-lyric-next", "");
        lyricsBox.append(activeLineEl, nextLineEl);

        shell.append(bg, scrim, header, lyricsBox);
        pipDoc.body.appendChild(shell);

        this.pipImg = img;
        this._pipShell = shell;
        this._pipBg = bg;
        this._pipTitle = titleEl;
        this._pipArtist = artistEl;
        this._pipActiveLine = activeLineEl;
        this._pipNextLine = nextLineEl;
        this._lastPipActiveText = "";
        this._lastPipNextText = "";

        this.updatePiPTrack(app?.currentTrack, app?.currentImage);

        pipWindow.addEventListener("pagehide", () => {
          this.pipBtn?.classList.remove("fr-active");
          this._clearPiPRefs();
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
