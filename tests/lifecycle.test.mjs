// tests/lifecycle.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { installDomStub, createSpotiKitMock } from "./helpers/domStub.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

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
  const { build } = await import(pathToFileURL(path.join(ROOT, "build.js")).href);
  build();
  const bundleUrl =
    pathToFileURL(path.join(ROOT, "fullscreen-reloaded.js")).href + `?v=${Date.now()}-${Math.random()}`;
  return import(bundleUrl);
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
