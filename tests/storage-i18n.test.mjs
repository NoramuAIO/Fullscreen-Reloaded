// tests/storage-i18n.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { installDomStub, createSpotiKitMock } from "./helpers/domStub.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

async function loadModules() {
  const [{ SpotiKitBridge }, { Settings }, { Locales, t }, { AppleMusicAuth }] = await Promise.all([
    import(pathToFileURL(path.join(ROOT, "src/services/SpotiKitBridge.js")).href),
    import(pathToFileURL(path.join(ROOT, "src/utils/settings.js")).href),
    import(pathToFileURL(path.join(ROOT, "src/utils/i18n.js")).href),
    import(pathToFileURL(path.join(ROOT, "src/services/AppleMusicAuth.js")).href),
  ]);
  return { SpotiKitBridge, Settings, Locales, t, AppleMusicAuth };
}

function setupEnv(overrides = {}) {
  const dom = installDomStub();
  const mock = createSpotiKitMock(overrides);
  const prevSpotiKitDesc = Object.getOwnPropertyDescriptor(globalThis, "SpotiKit");
  Object.defineProperty(globalThis, "SpotiKit", {
    configurable: true,
    writable: true,
    value: mock.SpotiKit,
  });

  const prevFetchDesc = Object.getOwnPropertyDescriptor(globalThis, "fetch");

  return {
    dom,
    mock,
    teardown() {
      mock.reset();
      if (prevSpotiKitDesc === undefined) {
        delete globalThis.SpotiKit;
      } else {
        Object.defineProperty(globalThis, "SpotiKit", prevSpotiKitDesc);
      }
      if (prevFetchDesc === undefined) {
        delete globalThis.fetch;
      } else {
        Object.defineProperty(globalThis, "fetch", prevFetchDesc);
      }
      dom.reset();
    },
  };
}

test("settingsMigration: migrates legacy localStorage settings into SpotiKit.Storage scope and leaves custom sync keys untouched", async () => {
  const env = setupEnv();
  try {
    const { Settings } = await loadModules();
    Settings.data = {};

    env.dom.window.localStorage.setItem(
      "fullscreen-reloaded:settings",
      JSON.stringify({ backgroundMode: "solid", language: "tr" })
    );
    env.dom.window.localStorage.setItem(
      "liquid-lyrics-custom-sync:spotify:track:123",
      "custom-sync-payload"
    );

    const scope = env.mock.SpotiKit.Storage.scope("fullscreen-reloaded");
    assert.equal(scope.get("settings", null), null);

    Settings.load();

    assert.equal(Settings.get("backgroundMode"), "solid");
    assert.equal(Settings.get("language"), "tr");

    const migrated = scope.get("settings", null);
    assert.ok(migrated && typeof migrated === "object");
    assert.equal(migrated.backgroundMode, "solid");
    assert.equal(migrated.language, "tr");
    assert.equal(migrated._migratedIdleLyricsV2, true);

    assert.equal(
      env.dom.window.localStorage.getItem("liquid-lyrics-custom-sync:spotify:track:123"),
      "custom-sync-payload"
    );
  } finally {
    env.teardown();
  }
});

test("settingsMigration: migrates settings even when _migratedIdleLyricsV2 is already true", async () => {
  const env = setupEnv();
  try {
    const { Settings } = await loadModules();
    Settings.data = {};

    env.dom.window.localStorage.setItem(
      "fullscreen-reloaded:settings",
      JSON.stringify({
        backgroundMode: "artwork",
        idleLyrics: false,
        showLyrics: false,
        _migratedIdleLyricsV2: true,
      })
    );

    const scope = env.mock.SpotiKit.Storage.scope("fullscreen-reloaded");
    Settings.load();

    const migrated = scope.get("settings", null);
    assert.ok(migrated && typeof migrated === "object");
    assert.equal(migrated.backgroundMode, "artwork");
    assert.equal(migrated.idleLyrics, false);
    assert.equal(migrated.showLyrics, false);
  } finally {
    env.teardown();
  }
});

