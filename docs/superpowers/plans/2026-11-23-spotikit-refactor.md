# Fullscreen Reloaded — Pure SpotiKit Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Fullscreen Reloaded into a pure, zero-warning SpotiKit extension (`start(ctx)` ESM lifecycle + `SpotiKit.*` APIs + `spotikit.json`) ready for SpotiKit Marketplace discovery while preserving all existing and uncommitted local features.

**Architecture:** Replace the Spicetify IIFE bootstrap and `SpicetifyBridge.js` with an ESM `start(ctx)` entry point (`src/index.js`), a fresh-per-run ESM bundler (`build.js`), and `SpotiKitBridge.js` backed natively by `SpotiKit.Player`, `Queue`, `Navigation`, `Http`, `Audio`, `Storage`, `Locale`, `Platform`, `ProfileMenu`, `Playbar`, and `notify`. Every DOM listener, RAF loop, timer, observer, PiP window, and stylesheet binds to `ctx.signal` / `ctx.style` / `ctx.onStop` so Live Preview and toggling work without restarting Spotify.

**Tech Stack:** Vanilla ES2022 Modules, CSS3 (Liquid Glass), Node.js `>=22` (`node:test` + zero-dependency `build.js`), `spotikit-kit@^0.9.0` CLI (`check`, `dev`, `pack`).

