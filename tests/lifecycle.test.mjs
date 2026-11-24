// tests/lifecycle.test.mjs
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { installDomStub, createSpotiKitMock } from "./helpers/domStub.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const tempBundleDirs = [];

after(() => {
  for (const dir of tempBundleDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempBundleDirs.length = 0;
});

function createLifecycleEnv(overrides = {}) {
  const dom = installDomStub();
  const mock = createSpotiKitMock(overrides);
  const prevSpotiKitDesc = Object.getOwnPropertyDescriptor(globalThis, "SpotiKit");
  const prevFetchDesc = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  const prevResizeObsDesc = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  const prevImageDesc = Object.getOwnPropertyDescriptor(globalThis, "Image");

  Object.defineProperty(globalThis, "SpotiKit", {
    configurable: true,
    writable: true,
    value: mock.SpotiKit,
  });

  const observerInstances = [];
  class MockResizeObserver {
    constructor(cb) {
      this.cb = cb;
      this.observed = [];
      this.disconnected = false;
      observerInstances.push(this);
    }
    observe(target) {
      this.observed.push(target);
    }
    unobserve() {}
    disconnect() {
      this.disconnected = true;
    }
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: MockResizeObserver,
  });

  // Track timers & RAFs created after env setup
  const origSetTimeout = globalThis.setTimeout;
  const origClearTimeout = globalThis.clearTimeout;
  const origSetInterval = globalThis.setInterval;
  const origClearInterval = globalThis.clearInterval;
  const origRaf = globalThis.requestAnimationFrame;
  const origCancelRaf = globalThis.cancelAnimationFrame;

  const activeTimeouts = new Set();
  const activeIntervals = new Set();
  const activeRafs = new Set();

  globalThis.setTimeout = (fn, ms, ...args) => {
    const id = origSetTimeout(() => {
      activeTimeouts.delete(id);
      fn(...args);
    }, ms);
    activeTimeouts.add(id);
    return id;
  };
  globalThis.clearTimeout = (id) => {
    activeTimeouts.delete(id);
    return origClearTimeout(id);
  };
  globalThis.setInterval = (fn, ms, ...args) => {
    const id = origSetInterval(fn, ms, ...args);
    activeIntervals.add(id);
    return id;
  };
  globalThis.clearInterval = (id) => {
    activeIntervals.delete(id);
    return origClearInterval(id);
  };
  globalThis.requestAnimationFrame = (cb) => {
    const id = origRaf((ts) => {
      activeRafs.delete(id);
      cb(ts);
    });
    activeRafs.add(id);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    activeRafs.delete(id);
    return origCancelRaf(id);
  };

  return {
    dom,
    mock,
    observerInstances,
    activeTimeouts,
    activeIntervals,
    activeRafs,
    setFetch(fn) {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        writable: true,
        value: fn,
      });
    },
    teardown() {
      for (const id of [...activeTimeouts]) origClearTimeout(id);
      for (const id of [...activeIntervals]) origClearInterval(id);
      for (const id of [...activeRafs]) origCancelRaf(id);
      globalThis.setTimeout = origSetTimeout;
      globalThis.clearTimeout = origClearTimeout;
      globalThis.setInterval = origSetInterval;
      globalThis.clearInterval = origClearInterval;
      globalThis.requestAnimationFrame = origRaf;
      globalThis.cancelAnimationFrame = origCancelRaf;

      mock.reset();
      if (prevSpotiKitDesc === undefined) delete globalThis.SpotiKit;
      else Object.defineProperty(globalThis, "SpotiKit", prevSpotiKitDesc);
      if (prevFetchDesc === undefined) delete globalThis.fetch;
      else Object.defineProperty(globalThis, "fetch", prevFetchDesc);
      if (prevResizeObsDesc === undefined) delete globalThis.ResizeObserver;
      else Object.defineProperty(globalThis, "ResizeObserver", prevResizeObsDesc);
      if (prevImageDesc === undefined) delete globalThis.Image;
      else Object.defineProperty(globalThis, "Image", prevImageDesc);
      dom.reset();
    },
  };
}

async function importFreshBundle() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fr-lifecycle-test-"));
  tempBundleDirs.push(tmpDir);
  const tmpOut = path.join(tmpDir, "fullscreen-reloaded.mjs");
  const { build } = await import(pathToFileURL(path.join(ROOT, "build.js")).href);
  build({ outFile: tmpOut });
  return import(pathToFileURL(tmpOut).href);
}

