/**
 * Dual-layer crossfading background manager.
 */
import { el } from "../utils/dom.js";
import { rgb, rgba } from "../utils/formatters.js";
import { Settings } from "../utils/settings.js";
import { ColorExtractor } from "../services/ColorExtractor.js";

export const BackgroundManager = {
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