**Spec:** [2026-11-23-spotikit-refactor-design.md](file:///f:/Noramu/Fullscreen-Reloaded/docs/superpowers/specs/2026-11-23-spotikit-refactor-design.md)

## Global Constraints

- Pure SpotiKit only: zero `Spicetify.*` references anywhere in `src/`, root JS/CSS files, or `tests/` (so `npx --yes spotikit-kit check` outputs `0 error(s)` and `0 warning(s)`).
- Remove Spicetify's `manifest.json`; add root `spotikit.json` with `"type": "extension"`, `"name": "Fullscreen Reloaded"`, non-empty `"description"`, closed range `"spotify": "1.3.5 - 1.3.9"`, `"main": "fullscreen-reloaded.js"`, `"preview": "preview.png"`, `"readme": "README.md"`, `"version": "1.4.0"`, and omit `"source"` so `build.js` owns CSS-text bundling.
- Keep `fullscreen-reloaded.js` built and tracked in Git (SpotiKit Marketplace fetches `main` directly from GitHub).
- Keep `build.js` zero-dependency (`node:fs`, `node:path`, `node:url`) and `"engines": { "node": ">=22.0.0" }` in `package.json`.
- Zero hashed Spotify CSS selectors (e.g. `.Ix6_...`); use semantic selectors (`[data-testid="fullscreen-mode-button"]`, `.now-playing-bar-extra-controls`, `.now-playing-bar`).
- Preserve all uncommitted local features (`FullLyricsCreator.js`, `CustomSyncStorage.js`, `SpicyLyricsProvider.js`, `creator.css`, and edits across `src/`) and preserve `CustomSyncStorage.js`'s `liquid-lyrics-custom-sync:*` `localStorage` keys/event for Liquid Lyrics compatibility.
- No `location.reload()` when switching extension settings.

## Review Focus

1. `SpotiKit.Player.repeat` is `"off" | "context" | "track"` — `"off"` is a truthy string in JS, so `getRepeat()` must check `mode !== "off"` and `toggleRepeat()` must cycle `"off" -> "context" -> "track" -> "off"`.
2. Re-invoking `start(ctx)` after `stop()` (SpotiKit Live Preview / toggle off-on) must allocate fresh module instances and leave zero duplicate DOM nodes, global listeners, timers, RAF loops, or observers.
3. Aborting `ctx.signal` during an async `onTrackChange()` or lyrics provider `fetch()` must abort inflight requests and skip post-await DOM updates on an unmounted overlay.
4. Legacy `localStorage["fullscreen-reloaded:settings"]` JSON strings must migrate cleanly once into `SpotiKit.Storage.scope("fullscreen-reloaded")` without corrupting or touching `liquid-lyrics-custom-sync:*`.
5. Switching `language` in `SettingsModal` while the fullscreen overlay and settings panel are open must rebuild UI strings in-place without calling `location.reload()` and keep the overlay and settings panel intact.

---

### Task 1: ESM Build Pipeline & Styles Consistency

**Files:**
- Modify: `src/styles/index.css:1-10`
- Modify: `build.js:135-220`
- Create: `tests/helpers/domStub.mjs`
- Create: `tests/build.test.mjs`

**Interfaces:**
- Consumes: `src/index.js` default export `start(context)` (in Task 5; interim tests may verify module factory behavior).
- Produces: `build()` in `build.js` generating ESM `fullscreen-reloaded.js` with `export default async function start(context)` and fresh per-invocation `__createRuntime()`.

- [ ] **Step 1: Write minimal reusable DOM/SpotiKit test stub helper and failing build test**

Create `tests/helpers/domStub.mjs` providing lightweight `installDomStub()` (minimal `Element`, `document`, `window`, `localStorage`, `CustomEvent`, `requestAnimationFrame` / `cancelAnimationFrame` stubs for Node `node:test`) and `tests/build.test.mjs`:

```js
// tests/build.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");

test("build.js produces ESM module exporting default start(context) and includes creator.css", async () => {
  const { build } = await import(pathToFileURL(path.join(ROOT, "build.js")).href);
  build();
  const outPath = path.join(ROOT, "fullscreen-reloaded.js");
  const code = fs.readFileSync(outPath, "utf8");
  assert.match(code, /export default async function start\(context\)/);
  assert.doesNotMatch(code, /\(function FullscreenReloaded\(\)/);
  assert.match(code, /\/\* --- creator\.css --- \*\//);

  const indexCss = fs.readFileSync(path.join(ROOT, "src/styles/index.css"), "utf8");
  assert.match(indexCss, /@import\s+"\.\/creator\.css";/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/build.test.mjs`
Expected: FAIL (`AssertionError` because `build.js` currently outputs an IIFE `(function FullscreenReloaded()` and `src/styles/index.css` lacks `creator.css`).

- [ ] **Step 3: Update `src/styles/index.css` and `build.js`**

1. Append `@import "./creator.css";` to `src/styles/index.css`.
2. In `build.js`:
   - Guard CLI auto-execution (`build()` / `--watch`) behind `if (process.argv[1] && path.resolve(process.argv[1]) === __filename)` so importing `{ build }` in tests does not trigger unwanted side effects beyond calling `build()` explicitly.
   - Refactor bundle template inside `build()` to emit:
     - `function __createRuntime()` encapsulating `__modules` and a fresh `__cache = {}` and `__require(id)`.
     - `export default async function start(context)` calling `const __require = __createRuntime(); const entry = __require("./index.js"); const fn = entry && entry.default ? entry.default : entry; return typeof fn === "function" ? await fn(context) : undefined;`.
   - Ensure `CSS_FILES_ORDER` keeps `"creator.css"` and header comment identifies SpotiKit ESM bundle.

- [ ] **Step 4: Run build test to verify it passes**

Run: `node --test tests/build.test.mjs`
Expected: PASS (note: wait until Task 5 updates `src/index.js` before importing/invoking `start(ctx)` on the bundle itself).

---

### Task 2: `SpotiKitBridge` & `Icons.fullscreen`

**Files:**
- Modify: `src/utils/icons.js:30-33`
- Create: `src/services/SpotiKitBridge.js`
- Delete: `src/services/SpicetifyBridge.js`
- Create: `tests/bridge.test.mjs`

**Interfaces:**
- Consumes: `globalThis.SpotiKit` (`ready`, `Player`, `Queue`, `Navigation`, `Http`, `Audio`, `Locale`, `Platform`, `notify`, `Storage`).
- Produces:
  - `Icons.fullscreen` (`string` SVG markup)
  - `SpotiKitBridge`: `init(ctx)`, `getSignal()`, `isStopped()`, `createTimeoutSignal(ms)`, `waitForReady()`, `getAccessToken()`, `httpGet(url, options)`, `getAudioData(uri)`, `getNextTrack()`, `getCurrentTrack()`, `getDuration()`, `getProgress()`, `isPlaying()`, `seek(ms)`, `togglePlay()`, `next()`, `back()`, `toggleShuffle()`, `getShuffle()`, `toggleRepeat()`, `getRepeatMode()`, `getRepeat()`, `getVolume()`, `setVolume(vol)`, `getMute()`, `toggleMute()`, `setMute(mute)`, `addPlayerListener(event, cb)`, `openQueue()`, `notify(message, options)`, `getLocale()`, `isSpotifyFullscreenButton(target)`.

- [ ] **Step 1: Write failing tests in `tests/bridge.test.mjs`**

Cover all bridge behaviors including Review Focus #1 and #3:
- `repeatModeHandling`: when `SpotiKit.Player.repeat === "off"`, `getRepeat()` returns `false` and `getRepeatMode()` returns `"off"`; calling `toggleRepeat()` cycles `"off" -> "context" -> "track" -> "off"` via `setRepeat`.
- `queueNormalization`: `getNextTrack()` reads `SpotiKit.Queue.next[0]` and returns `{ uri, name, metadata: { title, artist_name, album_title, image_xlarge_url }, artists: [{ name }], album: { name, images: [{ url }] } }`, falling back to `SpotiKit.Platform.PlayerAPI.getQueue()` when `SpotiKit.Queue.next` is empty.
- `signalPropagation`: `SpotiKitBridge.init(ctx)` binds `createTimeoutSignal(5000)` to `ctx.signal`; aborting `ctx`'s controller immediately aborts the returned signal and sets `isStopped()` to `true`.
- `fullscreenSelector`: `isSpotifyFullscreenButton` matches `[data-testid="fullscreen-mode-button"]` and `.now-playing-bar-extra-controls button[aria-label*="fullscreen" i]`, and returns `false` for unrelated buttons.
- `playbackAndPlatform`: `httpGet`, `getAudioData`, `getAccessToken` (checking `AuthorizationAPI.getState`, `Session`, and `Http.get("sp://oauth/v2/token")`), `openQueue`, `notify`, `getLocale`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/bridge.test.mjs`
Expected: FAIL (`ERR_MODULE_NOT_FOUND` for `src/services/SpotiKitBridge.js`).

- [ ] **Step 3: Implement `Icons.fullscreen` and `SpotiKitBridge.js`, and remove `SpicetifyBridge.js`**

1. Add `fullscreen` SVG entry to `Icons` in `src/utils/icons.js`.
2. Create `src/services/SpotiKitBridge.js` implementing the full interface cleanly using `SpotiKit.*` with defensive optional chaining (`?.`) and `try/catch` around `SpotiKit.Platform.*` lookups.
   - Map `addPlayerListener("songchange", cb)` to `SpotiKit.Player.on("track", cb)`.
   - Implement `createTimeoutSignal(timeoutMs)` combining `setTimeout` abort with `ctx?.signal` abort listener (and cleaning up timer/listener once aborted/completed).
3. Delete `src/services/SpicetifyBridge.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/bridge.test.mjs`
Expected: PASS

---

### Task 3: Storage (`Settings` Migration), `i18n`, and `AppleMusicAuth`

**Files:**
- Modify: `src/utils/settings.js:1-92`
- Modify: `src/utils/i18n.js:1-247`
- Modify: `src/services/AppleMusicAuth.js:1-136`
- Create: `tests/storage-i18n.test.mjs`

**Interfaces:**
- Consumes: `SpotiKitBridge.getLocale()`, `SpotiKitBridge.notify()`, `SpotiKitBridge.createTimeoutSignal()`, `SpotiKit.Storage.scope("fullscreen-reloaded")`.
- Produces:
  - `Settings` backed by `SpotiKit.Storage.scope("fullscreen-reloaded")` (`SETTINGS_KEY = "settings"`, migrating `localStorage["fullscreen-reloaded:settings"]` once on `load()`).
  - `t(key)` reading `SpotiKitBridge.getLocale()`, plus new i18n keys `appleConnectError`, `appleConnected`, `appleConnectFailed` in `en` and `tr`.
  - `AppleMusicAuth` caching developer token in `SpotiKit.Storage.scope("fullscreen-reloaded")` under `"apple-dev-token"` and notifying via `SpotiKitBridge.notify(t(...))`.

- [ ] **Step 1: Write failing tests in `tests/storage-i18n.test.mjs`**

Cover Review Focus #4 and locale/auth refactor:
- `settingsMigration`: pre-populate `window.localStorage` with `{"fullscreen-reloaded:settings": "{\"backgroundMode\":\"solid\",\"language\":\"tr\"}"}` and an empty `SpotiKit.Storage` scope; call `Settings.load()`; assert `Settings.get("backgroundMode") === "solid"`, `Settings.get("language") === "tr"`, and the migrated object is saved into `SpotiKit.Storage.scope("fullscreen-reloaded")` under `"settings"`, while `localStorage["liquid-lyrics-custom-sync:spotify:track:123"]` stays untouched.
- `settingsCorruptFallback`: corrupt string in `localStorage` does not throw and falls back to `Settings.defaults`.
- `i18nLocale`: with `language: "auto"` and `SpotiKit.Locale.language = "tr-TR"`, `t("resumeSync")` returns `"Senkronize Et"` and `t("appleConnected")` resolves cleanly in both `en` and `tr`.
- `appleMusicAuth`: token cache reads/writes `"apple-dev-token"` in `SpotiKit.Storage` scope and `connect()` failure calls `SpotiKitBridge.notify(...)` instead of throwing when `Spicetify` is undefined.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/storage-i18n.test.mjs`
Expected: FAIL (`Settings` writes to `localStorage` instead of `SpotiKit.Storage`, `t()` still checks `Spicetify` or ignores `SpotiKit.Locale`, `appleConnected` key missing).

- [ ] **Step 3: Refactor `src/utils/settings.js`, `src/utils/i18n.js`, and `src/services/AppleMusicAuth.js`**

1. `src/utils/settings.js`:
   - Add `_getScope()` returning `typeof SpotiKit !== "undefined" ? SpotiKit.Storage?.scope?.("fullscreen-reloaded") : null`.
   - In `load()`: read `"settings"` from scope; if missing, parse `window.localStorage.getItem(this.KEY)` once, merge defaults, and save to scope (keeping `_migratedIdleLyricsV2` guard). In `save()`: write object directly to `scope.set("settings", this.data)` or fallback to `window.localStorage.setItem(this.KEY, JSON.stringify(this.data))`.
2. `src/utils/i18n.js`:
   - Import `SpotiKitBridge` from `../services/SpotiKitBridge.js`.
   - Add `appleConnectError`, `appleConnected`, `appleConnectFailed` to `Locales.en` and `Locales.tr`.
   - Replace `Spicetify.Locale` / `Spicetify.Platform?.Translations` lookup in `t()` with `SpotiKitBridge.getLocale()`.
3. `src/services/AppleMusicAuth.js`:
   - Import `SpotiKitBridge` and `t`.
   - Cache `"apple-dev-token"` in `SpotiKit.Storage?.scope?.("fullscreen-reloaded")` (fallback `localStorage`).
   - Use `SpotiKitBridge.createTimeoutSignal(1500)` in `getDeveloperToken()`.
   - Replace `Spicetify.showNotification(...)` with `SpotiKitBridge.notify(t("appleConnectError" | "appleConnected" | "appleConnectFailed"), { type })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/storage-i18n.test.mjs`
Expected: PASS

---

### Task 4: AudioMoodEngine & Lyrics Providers Migration

**Files:**
- Modify: `src/services/AudioMoodEngine.js:1-10,286-312`
- Modify: `src/services/providers/SpotifyLyricsProvider.js:1-60`
- Modify: `src/services/providers/SpicyLyricsProvider.js:1-15,153-230,263-310`
- Modify: `src/services/providers/AppleMusicLyricsProvider.js:1-10,60-75,130-195`
- Modify: `src/services/providers/LrclibLyricsProvider.js:1-10,54-76`
- Modify: `src/services/providers/GeniusLyricsProvider.js:1-32`
- Create: `tests/providers.test.mjs`

**Interfaces:**
- Consumes: `SpotiKitBridge.httpGet()`, `SpotiKitBridge.getAccessToken()`, `SpotiKitBridge.getAudioData()`, `SpotiKitBridge.createTimeoutSignal()`.
- Produces: Same `AudioMoodEngine` and `*LyricsProvider` class/object APIs, zero `Spicetify.*` references, abort-safe `fetch` calls.

- [ ] **Step 1: Write failing tests in `tests/providers.test.mjs`**

Cover Review Focus #3 and provider migrations:
- `spotifyProviderUsesHttpGet`: mock `SpotiKit.Http.get` returning `{ lyrics: { syncType: "LINE_SYNCED", lines: [{ startTimeMs: "1000", words: "Hello world" }] } }`; assert `SpotifyLyricsProvider.fetch({ uri: "spotify:track:abc" })` returns `{ type: "synced", source: "Spotify", lines: [...] }` without needing `Spicetify`.
- `spicyProviderUsesBridgeToken`: mock `SpotiKit.Platform.AuthorizationAPI.getState` + mock `globalThis.fetch`; verify `SpicyLyricsProvider.fetch` sends `SpicyLyrics-WebAuth: Bearer <token>` and respects `ctx.signal` abort.
- `audioMoodEngineUsesSpotiKitAudio`: mock `SpotiKit.Audio.analysis` returning `{ track: { tempo: 128 }, segments: [{ start: 0, duration: 0.4, loudness_start: -20, loudness_max: -3, loudness_max_time: 0.02, timbre: [0, -20] }] }`; call `AudioMoodEngine.loadTrack({ uri: "spotify:track:abc", metadata: {} })`; assert `AudioMoodEngine.hasExactAudio === true` and `AudioMoodEngine.bpm === 128`.
- `externalProvidersRespectExtensionAbort`: abort `ctx`'s controller before/during `LrclibLyricsProvider.fetch` and `AppleMusicLyricsProvider.fetch`; assert `fetch` receives an aborted `signal` and resolves `null` cleanly.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/providers.test.mjs`
Expected: FAIL (`AudioMoodEngine` checks `Spicetify.getAudioData`, `SpotifyLyricsProvider` does not call `SpotiKit.Http.get`, `SpicyLyricsProvider` reads `Spicetify` directly).

- [ ] **Step 3: Refactor `AudioMoodEngine.js` and all 5 providers**

1. `src/services/AudioMoodEngine.js`: import `SpotiKitBridge` and replace `Spicetify.getAudioData(uri)` in `_fetchAudioData(uri)` with `SpotiKitBridge.getAudioData(uri)`.
2. `src/services/providers/SpotifyLyricsProvider.js`: replace `Spicetify.CosmosAsync.get(url)` with `SpotiKitBridge.httpGet(url)` (with timeout race + `SpotiKitBridge.isStopped()` check), and link `fetch` fallback to `SpotiKitBridge.createTimeoutSignal(1800)`.
3. `src/services/providers/SpicyLyricsProvider.js`: remove local `Spicetify` token helper (`getSpotifyAccessToken`), use `SpotiKitBridge.getAccessToken()` and `SpotiKitBridge.createTimeoutSignal(...)` on both `/version` and `/query` fetches.
4. `src/services/providers/AppleMusicLyricsProvider.js`, `LrclibLyricsProvider.js`, `GeniusLyricsProvider.js`: replace standalone `new AbortController()` + `setTimeout` boilerplate with `SpotiKitBridge.createTimeoutSignal(ms)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/providers.test.mjs`
Expected: PASS

---

### Task 5: Entry Point, Full Teardown & Live Language Rebuild

**Files:**
- Modify: `src/index.js:1-40`
- Modify: `src/App.js:1-429`
- Modify: `src/components/BottomDock.js:1-200`
- Modify: `src/components/TopBar.js:1-121`
- Modify: `src/components/SettingsModal.js:1-312`
- Modify: `src/components/LyricsView.js:1-180,410-520`
- Modify: `src/components/UpNextCard.js:1-60`
- Modify: `src/components/CustomSelect.js:1-142`
- Modify: `src/components/CustomColorPicker.js:1-281`
- Modify: `src/components/FullLyricsCreator.js:1-165,270-290,790-860,2245-2396`
- Create: `tests/lifecycle.test.mjs`

**Interfaces:**
- Consumes: `SpotiKitBridge`, `Settings`, `t`, `Icons.fullscreen`, `STYLES`.
- Produces:
  - `src/index.js` default export `async function start(ctx)` returning idempotent `stop` cleanup.
  - `App.mount(ctx)`, `App.unmount()`, `App.rebuildForLanguage()`.
  - `destroy()` / `destroyAll()` cleanup methods on `BottomDock`, `TopBar`, `LyricsView`, `FullLyricsCreator`, `CustomSelect`, `CustomColorPicker`.

- [ ] **Step 1: Write failing tests in `tests/lifecycle.test.mjs`**

Cover Review Focus #2, #3, and #5 (plus end-to-end bundled `start(ctx)` verification):
- `startAndStopLifecycle`: build bundle via `build.js`, dynamically import `fullscreen-reloaded.js`, run `const stop = await mod.default(ctx)` with mocked `SpotiKit` + DOM stub. Assert:
  - `ctx.style` was called once with CSS containing `#fullscreen-reloaded-root`.
  - `#fullscreen-reloaded-root` is appended to `document.body`.
  - Clicking `[data-testid="fullscreen-mode-button"]` opens `#fullscreen-reloaded-root` (`fr-open`), pressing `Escape` closes it.
  - Calling `stop()` (and aborting `ctx.signal`) removes `#fullscreen-reloaded-root`, removes style via SpotiKit, cancels timers/RAF/observers, and removes `ProfileMenu` / fallback `Playbar` entries.
  - Calling `mod.default(ctx2)` a second time mounts a fresh isolated instance with zero duplicate listeners or errors.
- `playbarFallbackOnlyWhenNativeMissing`: verify `SpotiKit.Playbar.add` is NOT called when `[data-testid="fullscreen-mode-button"]` exists in DOM, and IS called when absent.
- `languageSwitchWithoutReload`: open overlay and Settings modal, trigger `Settings.set("language", "tr")` (and back to `"en"`); assert `location.reload` was NOT called, UI strings re-rendered in Turkish, `App.open === true`, and Settings modal remains open (`fr-show`).
- `abortMidTrackChange`: trigger `onTrackChange()` while an async fetch is pending, then run `stop()` before it resolves; assert post-stop continuation does not re-attach or throw.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/lifecycle.test.mjs`
Expected: FAIL (`src/index.js` runs at module evaluation rather than exporting `start(ctx)`, components lack `destroy()`, `SettingsModal` calls `location.reload()`).

- [ ] **Step 3: Implement `src/index.js`, `App.js`, and component lifecycle/bridge updates**

1. `src/index.js`:
   - Export `default async function start(ctx)`: await `SpotiKit.ready`, `SpotiKitBridge.init(ctx)`, `Settings.load()`, `ctx.style(STYLES)`, `App.mount(ctx)`. Register `ctx.onStop(() => App.unmount())` and return `() => App.unmount()`.
2. `src/App.js`:
   - Replace `SpicetifyBridge` with `SpotiKitBridge`.
   - `mount(ctx)` stores `this._ctx = ctx`, `this._mounted = true`, builds DOM, registers `SpotiKit.ProfileMenu.add({ label: "Fullscreen Reloaded", icon: Icons.fullscreen, onSelect: () => this.toggleOpen() })`, checks `document.querySelector('[data-testid="fullscreen-mode-button"]')` and registers `SpotiKit.Playbar.add({ label: "Fullscreen Reloaded", icon: Icons.fullscreen, active: this.open, onClick: () => this.toggleOpen() })` only if native button is absent, keeps fallback button `.active` synced in `launch()`/`close()`.
   - Bind `window` idle listeners and `document` fullscreen click (`stopImmediatePropagation()`) + `keydown` listeners using `{ signal: ctx.signal }` (and `{ capture: true, signal: ctx.signal }`).
   - Add `App.rebuildForLanguage()`: preserve `wasOpen = this.open` and `settingsWasOpen = SettingsModal.root?.classList.contains("fr-show")`, tear down current DOM tree cleanly (`TopBar.destroy()`, `LyricsView.destroy()`, `FullLyricsCreator.destroy()`, `BottomDock.destroy()`, `CustomSelect.destroyAll()`, `CustomColorPicker.destroyAll()`, `this.root.remove()`), rebuild DOM, re-apply settings and current track metadata/lyrics (`this.currentTrack = null; if (wasOpen) await this.onTrackChange();`), and restore `fr-open` / `SettingsModal` `.fr-show` without calling `location.reload()`.
   - Add `App.unmount()`: idempotent guard (`if (!this._mounted) return; this._mounted = false;`), call `this.close()`, `clearTimeout(this.idleTimer)`, unsubscribe `songChangeListener` and `settingsUnsub`, destroy all subcomponents, remove `#fullscreen-reloaded-root`, clear DOM/listener refs.
   - Guard `onTrackChange()` after awaits (`if (!this._mounted || SpotiKitBridge.isStopped()) return;`).
3. `src/components/SettingsModal.js`:
   - In language `onChange`, replace `location.reload()` with `Settings.set("language", val)` (and trigger `SettingsModal` / `App` rebuild via `Settings.onChange("language")` in `App.js`).
4. `src/components/BottomDock.js`, `UpNextCard.js`, `LyricsView.js`, `FullLyricsCreator.js`:
   - Swap all `SpicetifyBridge` imports/calls to `SpotiKitBridge`.
   - Pass `{ signal }` or track drag cleanup in `BottomDock.destroy()` and `FullLyricsCreator.destroy()`.
   - In `TopBar.js`, add `destroy()` closing open `documentPictureInPicture.window` or exiting `document.pictureInPictureElement`.
   - In `LyricsView.js`, add `destroy()` clearing `_providerTimer`, `userScrollTimer`, disconnecting `this._resizeObserver`, canceling reveal RAF.
   - In `CustomSelect.js` & `CustomColorPicker.js`, track document listeners via `AbortController` recreated on demand and expose `destroyCustomSelects()` / `destroyCustomColorPickers()` clearing `activeSelects` / `activeColorPickers` Sets and aborting listeners.
5. Rebuild `fullscreen-reloaded.js` via `node build.js`.

- [ ] **Step 4: Run lifecycle test and full test suite to verify they pass**

Run: `node --test tests/*.test.mjs`
Expected: PASS across `build.test.mjs`, `bridge.test.mjs`, `storage-i18n.test.mjs`, `providers.test.mjs`, `lifecycle.test.mjs`.

---

### Task 6: SpotiKit Manifest, Editor Types, Documentation & `spotikit-kit check`

**Files:**
- Create: `spotikit.json`
- Create: `spotikit.d.ts`
- Create: `jsconfig.json`
- Create: `.gitignore`
- Delete: `manifest.json`
- Modify: `package.json:1-27`
- Modify: `README.md:1-192`
- Build: `fullscreen-reloaded.js`

**Interfaces:**
- Consumes: All modules from Tasks 1–5 and official `spotikit.d.ts`.
- Produces: Validated SpotiKit Marketplace package passing `npx --yes spotikit-kit check` with `0 error(s)` and `0 warning(s)`.

- [ ] **Step 1: Add `spotikit.json`, `spotikit.d.ts`, `jsconfig.json`, `.gitignore`; remove `manifest.json`; update `package.json` & `README.md`**

1. Create `spotikit.json`:
```json
{
  "type": "extension",
  "name": "Fullscreen Reloaded",
  "description": "Apple TV / visionOS-inspired Spotify fullscreen experience with Liquid Glass design, word-synced lyrics, mood atmosphere, FullLyrics Creator Studio, and Picture-in-Picture support.",
  "version": "1.4.0",
  "preview": "preview.png",
  "readme": "README.md",
  "spotify": "1.3.5 - 1.3.9",
  "main": "fullscreen-reloaded.js",
  "authors": [
    {
      "name": "Noramu Studios",
      "url": "https://github.com/NoramuAIO"
    }
  ],
  "tags": [
    "fullscreen",
    "lyrics",
    "liquid-glass",
    "picture-in-picture",
    "ambient",
    "karaoke"
  ]
}
```
2. Copy official `spotikit.d.ts` and `jsconfig.json` (matching `spotikit-kit` schema, `include: ["src/**/*.js", "spotikit.d.ts"]`).
3. Create `.gitignore` ignoring `node_modules/` and `*.zip` (keeping `fullscreen-reloaded.js` tracked).
4. Delete `manifest.json`.
5. Update `package.json`: `"version": "1.4.0"`, `"engines": { "node": ">=22.0.0" }`, `"keywords": ["spotikit", "spotikit-extension", "spotify", "fullscreen", "lyrics", "liquid-glass", "visionos", "picture-in-picture", "ambient"]`, scripts `"build"`, `"watch"`, `"test": "node --test tests/*.test.mjs"`, `"check": "npx --yes spotikit-kit check"`, `"dev": "npx --yes spotikit-kit dev"`, `"pack": "npx --yes spotikit-kit pack"`.
6. Update `README.md`: replace Spicetify CLI instructions and architecture notes with SpotiKit Marketplace installation (`spotify:app:marketplace:install:NoramuAIO:Fullscreen-Reloaded`, `spotikit-extensions`), manual `%APPDATA%\SpotiKit\Extensions\Fullscreen Reloaded` setup, updated file tree (`spotikit.json`, `SpotiKitBridge.js`, `FullLyricsCreator.js`, `CustomSyncStorage.js`, `SpicyLyricsProvider.js`), and `npm run build` / `npm run dev` / `npm run check` commands.

- [ ] **Step 2: Run full verification pipeline**

Run:
1. `npm run build`
2. `npm test`
3. `npx --yes spotikit-kit check`
4. `npx --yes spotikit-kit pack --out "$env:TEMP\fr-pack-test"` (then remove `$env:TEMP\fr-pack-test`)
5. Search codebase for any leftover `Spicetify` API identifier (`Select-String -Path src,tests,build.js,fullscreen-reloaded.js,spotikit.json,package.json -Pattern "Spicetify\.[A-Za-z]"`).

Expected:
- `npm run build` creates `fullscreen-reloaded.js` without errors.
- `npm test` passes all tests.
- `npx --yes spotikit-kit check` exits `0` with `0 error(s)` and `0 warning(s)`.
- `spotikit-kit pack` creates valid zip archive without errors.
- Zero `Spicetify.*` references found.

---

## Self-Review

- **Spec coverage check:**
  - `spotikit.json` + remove `manifest.json` + `spotikit.d.ts` + `jsconfig.json` + `package.json` + `README.md` -> Task 6
  - `build.js` ESM `start(context)` with fresh runtime + `index.css` `creator.css` -> Task 1
  - `SpotiKitBridge.js` replacing `SpicetifyBridge.js` + `Icons.fullscreen` -> Task 2
  - `Settings` migration + `i18n` + `AppleMusicAuth` -> Task 3
  - `AudioMoodEngine` + all 5 lyrics providers -> Task 4
  - `src/index.js`, `App.js`, `ProfileMenu`/`Playbar` fallback, live language rebuild without `location.reload()`, full component `destroy()` teardown -> Task 5
- **Placeholder/consistency check:** Every method name (`SpotiKitBridge.init`, `createTimeoutSignal`, `isStopped`, `getRepeatMode`, `httpGet`, `getAudioData`, `notify`, `getLocale`, `App.mount`, `App.unmount`, `App.rebuildForLanguage`, `destroy`, `destroyCustomSelects`, `destroyCustomColorPickers`) matches consistently across all tasks.
- **Review Focus coverage check:** All 5 failure modes (`repeat === "off"`, repeated `start(ctx)` -> `stop()`, `ctx.signal` abort mid-fetch, `localStorage` migration preserving `liquid-lyrics-custom-sync:*`, live language switch preserving open state) have dedicated tests in Tasks 2, 3, 4, and 5.
