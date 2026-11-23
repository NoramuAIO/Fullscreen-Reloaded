/**
 * Fullscreen Reloaded
 * Premium Apple TV / visionOS-inspired Spotify fullscreen experience.
 * Entry point & lifecycle initialization.
 */
import { Settings } from "./utils/settings.js";
import { SpotiKitBridge } from "./services/SpotiKitBridge.js";
import { App } from "./App.js";

// CSS placeholder replaced at build time with bundled styles from src/styles/*.css
import STYLES from "./styles/index.css";

function cleanupStyle(removeStyle) {
  try {
    if (typeof removeStyle === "function") {
      removeStyle();
    } else if (removeStyle && typeof removeStyle.remove === "function") {
      removeStyle.remove();
    }
  } catch (_) {}
}

export default async function start(ctx) {
  if (ctx?.signal?.aborted) {
    return () => {};
  }

  // 1. Wait for SpotiKit APIs
  await SpotiKitBridge.waitForReady();
  if (ctx?.signal?.aborted) {
    return () => {};
  }

  // 2. Bind SpotiKit context & load stored user settings
  SpotiKitBridge.init(ctx);
  Settings.load();

  // 3. Register Liquid Glass styles via SpotiKit
  const removeStyle = ctx?.style?.(STYLES);
  if (ctx?.signal?.aborted) {
    cleanupStyle(removeStyle);
    return () => {};
  }

  // 4. Mount application overlay
  App.mount(ctx);

  let stopped = false;
  const teardown = () => {
    if (stopped) return;
    stopped = true;
    cleanupStyle(removeStyle);
    App.unmount();
  };

  ctx?.onStop?.(teardown);
  return teardown;
}
