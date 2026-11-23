/**
 * Liquid Glass Top Bar component (Lyrics, Picture-in-Picture, Settings, Close).
 */
import { el, iconBtn } from "../utils/dom.js";
import { Icons } from "../utils/icons.js";
import { SettingsModal } from "./SettingsModal.js";
import { FullLyricsCreator } from "./FullLyricsCreator.js";
import { SpotiKitBridge } from "../services/SpotiKitBridge.js";

export const TopBar = {
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
