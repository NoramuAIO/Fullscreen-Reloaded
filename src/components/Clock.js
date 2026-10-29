/**
 * Large digital clock for cinema idle mode.
 */
import { el } from "../utils/dom.js";

export const Clock = {
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
