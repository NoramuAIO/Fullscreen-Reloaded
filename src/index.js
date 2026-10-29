/**
 * Fullscreen Reloaded
 * Premium Apple TV / visionOS-inspired Spotify fullscreen experience.
 * Entry point & lifecycle initialization.
 */
import { Settings } from "./utils/settings.js";
import { SpicetifyBridge } from "./services/SpicetifyBridge.js";
import { App } from "./App.js";

// CSS placeholder replaced at build time with bundled styles from src/styles/*.css
import STYLES from "./styles/index.css";

function injectStyles() {
  const ID = "fullscreen-reloaded-styles";
  if (document.getElementById(ID)) return;
  const style = document.createElement("style");
  style.id = ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

async function bootstrap() {
  // 1. Wait for Spicetify Player & Platform APIs (Spotify 1.3.6 compatible)
  await SpicetifyBridge.waitForReady();

  // 2. Load stored user settings
  Settings.load();

  // 3. Inject Liquid Glass styles
  injectStyles();

  // 4. Mount application overlay
  App.mount();

  console.log("[Fullscreen Reloaded] v1.3.6 initialized successfully");
}

bootstrap().catch((err) => {
  console.error("[Fullscreen Reloaded] Failed to bootstrap:", err);
});
