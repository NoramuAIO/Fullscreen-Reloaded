/**
 * Ambient light orbs and floating particles manager.
 */
import { el } from "../utils/dom.js";
import { rgb } from "../utils/formatters.js";

export const AmbientManager = {
  root: null,
  orbs: [],
  particles: [],

  build() {
    this.root = el("div", "fr-ambient fr-show");

    const orbsCont = el("div", "");
    this.orbs = [];
    for (let i = 0; i < 3; i++) {
      const orb = el("div", "fr-orb");
      orb.style.width = orb.style.height = 40 + Math.random() * 40 + "vh";
      orb.style.top = 10 + Math.random() * 50 + "%";
      orb.style.left = 10 + Math.random() * 50 + "%";
      orb.style.animationDelay = "-" + Math.random() * 15 + "s";
      orb.style.animationDuration = 15 + Math.random() * 10 + "s";
      this.orbs.push(orb);
      orbsCont.appendChild(orb);
    }

    const partsCont = el("div", "");
    this.particles = [];
    for (let i = 0; i < 25; i++) {
      const p = el("div", "fr-particle");
      p.style.width = p.style.height = 3 + Math.random() * 4 + "px";
      p.style.left = Math.random() * 100 + "%";
      p.style.animationDuration = 12 + Math.random() * 15 + "s";
      p.style.animationDelay = "-" + Math.random() * 25 + "s";
      this.particles.push(p);
      partsCont.appendChild(p);
    }

    this.root.append(orbsCont, partsCont);
    return this.root;
  },

  updateColors(colors) {
    if (!this.root || !this.orbs.length) return;
    this.orbs[0].style.backgroundColor = rgb(colors.dominant);
    this.orbs[1].style.backgroundColor = rgb(colors.accent);
    this.orbs[2].style.backgroundColor = rgb(colors.dark);
  },

  setIdle(isIdle) {
    if (this.root) {
      this.root.classList.toggle("fr-show", !isIdle);
    }
  },
};