test("settingsCorruptFallback: corrupt JSON in localStorage does not throw and falls back to defaults", async () => {
  const env = setupEnv();
  try {
    const { Settings } = await loadModules();
    Settings.data = {};

    env.dom.window.localStorage.setItem("fullscreen-reloaded:settings", "{corrupt-json:::");

    assert.doesNotThrow(() => Settings.load());
    assert.equal(Settings.get("backgroundMode"), Settings.defaults.backgroundMode);
    assert.equal(Settings.get("language"), Settings.defaults.language);
    assert.equal(Settings.get("albumArtSize"), Settings.defaults.albumArtSize);
  } finally {
    env.teardown();
  }
});

test("i18nLocale: resolves SpotiKit.Locale.language when language is auto and translates Apple Music keys", async () => {
  const env = setupEnv({
    Locale: { language: "tr-TR" },
  });
  try {
    const { SpotiKitBridge, Settings, Locales, t } = await loadModules();
    SpotiKitBridge.init(env.mock.ctx);
    Settings.data = {};
    Settings.load();
    Settings.set("language", "auto");

    assert.equal(t("resumeSync"), "Senkronize Et");
    assert.equal(typeof Locales.tr.appleConnected, "string");
    assert.equal(typeof Locales.en.appleConnected, "string");
    assert.equal(t("appleConnected"), Locales.tr.appleConnected);
    assert.notEqual(t("appleConnected"), "appleConnected");
    assert.equal(t("appleConnectError"), Locales.tr.appleConnectError);
    assert.equal(t("appleConnectFailed"), Locales.tr.appleConnectFailed);

    env.mock.SpotiKit.Locale.language = "en-US";
    assert.equal(t("resumeSync"), "Resume Sync");
    assert.equal(t("appleConnected"), Locales.en.appleConnected);
    assert.notEqual(t("appleConnected"), "appleConnected");

    assert.equal(Settings.defaults.letterByLetter, true);
    assert.equal(typeof Locales.en.letterByLetter, "string");
    assert.equal(typeof Locales.tr.letterByLetter, "string");
    assert.notEqual(Locales.tr.letterByLetter, "letterByLetter");
  } finally {
    env.teardown();
  }
});

test("appleMusicAuth: caches apple-dev-token in SpotiKit.Storage scope and notifies via SpotiKitBridge on connect", async () => {
  const notifications = [];
  const env = setupEnv({
    Locale: { language: "en-US" },
    notify: (message, options) => {
      notifications.push({ message, options });
    },
  });
  try {
    const { SpotiKitBridge, Settings, Locales, AppleMusicAuth } = await loadModules();
    SpotiKitBridge.init(env.mock.ctx);
    Settings.data = {};
    Settings.load();

    AppleMusicAuth._devToken = null;
    AppleMusicAuth._devTokenExpires = 0;
    AppleMusicAuth._musicKitLoading = null;

    const scope = env.mock.SpotiKit.Storage.scope("fullscreen-reloaded");

    // _readCache rejects non-finite or expired timestamps and non-string tokens
    for (const invalid of [
      { token: "missing-expires" },
      { token: "nan-expires", expires: Number.NaN },
      { token: "inf-expires", expires: Number.POSITIVE_INFINITY },
      { token: "string-expires", expires: String(Date.now() + 60_000) },
      { token: "expired", expires: Date.now() - 1_000 },
      { token: "", expires: Date.now() + 60_000 },
    ]) {
      scope.set("apple-dev-token", invalid);
      assert.equal(AppleMusicAuth._readCache(), null);
    }

    const scopeValid = Date.now() + 60_000;
    scope.set("apple-dev-token", { token: "cached-dev-token", expires: scopeValid });

    // Reads cached token from SpotiKit.Storage scope
    const fromCache = await AppleMusicAuth.getDeveloperToken();
    assert.equal(fromCache, "cached-dev-token");

    // Clear memory and scope, fetch token and verify write to scope
    AppleMusicAuth._devToken = null;
    AppleMusicAuth._devTokenExpires = 0;
    scope.remove("apple-dev-token");

    const encodedCfg = encodeURIComponent(JSON.stringify({ MEDIA_API: { token: "fetched-dev-token" } }));
    globalThis.fetch = async () => ({
      ok: true,
      text: async () => `<meta name="desktop-music-app/config/environment" content="${encodedCfg}">`,
    });

    const fetched = await AppleMusicAuth.getDeveloperToken();
    assert.equal(fetched, "fetched-dev-token");
    const storedToken = scope.get("apple-dev-token", null);
    assert.ok(storedToken && storedToken.token === "fetched-dev-token");
    assert.equal(typeof storedToken.expires, "number");

    // connect() failure when token fetch fails -> notifies via SpotiKitBridge
    AppleMusicAuth._devToken = null;
    AppleMusicAuth._devTokenExpires = 0;
    scope.remove("apple-dev-token");
    globalThis.fetch = async () => {
      throw new Error("network down");
    };

    const failResult = await AppleMusicAuth.connect();
    assert.equal(failResult, false);
    assert.deepEqual(notifications[0], {
      message: Locales.en.appleConnectError,
      options: { type: "error" },
    });

    // connect() success -> stores user token and notifies with default type
    scope.set("apple-dev-token", { token: "valid-dev-token", expires: Date.now() + 60_000 });
    env.dom.window.MusicKit = {
      configure: async () => {},
      getInstance: () => ({
        authorize: async () => "apple-user-token-xyz",
      }),
    };

    const okResult = await AppleMusicAuth.connect();
    assert.equal(okResult, true);
    assert.equal(Settings.get("appleMusicUserToken"), "apple-user-token-xyz");
    assert.deepEqual(notifications[1], {
      message: Locales.en.appleConnected,
      options: { type: "default" },
    });

    // connect() MusicKit exception -> notifies with error type
    env.dom.window.MusicKit = {
      configure: async () => {
        throw new Error("musickit failed");
      },
    };
    const errResult = await AppleMusicAuth.connect();
    assert.equal(errResult, false);
    assert.deepEqual(notifications[2], {
      message: Locales.en.appleConnectFailed,
      options: { type: "error" },
    });
  } finally {
    env.teardown();
  }
});

