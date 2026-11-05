/**
 * Mood-Adaptive & Beat-Reactive Atmosphere Manager.
 * Renders 4 distinct dynamic scenes ("energetic", "melancholic", "latenight", "dreamy"):
 * - Beat-reactive light orbs & aurora ribbons
 * - Mood-morphing particle system (Rising Sparks / Falling Rain / Fireflies / Soft Bokeh)
 * - Atmospheric mist & Late-Night analog grain
 */
import { el } from "../utils/dom.js";
import { rgb, rgba } from "../utils/formatters.js";
import { Settings } from "../utils/settings.js";

export const AmbientManager = {
  root: null,
  auroraWrap: null,
  orbs: [],
  particles: [],
  mistEl: null,
  grainEl: null,
  _currentMood: "",
  _isIdle: false,

  build() {
    this.root = el("div", "fr-ambient fr-show");
    this.root.setAttribute("data-mood", "dreamy");

    // 1. Aurora Wave Ribbons (vivid in Energetic & Dreamy moods)
    this.auroraWrap = el("div", "fr-mood-aurora");
    const wave1 = el("div", "fr-aurora-wave fr-aurora-1");
    const wave2 = el("div", "fr-aurora-wave fr-aurora-2");
    this.auroraWrap.append(wave1, wave2);

    // 2. Beat-Reactive Light Orbs
    const orbsCont = el("div", "fr-orbs-wrap");
    this.orbs = [];
    const orbConfigs = [
      { size: 52, top: 12, left: 14, dur: 18, delay: -4 },
      { size: 60, top: 38, left: 52, dur: 22, delay: -11 },
      { size: 46, top: 58, left: 22, dur: 25, delay: -17 },
    ];
    for (let i = 0; i < orbConfigs.length; i++) {
      const cfg = orbConfigs[i];
      const orb = el("div", `fr-orb fr-orb-${i + 1}`);
      orb.style.width = orb.style.height = `${cfg.size}vh`;
      orb.style.top = `${cfg.top}%`;
      orb.style.left = `${cfg.left}%`;
      orb.style.animationDuration = `${cfg.dur}s`;
      orb.style.animationDelay = `${cfg.delay}s`;
      this.orbs.push(orb);
      orbsCont.appendChild(orb);
    }

    // 3. Mood-Morphing Particles (Sparks / Rain / Fireflies / Bokeh)
    const partsCont = el("div", "fr-particles-wrap");
    this.particles = [];
    for (let i = 0; i < 32; i++) {
      const p = el("div", "fr-particle");
      const size = (3 + (i % 5) * 1.3).toFixed(1);
      const x = ((i * 37) % 100).toFixed(1);
      const y = ((i * 53) % 100).toFixed(1);
      const dur = (7 + (i % 9) * 1.6).toFixed(1);
      const delay = (-((i * 2.7) % 22)).toFixed(1);
      const drift = (((i % 7) - 3) * 14).toFixed(0);

      p.style.setProperty("--p-size", `${size}px`);
      p.style.setProperty("--p-x", `${x}%`);
      p.style.setProperty("--p-y", `${y}%`);
      p.style.setProperty("--p-dur", `${dur}s`);
      p.style.setProperty("--p-delay", `${delay}s`);
      p.style.setProperty("--p-drift", `${drift}px`);

      this.particles.push(p);
      partsCont.appendChild(p);
    }

    // 4. Atmospheric Mist / Vignette (deepens in Melancholic & Late-Night moods)
    this.mistEl = el("div", "fr-mood-mist");

    // 5. Late-Night Analog Film Grain Overlay
    this.grainEl = el("div", "fr-mood-grain");

    this.root.append(this.auroraWrap, orbsCont, partsCont, this.mistEl, this.grainEl);
    return this.root;
  },

  updateColors(colors) {
    if (!this.root || !colors) return;
    const dom = colors.dominant || [80, 80, 120];
    const acc = colors.accent || [140, 100, 220];
    const dark = colors.dark || [20, 20, 30];

    this.root.style.setProperty("--fr-amb-dominant", rgb(dom));
    this.root.style.setProperty("--fr-amb-accent", rgb(acc));
    this.root.style.setProperty("--fr-amb-dark", rgb(dark));
    this.root.style.setProperty("--fr-amb-accent-soft", rgba(acc, 0.55));
    this.root.style.setProperty("--fr-amb-dominant-soft", rgba(dom, 0.5));

    if (this.orbs.length >= 3) {
      this.orbs[0].style.backgroundColor = rgb(dom);
      this.orbs[1].style.backgroundColor = rgb(acc);
      this.orbs[2].style.backgroundColor = rgb(dark);
    }
  },

  /**
   * Updates 60fps beat-reactive & mood CSS variables on the ambient root and album artwork.
   */
  updateFrame(frame, artWrap) {
    if (!this.root || !frame) return;

    const mood = frame.mood || "dreamy";
    if (this._currentMood !== mood) {
      this._currentMood = mood;
      this.root.setAttribute("data-mood", mood);
    }

    const beat = frame.beatPulse || 0;
    const bar = frame.barPulse || 0;
    const energy = frame.sectionEnergy ?? 0.5;

    this.root.style.setProperty("--fr-beat", beat.toFixed(3));
    this.root.style.setProperty("--fr-bar", bar.toFixed(3));
    this.root.style.setProperty("--fr-energy", energy.toFixed(3));

    if (artWrap) {
      const beatMode = Settings.get("beatReactive") || "normal";
      if (beatMode === "off") {
        artWrap.style.setProperty("--fr-art-beat", "0");
        artWrap.style.setProperty("--fr-glow-beat", "0.55");
        artWrap.style.setProperty("--fr-glow-spread", "0%");
      } else {
        const artScale = beat * 0.022 + bar * 0.012;
        const glowOpacity = Math.min(0.95, 0.42 + beat * 0.36 + energy * 0.22);
        const glowSpread = (beat * 5.5 + bar * 3.0).toFixed(2);
        artWrap.style.setProperty("--fr-art-beat", artScale.toFixed(4));
        artWrap.style.setProperty("--fr-glow-beat", glowOpacity.toFixed(3));
        artWrap.style.setProperty("--fr-glow-spread", `${glowSpread}%`);
      }
    }
  },

  setIdle(isIdle) {
    this._isIdle = !!isIdle;
    if (this.root) {
      // Keep ambient mood visible even in idle mode (just slightly calmer) unless turned off
      this.root.classList.toggle("fr-idle-calm", !!isIdle);
    }
  },
};
