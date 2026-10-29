/**
 * Up Next preview card displaying the next song in the queue.
 */
import { el } from "../utils/dom.js";
import { t } from "../utils/i18n.js";
import { resolveImageUrl } from "../utils/formatters.js";
import { SpicetifyBridge } from "../services/SpicetifyBridge.js";

export const UpNextCard = {
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