test("i18nCreatorParity: EN and TR locales have identical key sets, interpolate params, and Creator UI has no hardcoded Turkish", async () => {
  const env = setupEnv({ Locale: { language: "en-US" } });
  try {
    const { SpotiKitBridge, Settings, Locales, t } = await loadModules();
    SpotiKitBridge.init(env.mock.ctx);
    Settings.data = {};
    Settings.load();

    const enKeys = Object.keys(Locales.en).sort();
    const trKeys = Object.keys(Locales.tr).sort();
    assert.deepEqual(enKeys, trKeys, "Locales.en and Locales.tr must have identical keys");

    Settings.set("language", "en");
    assert.equal(t("creatorLinesReady", { done: 3, total: 10 }), "3 / 10 lines ready");
    assert.equal(t("creatorLoadedToast", { title: "Demo" }), "Loaded: Demo");
    assert.equal(t("creatorShiftedToast", { delta: "+100" }), "Shifted all timings by +100ms");

    Settings.set("language", "tr");
    assert.equal(t("creatorLinesReady", { done: 3, total: 10 }), "3 / 10 satır hazır");
    assert.equal(t("creatorLoadedToast", { title: "Demo" }), "Yüklendi: Demo");
    assert.equal(t("creatorShiftedToast", { delta: "-100" }), "Tüm zamanlar -100ms kaydırıldı");

    // Ensure no hardcoded Turkish strings remain in FullLyricsCreator or src/components/creator/*.js
    const creatorFiles = [
      path.join(ROOT, "src/components/FullLyricsCreator.js"),
      ...fs
        .readdirSync(path.join(ROOT, "src/components/creator"))
        .filter((f) => f.endsWith(".js"))
        .map((f) => path.join(ROOT, "src/components/creator", f)),
    ];
    for (const filePath of creatorFiles) {
      const src = fs.readFileSync(filePath, "utf8");
      assert.doesNotMatch(
        src,
        /[ğüşöçıİĞÜŞÖÇ]/,
        `Found hardcoded Turkish character in ${path.basename(filePath)}`
      );
    }
  } finally {
    env.teardown();
  }
});