test("startAndStopLifecycle: bundled start(ctx) mounts, toggles via fullscreen button & Escape, tears down cleanly, and restarts isolated", async () => {
  const profileItems = [];
  const styleCalls = [];
  const env = createLifecycleEnv({
    ProfileMenu: {
      add(item) {
        profileItems.push(item);
        return () => {
          const idx = profileItems.indexOf(item);
          if (idx !== -1) profileItems.splice(idx, 1);
        };
      },
    },
  });

  const origStyle = env.mock.ctx.style.bind(env.mock.ctx);
  env.mock.ctx.style = (css) => {
    styleCalls.push(css);
    return origStyle(css);
  };

  try {
    // Provide native Spotify fullscreen button
    const fsBtn = document.createElement("button");
    fsBtn.setAttribute("data-testid", "fullscreen-mode-button");
    document.body.appendChild(fsBtn);

    const mod = await importFreshBundle();
    assert.equal(typeof mod.default, "function");

    const stop = await mod.default(env.mock.ctx);
    assert.equal(typeof stop, "function");

    // 1. Style registered once with #fullscreen-reloaded-root
    assert.equal(styleCalls.length, 1);
    assert.match(styleCalls[0], /#fullscreen-reloaded-root/);
    assert.equal(document.head.querySelectorAll("style").length, 1);

    // 2. Root mounted & ProfileMenu registered
    const root1 = document.getElementById("fullscreen-reloaded-root");
    assert.ok(root1);
    assert.equal(root1.classList.contains("fr-open"), false);
    assert.equal(profileItems.length, 1);
    assert.equal(profileItems[0].label, "Fullscreen Reloaded");
    assert.equal(env.observerInstances.length, 1);
    assert.equal(env.observerInstances[0].disconnected, false);

    // 3. Click native fullscreen button -> opens overlay; Escape -> closes overlay
    fsBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(root1.classList.contains("fr-open"), true);
    assert.equal(document.body.style.overflow, "hidden");

    document.dispatchEvent(new CustomEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    assert.equal(root1.classList.contains("fr-open"), false);
    assert.equal(document.body.style.overflow, "");

    // Open once more to make sure timers/RAF/Clock are active before stop()
    fsBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(root1.classList.contains("fr-open"), true);

    // 4. Stop and abort ctx.signal -> complete teardown
    stop();
    env.mock.abortController.abort();
    // Idempotent second stop()
    stop();

    assert.equal(document.getElementById("fullscreen-reloaded-root"), null);
    assert.equal(document.head.querySelectorAll("style").length, 0);
    assert.equal(document.body.style.overflow, "");
    assert.equal(profileItems.length, 0);
    assert.equal(env.observerInstances[0].disconnected, true);
    assert.equal(env.activeIntervals.size, 0);
    assert.equal(env.activeRafs.size, 0);
    assert.equal(env.activeTimeouts.size, 0);

    // Clicking native fullscreen button after teardown does nothing
    fsBtn.click();
    assert.equal(document.getElementById("fullscreen-reloaded-root"), null);

    // 5. Re-invoke start(ctx2) on same bundle module -> fresh isolated instance
    const profileItems2 = [];
    const mock2 = createSpotiKitMock({
      ProfileMenu: {
        add(item) {
          profileItems2.push(item);
          return () => {
            const idx = profileItems2.indexOf(item);
            if (idx !== -1) profileItems2.splice(idx, 1);
          };
        },
      },
    });
    Object.defineProperty(globalThis, "SpotiKit", {
      configurable: true,
      writable: true,
      value: mock2.SpotiKit,
    });

    const stop2 = await mod.default(mock2.ctx);
    try {
      const roots = document.querySelectorAll("#fullscreen-reloaded-root");
      assert.equal(roots.length, 1);
      assert.equal(profileItems2.length, 1);

      fsBtn.click();
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(roots[0].classList.contains("fr-open"), true);
    } finally {
      stop2();
      mock2.reset();
    }

    // 6. Pre-aborted or mid-ready-aborted context exits cleanly without mounting
    let resolveReady;
    const mockAborted = createSpotiKitMock({
      ready: new Promise((r) => {
        resolveReady = r;
      }),
    });
    Object.defineProperty(globalThis, "SpotiKit", {
      configurable: true,
      writable: true,
      value: mockAborted.SpotiKit,
    });
    const startPromise = mod.default(mockAborted.ctx);
    mockAborted.abortController.abort();
    resolveReady();
    const noopStop = await startPromise;
    assert.equal(typeof noopStop, "function");
    assert.equal(document.getElementById("fullscreen-reloaded-root"), null);
    assert.equal(document.head.querySelectorAll("style").length, 0);
    noopStop();
    mockAborted.reset();
  } finally {
    env.teardown();
  }
});

test("playbarFallbackOnlyWhenNativeMissing: registers Playbar item only when native fullscreen button is absent", async () => {
  const playbarItems = [];
  const env = createLifecycleEnv({
    Playbar: {
      add(item) {
        const entry = { ...item, active: Boolean(item?.active), removed: false };
        playbarItems.push(entry);
        return {
          setActive(v) {
            entry.active = Boolean(v);
          },
          remove() {
            entry.removed = true;
          },
        };
      },
    },
  });

  try {
    const mod = await importFreshBundle();

    // Case 1: Native fullscreen button exists -> Playbar.add NOT called
    const fsBtn = document.createElement("button");
    fsBtn.setAttribute("data-testid", "fullscreen-mode-button");
    document.body.appendChild(fsBtn);

    const stop1 = await mod.default(env.mock.ctx);
    assert.equal(playbarItems.length, 0);
    stop1();
    fsBtn.remove();

    // Case 2: Native fullscreen button absent -> Playbar.add IS called, active syncs, removed on stop
    const mock2 = createSpotiKitMock({
      Playbar: {
        add(item) {
          const entry = { ...item, active: Boolean(item?.active), removed: false };
          playbarItems.push(entry);
          return {
            setActive(v) {
              entry.active = Boolean(v);
            },
            remove() {
              entry.removed = true;
            },
          };
        },
      },
    });
    Object.defineProperty(globalThis, "SpotiKit", {
      configurable: true,
      writable: true,
      value: mock2.SpotiKit,
    });

    const stop2 = await mod.default(mock2.ctx);
    try {
      assert.equal(playbarItems.length, 1);
      assert.equal(playbarItems[0].label, "Fullscreen Reloaded");
      assert.equal(playbarItems[0].active, false);

      await playbarItems[0].onClick();
      const root = document.getElementById("fullscreen-reloaded-root");
      assert.equal(root.classList.contains("fr-open"), true);
      assert.equal(playbarItems[0].active, true);

      await playbarItems[0].onClick();
      assert.equal(root.classList.contains("fr-open"), false);
      assert.equal(playbarItems[0].active, false);

      stop2();
      assert.equal(playbarItems[0].removed, true);
    } finally {
      mock2.reset();
    }
  } finally {
    env.teardown();
  }
});

test("languageSwitchWithoutReload: switching language via UI and Settings.set rebuilds in-place without location.reload", async () => {
  const env = createLifecycleEnv();
  let reloadCalls = 0;
  env.dom.window.location.reload = () => {
    reloadCalls++;
  };
  globalThis.location.reload = () => {
    reloadCalls++;
  };

  try {
    const [{ SpotiKitBridge }, { App }, { Settings }, { SettingsModal }] = await Promise.all([
      import(pathToFileURL(path.join(ROOT, "src/services/SpotiKitBridge.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/App.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/utils/settings.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/components/SettingsModal.js")).href),
    ]);

    await SpotiKitBridge.waitForReady();
    SpotiKitBridge.init(env.mock.ctx);
    Settings.load();
    Settings.set("language", "en");
    App.mount(env.mock.ctx);

    try {
      await App.launch();
      SettingsModal.toggleOpen();

      assert.equal(App.open, true);
      assert.equal(SettingsModal.root.classList.contains("fr-show"), true);
      assert.match(SettingsModal.root.textContent, /Background/);
      assert.match(SettingsModal.root.textContent, /Appearance/);

      // Click the "Türkçe" option in SettingsModal's language dropdown
      const trItem = SettingsModal.root
        .querySelectorAll(".fr-select-item")
        .find((item) => item.textContent.includes("Türkçe"));
      assert.ok(trItem, "Expected Turkish language item in SettingsModal");
      trItem.click();
      await new Promise((r) => setTimeout(r, 15));

      assert.equal(reloadCalls, 0);
      assert.equal(App.open, true);
      assert.equal(App.root.classList.contains("fr-open"), true);
      assert.equal(SettingsModal.root.classList.contains("fr-show"), true);
      assert.match(SettingsModal.root.textContent, /Arka Plan/);
      assert.match(SettingsModal.root.textContent, /Görünüm/);
      assert.match(App.root.textContent, /Enstrümantal/);

      // Verify CustomSelect and CustomColorPicker global listeners re-registered cleanly after rebuildForLanguage()
      const firstSelect = SettingsModal.root.querySelector(".fr-select-wrap");
      const firstSelectBtn = firstSelect.querySelector(".fr-select-btn");
      firstSelectBtn.click();
      assert.equal(firstSelect.classList.contains("fr-open"), true);
      document.body.click();
      assert.equal(firstSelect.classList.contains("fr-open"), false);

      const colorPicker = SettingsModal.root.querySelector(".fr-color-picker-wrap");
      const colorBtn = colorPicker.querySelector(".fr-color-swatch-btn");
      colorBtn.click();
      assert.equal(colorPicker.classList.contains("fr-open"), true);
      document.body.click();
      assert.equal(colorPicker.classList.contains("fr-open"), false);

      // Switch back to English via Settings.set("language", "en")
      Settings.set("language", "en");
      await new Promise((r) => setTimeout(r, 15));

      assert.equal(reloadCalls, 0);
      assert.equal(App.open, true);
      assert.equal(App.root.classList.contains("fr-open"), true);
      assert.equal(SettingsModal.root.classList.contains("fr-show"), true);
      assert.match(SettingsModal.root.textContent, /Background/);
      assert.match(App.root.textContent, /Instrumental/);
    } finally {
      App.unmount();
    }
  } finally {
    env.teardown();
  }
});

test("abortMidTrackChange: stopping during pending async track fetch skips post-stop DOM updates without throwing", async () => {
  let resolveLyrics;
  const pendingLyricsPromise = new Promise((resolve) => {
    resolveLyrics = resolve;
  });

  let resolveAudio;
  const pendingAudioPromise = new Promise((resolve) => {
    resolveAudio = resolve;
  });

  const env = createLifecycleEnv({
    Http: {
      get: async () => pendingLyricsPromise,
    },
    Audio: {
      analysis: async () => pendingAudioPromise,
    },
  });

  let resolveImage;
  globalThis.Image = class DeferredImage {
    constructor() {
      this.onload = null;
      this.onerror = null;
    }
    set src(_val) {
      resolveImage = () => {
        if (this.onerror) this.onerror(new Error("aborted"));
      };
    }
  };

  try {
    const [{ SpotiKitBridge }, { App }, { Settings }] = await Promise.all([
      import(pathToFileURL(path.join(ROOT, "src/services/SpotiKitBridge.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/App.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/utils/settings.js")).href),
    ]);

    await SpotiKitBridge.waitForReady();
    SpotiKitBridge.init(env.mock.ctx);
    Settings.load();
    Settings.set("lyricsProvider", "spotify");
    App.mount(env.mock.ctx);

    env.mock.emitTrack({
      uri: "spotify:track:midabort1",
      name: "Mid Abort Track",
      metadata: {
        title: "Mid Abort Track",
        artist_name: "Test Artist",
        album_title: "Test Album",
        image_xlarge_url: "https://i.scdn.co/image/midabort1",
        duration: 180000,
      },
    });

    // Give async onTrackChange a tick to reach pending awaits
    await new Promise((r) => setTimeout(r, 10));

    // Stop and abort while fetches & image extraction are still pending
    App.unmount();
    env.mock.abortController.abort();

    assert.equal(document.getElementById("fullscreen-reloaded-root"), null);
    assert.equal(App._mounted, false);

    // Resolve all pending promises post-stop
    resolveLyrics({
      lyrics: {
        syncType: "LINE_SYNCED",
        lines: [{ startTimeMs: "1000", words: "Should not attach" }],
      },
    });
    resolveAudio({ track: { tempo: 120 }, segments: [] });
    if (resolveImage) resolveImage();

    await new Promise((r) => setTimeout(r, 25));

    assert.equal(document.getElementById("fullscreen-reloaded-root"), null);
    assert.equal(App._mounted, false);
  } finally {
    env.teardown();
  }
});

test("componentCleanupAndRepeatMode: BottomDock repeat state & drag abort, TopBar PiP close, and FullLyricsCreator destroy", async () => {
  const env = createLifecycleEnv({
    Player: { repeat: "off" },
  });

  let pipWindowClosed = false;
  let exitPipCalls = 0;
  env.dom.window.documentPictureInPicture = {
    window: {
      close() {
        pipWindowClosed = true;
      },
    },
  };
  env.dom.document.pictureInPictureElement = {};
  env.dom.document.exitPictureInPicture = async () => {
    exitPipCalls++;
  };

  try {
    const [
      { SpotiKitBridge },
      { App },
      { Settings },
      { BottomDock },
      { TopBar },
      { FullLyricsCreator },
      { CHANGE_EVENT },
    ] = await Promise.all([
      import(pathToFileURL(path.join(ROOT, "src/services/SpotiKitBridge.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/App.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/utils/settings.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/components/BottomDock.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/components/TopBar.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/components/FullLyricsCreator.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/services/CustomSyncStorage.js")).href),
    ]);

    await SpotiKitBridge.waitForReady();
    SpotiKitBridge.init(env.mock.ctx);
    Settings.load();
    App.mount(env.mock.ctx);

    // 1. Verify repeat === "off" does NOT set fr-active, while "context" and "track" DO
    BottomDock.tick();
    assert.equal(BottomDock.repeatBtn.classList.contains("fr-active"), false);
    assert.equal(BottomDock.repeatBtn.getAttribute("data-repeat"), "off");

    env.mock.SpotiKit.Player.repeat = "context";
    BottomDock.tick();
    assert.equal(BottomDock.repeatBtn.classList.contains("fr-active"), true);
    assert.equal(BottomDock.repeatBtn.getAttribute("data-repeat"), "context");

    env.mock.SpotiKit.Player.repeat = "track";
    BottomDock.tick();
    assert.equal(BottomDock.repeatBtn.classList.contains("fr-active"), true);
    assert.equal(BottomDock.repeatBtn.getAttribute("data-repeat"), "track");

    // 2. Open FullLyricsCreator, trigger toast + RAF loop, then tear down mid-drag
    await FullLyricsCreator.openForCurrentTrack();
    FullLyricsCreator.showToast("Testing toast timer");
    assert.equal(FullLyricsCreator.isOpen, true);
    assert.ok(FullLyricsCreator._rafId);
    assert.ok(FullLyricsCreator._keyHandler);
    assert.ok(FullLyricsCreator._toastTimer);

    const progBar = BottomDock.root.querySelector(".fr-progress-bar");
    progBar.dispatchEvent(new CustomEvent("mousedown", { bubbles: true, clientX: 10 }));
    assert.equal(BottomDock.seeking, true);

    App.unmount();

    assert.equal(BottomDock.seeking, false);
    assert.equal(pipWindowClosed, true);
    assert.equal(exitPipCalls, 1);
    assert.equal(TopBar.root, null);
    assert.equal(FullLyricsCreator.isOpen, false);
    assert.equal(FullLyricsCreator._rafId, null);
    assert.equal(FullLyricsCreator._keyHandler, null);
    assert.equal(FullLyricsCreator._toastTimer, null);
    assert.equal(FullLyricsCreator.root, null);
    assert.equal(App._mounted, false);
    assert.equal(env.activeRafs.size, 0);
    assert.equal(env.activeTimeouts.size, 0);

    // Subsequent mousemove / CHANGE_EVENT should not throw after destroy()
    window.dispatchEvent(new CustomEvent("mousemove", { clientX: 50 }));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } finally {
    env.teardown();
  }
});

test("overlappingOnTrackChange: slow Track A color extraction finishing after Track B does not overwrite Track B", async () => {
  const env = createLifecycleEnv();
  const [{ SpotiKitBridge }, { App }, { Settings }, { BackgroundManager }, { AmbientManager }, { ColorExtractor }] =
    await Promise.all([
      import(pathToFileURL(path.join(ROOT, "src/services/SpotiKitBridge.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/App.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/utils/settings.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/components/BackgroundManager.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/components/AmbientManager.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/services/ColorExtractor.js")).href),
    ]);

  const origExtract = ColorExtractor.extract;
  let resolveTrackA;
  const trackAColorsPromise = new Promise((resolve) => {
    resolveTrackA = resolve;
  });

  ColorExtractor.extract = async (url) => {
    if (String(url).includes("track-a")) {
      return trackAColorsPromise;
    }
    return { dominant: [0, 60, 20], accent: [0, 255, 0], dark: [0, 20, 10] };
  };

  try {
    await SpotiKitBridge.waitForReady();
    SpotiKitBridge.init(env.mock.ctx);
    Settings.load();
    App.mount(env.mock.ctx);

    // Emit Track A (slow color extraction)
    env.mock.emitTrack({
      uri: "spotify:track:a",
      name: "Track A",
      metadata: {
        title: "Track A",
        artist_name: "Artist A",
        image_xlarge_url: "https://example.com/track-a.jpg",
      },
    });
    const staleOnload = App.artImgAlt.onload;
    await new Promise((r) => setTimeout(r, 10));

    // Emit Track B (fast color extraction) while Track A is still pending
    env.mock.emitTrack({
      uri: "spotify:track:b",
      name: "Track B",
      metadata: {
        title: "Track B",
        artist_name: "Artist B",
        image_xlarge_url: "https://example.com/track-b.jpg",
      },
    });
    await new Promise((r) => setTimeout(r, 15));

    assert.equal(App.root.style.getPropertyValue("--fr-word-accent"), "rgb(0, 255, 0)");
    assert.equal(AmbientManager.root.style.getPropertyValue("--fr-amb-accent"), "rgb(0, 255, 0)");
    assert.equal(BackgroundManager.activeIsA, false);
    assert.equal(BackgroundManager.layerB.classList.contains("fr-bg-active"), true);

    // Now resolve stale Track A extraction and fire stale image onload
    resolveTrackA({ dominant: [60, 0, 0], accent: [255, 0, 0], dark: [20, 0, 0] });
    staleOnload?.();
    await new Promise((r) => setTimeout(r, 20));

    assert.equal(App.root.style.getPropertyValue("--fr-word-accent"), "rgb(0, 255, 0)");
    assert.equal(AmbientManager.root.style.getPropertyValue("--fr-amb-accent"), "rgb(0, 255, 0)");
    assert.equal(BackgroundManager.activeIsA, false);
    assert.equal(BackgroundManager.layerB.classList.contains("fr-bg-active"), true);
    assert.equal(BackgroundManager.layerA.classList.contains("fr-bg-active"), false);
    assert.equal(App.artActiveIsImg, true);

    App.unmount();
  } finally {
    ColorExtractor.extract = origExtract;
    env.teardown();
  }
});

test("backgroundUpdateAcrossRebuildAndUnmount: pending BackgroundManager.update does not mutate rebuilt or detached layers", async () => {
  const env = createLifecycleEnv();
  const [{ SpotiKitBridge }, { App }, { Settings }, { BackgroundManager }, { ColorExtractor }] =
    await Promise.all([
      import(pathToFileURL(path.join(ROOT, "src/services/SpotiKitBridge.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/App.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/utils/settings.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/components/BackgroundManager.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/services/ColorExtractor.js")).href),
    ]);

  const origExtract = ColorExtractor.extract;
  let resolveSlow1;
  let resolveSlow2;
  const slow1 = new Promise((resolve) => {
    resolveSlow1 = resolve;
  });
  const slow2 = new Promise((resolve) => {
    resolveSlow2 = resolve;
  });

  ColorExtractor.extract = async (url) => {
    if (url === "https://example.com/slow-1.jpg") return slow1;
    if (url === "https://example.com/slow-2.jpg") return slow2;
    return { dominant: [20, 20, 20], accent: [255, 255, 255], dark: [10, 10, 10] };
  };

  try {
    await SpotiKitBridge.waitForReady();
    SpotiKitBridge.init(env.mock.ctx);
    Settings.load();
    App.mount(env.mock.ctx);
    await App.launch();

    // Case 1: Pending update across rebuildForLanguage()
    const pending1 = BackgroundManager.update("https://example.com/slow-1.jpg");
    await App.rebuildForLanguage();

    const rebuiltLayerA = BackgroundManager.layerA;
    const rebuiltLayerB = BackgroundManager.layerB;
    assert.equal(BackgroundManager.activeIsA, true);
    assert.equal(rebuiltLayerA.classList.contains("fr-bg-active"), true);
    assert.equal(rebuiltLayerB.classList.contains("fr-bg-active"), false);

    resolveSlow1({ dominant: [200, 10, 10], accent: [255, 0, 0], dark: [50, 0, 0] });
    const res1 = await pending1;
    assert.equal(res1, null);
    assert.equal(BackgroundManager.activeIsA, true);
    assert.equal(rebuiltLayerA.classList.contains("fr-bg-active"), true);
    assert.equal(rebuiltLayerB.classList.contains("fr-bg-active"), false);
    assert.equal(rebuiltLayerB.style.backgroundImage, "");
    assert.equal(rebuiltLayerB.style.backgroundColor, "");

    // Case 2: Pending update across App.unmount()
    const detachedLayerA = BackgroundManager.layerA;
    const detachedLayerB = BackgroundManager.layerB;
    const pending2 = BackgroundManager.update("https://example.com/slow-2.jpg");
    App.unmount();

    assert.equal(BackgroundManager.root, null);
    assert.equal(BackgroundManager.layerA, null);
    assert.equal(BackgroundManager.layerB, null);
    assert.equal(BackgroundManager.activeIsA, true);

    resolveSlow2({ dominant: [10, 200, 10], accent: [0, 255, 0], dark: [0, 50, 0] });
    const res2 = await pending2;
    assert.equal(res2, null);
    assert.equal(BackgroundManager.activeIsA, true);
    assert.equal(detachedLayerA.classList.contains("fr-bg-active"), true);
    assert.equal(detachedLayerB.classList.contains("fr-bg-active"), false);
    assert.equal(detachedLayerB.style.backgroundImage, "");
    assert.equal(detachedLayerB.style.backgroundColor, "");
  } finally {
    ColorExtractor.extract = origExtract;
    env.teardown();
  }
});

test("topBarPipStopGuard: closes orphaned pipWindow if extension stops while requestWindow is pending", async () => {
  const env = createLifecycleEnv();
  let resolvePipWindow;
  const pipPromise = new Promise((resolve) => {
    resolvePipWindow = resolve;
  });

  let closed = false;
  let appendCalls = 0;
  const fakePipWindow = {
    document: {
      body: {
        style: {},
        appendChild() {
          appendCalls++;
        },
      },
    },
    addEventListener() {},
    close() {
      closed = true;
    },
  };

  env.dom.window.documentPictureInPicture = {
    window: null,
    requestWindow: async () => pipPromise,
  };

  try {
    const [{ SpotiKitBridge }, { TopBar }] = await Promise.all([
      import(pathToFileURL(path.join(ROOT, "src/services/SpotiKitBridge.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/components/TopBar.js")).href),
    ]);

    SpotiKitBridge.init(env.mock.ctx);
    const bar = TopBar.build({
      currentImage: "https://example.com/art.jpg",
      toggleLyricsVisible() {},
      close() {},
    });
    document.body.appendChild(bar);

    const togglePromise = TopBar.togglePiP({ currentImage: "https://example.com/art.jpg" });
    TopBar.destroy();
    env.mock.abortController.abort();

    resolvePipWindow(fakePipWindow);
    await togglePromise;

    assert.equal(closed, true);
    assert.equal(appendCalls, 0);
    assert.equal(TopBar.pipImg, null);
  } finally {
    env.teardown();
  }
});

test("letterByLetterWordSyncedAnimationAndLiveToggle: animates characters progressively and toggles live from Settings UI without refetch", async () => {
  let progressMs = 1000;
  let fetchCount = 0;
  const track = {
    uri: "spotify:track:lettertest1",
    name: "Letter Test",
    artists: [{ name: "Test Artist" }],
    metadata: {
      title: "Letter Test",
      artist_name: "Test Artist",
      album_title: "Test Album",
      duration: 180000,
    },
  };
  const env = createLifecycleEnv({
    Locale: { language: "en-US" },
    Player: {
      track,
      state: { item: track },
      position: progressMs,
      duration: 180000,
    },
  });
  env.dom.window.SpotiKit = env.mock.SpotiKit;

  const [{ SpotiKitBridge }, { App }, { LyricsService }, { LyricsView }, { Settings }, { Locales }] =
    await Promise.all([
      import(pathToFileURL(path.join(ROOT, "src/services/SpotiKitBridge.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/App.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/services/LyricsService.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/components/LyricsView.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/utils/settings.js")).href),
      import(pathToFileURL(path.join(ROOT, "src/utils/i18n.js")).href),
    ]);

  const origResolve = LyricsService.resolve.bind(LyricsService);
  LyricsService.resolve = async () => {
    fetchCount++;
    return {
      type: "word-synced",
      source: "Apple Music",
      lines: [
        {
          startMs: 1000,
          endMs: 3200,
          hasLineTime: true,
          isWordSynced: true,
          words: [
            {
              text: "Şarkı ",
              startMs: 1000,
              endMs: 2200,
              syllables: [
                { text: "Şar", startMs: 1000, endMs: 1500 },
                { text: "kı", startMs: 1500, endMs: 2200 },
              ],
            },
            {
              text: "سلام",
              startMs: 2200,
              endMs: 3000,
            },
          ],
        },
      ],
    };
  };

  let reloadCount = 0;
  env.dom.window.location.reload = () => {
    reloadCount++;
  };

  try {
    await SpotiKitBridge.waitForReady();
    SpotiKitBridge.init(env.mock.ctx);
    Settings.load();
    App.mount(env.mock.ctx);
    await App.launch();

    assert.equal(fetchCount, 1);
    assert.equal(Settings.get("letterByLetter"), true);
    assert.equal(LyricsView.scrollEl.classList.contains("fr-letter-mode"), true);

    const words = App.root.querySelectorAll(".fr-lyric-word");
    assert.equal(words.length, 2);
    assert.equal(words[0].classList.contains("fr-word-letters"), true);
    // Arabic RTL word falls back cleanly to whole-word sweep without breaking glyph shaping
    assert.equal(words[1].classList.contains("fr-word-letters"), false);

    const chars = words[0].querySelectorAll(".fr-char");
    assert.equal(chars.length, 5);
    assert.deepEqual(
      chars.map((c) => c.textContent),
      ["Ş", "a", "r", "k", "ı"]
    );

    // Mid-word playback: earlier characters completed/active while wave lifts crest cleanly
    progressMs = 1600;
    env.mock.SpotiKit.Player.position = progressMs;
    LyricsView.update(progressMs, true);
    assert.equal(words[0].classList.contains("fr-w-active"), true);
    assert.equal(chars[0].classList.contains("fr-c-done"), true);
    assert.ok(chars[3].classList.contains("fr-c-active") || chars[3].classList.contains("fr-c-done"));
    assert.ok(chars[3].style.getPropertyValue("--c-lift"));
    assert.ok(chars[3].style.getPropertyValue("--c-glow"));

    // Rewind before word start clears per-letter classes and inline properties cleanly
    progressMs = 900;
    env.mock.SpotiKit.Player.position = progressMs;
    LyricsView.update(progressMs, true);
    for (const c of chars) {
      assert.equal(c.classList.contains("fr-c-active"), false);
      assert.equal(c.classList.contains("fr-c-done"), false);
      assert.equal(c.style.getPropertyValue("--c-pct"), "");
      assert.equal(c.style.getPropertyValue("--c-lift"), "");
      assert.equal(c.style.getPropertyValue("--c-glow"), "");
    }

    // Live toggle OFF via Settings UI toggle button (no page reload, no lyrics refetch)
    const rows = App.root.querySelectorAll(".fr-settings-row");
    const letterRow = rows.find((r) => r.textContent.includes(Locales.en.letterByLetter));
    assert.ok(letterRow);
    const toggleBtn = letterRow.querySelector("button.fr-toggle");
    assert.ok(toggleBtn);
    assert.equal(toggleBtn.classList.contains("fr-on"), true);

    toggleBtn.click();
    assert.equal(Settings.get("letterByLetter"), false);
    assert.equal(reloadCount, 0);
    assert.equal(fetchCount, 1);
    assert.equal(LyricsView.scrollEl.classList.contains("fr-letter-mode"), false);
    assert.equal(App.root.querySelectorAll(".fr-char").length, 0);

    // Classic word sweep still drives --w-pct when letterByLetter is false
    progressMs = 1600;
    env.mock.SpotiKit.Player.position = progressMs;
    LyricsView.update(progressMs, true);
    const classicWord = App.root.querySelector(".fr-lyric-word");
    assert.equal(classicWord.classList.contains("fr-w-active"), true);
    assert.ok(classicWord.style.getPropertyValue("--w-pct"));

    // Toggle back ON restores per-letter spans immediately at current playback time
    toggleBtn.click();
    assert.equal(Settings.get("letterByLetter"), true);
    assert.equal(LyricsView.scrollEl.classList.contains("fr-letter-mode"), true);
    assert.equal(App.root.querySelectorAll(".fr-char").length, 5);
    assert.equal(fetchCount, 1);

    // Restored at current progressMs (1600) -> characters already reflect playback progression
    const restoredChars = App.root.querySelectorAll(".fr-char");
    assert.equal(restoredChars[0].classList.contains("fr-c-done"), true);

    App.unmount();
  } finally {
    LyricsService.resolve = origResolve;
    env.teardown();
  }
});

test("zeroLegacySpicetifyRefs: no literal Spicetify.<Letter> tokens exist across src or tests", () => {
  const dirs = [path.join(ROOT, "src"), path.join(ROOT, "tests")];
  const files = [path.join(ROOT, "build.js")];
  const collect = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(full);
      else if (/\.(m?js|css)$/.test(entry.name)) files.push(full);
    }
  };
  dirs.forEach(collect);

  const forbidden = new RegExp("Spicetify" + "\\.[A-Za-z]");
  const offenders = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    if (forbidden.test(content)) {
      offenders.push(path.relative(ROOT, file));
    }
  }
  assert.deepEqual(offenders, []);
});
