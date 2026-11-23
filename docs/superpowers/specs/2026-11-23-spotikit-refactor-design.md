# Fullscreen Reloaded — Pure SpotiKit Refactor & Marketplace Design

**Date:** 2026-11-23  
**Target Repository:** `NoramuAIO/Fullscreen-Reloaded`  
**Target Platform:** SpotiKit (`https://spotikit.com`) & SpotiKit Marketplace (`spotikit-extensions`)

---

## 1. Intent & Why

Refactor **Fullscreen Reloaded** from a legacy Spicetify IIFE extension into a native **SpotiKit** extension so that:
1. The extension is automatically discovered, indexed, and installable from the **SpotiKit Marketplace** inside Spotify.
2. It runs natively on SpotiKit's ESM lifecycle (`export default async function start(ctx)`) and `SpotiKit.*` APIs without relying on Spicetify compatibility mode.
3. All existing and currently uncommitted local features—including Liquid Glass UI, Waterfall Lyrics, Audio Mood & Beat Engine, Apple Music / Spicy Lyrics / LRCLIB / Genius / Spotify providers, Picture-in-Picture, **FullLyrics Creator Studio**, and `CustomSyncStorage`—are preserved and cleanly torn down when stopped, toggled off, updated, or reloaded in Live Preview.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **SpotiKit Marketplace compliance:** Add a valid root `spotikit.json` manifest matching SpotiKit's schema (`type: "extension"`, `name`, `description`, closed `spotify` compatibility range, `main`, `preview`, `readme`, `version`, `authors`, `tags`) so GitHub discovery (`spotikit-extensions` topic already set on `NoramuAIO/Fullscreen-Reloaded`) indexes the package cleanly.
- **Zero-warning `spotikit-kit check`:** Eliminate all `Spicetify.*` references across `src/` and root files, avoid hashed Spotify CSS class selectors, and pass `npx spotikit-kit check` with `0 error(s)` and `0 warning(s)`.
- **Hot-reloadable ESM lifecycle:** Compile `src/` into a single ESM bundle (`fullscreen-reloaded.js`) exporting `export default async function start(ctx)` with a fresh per-run module runtime and full teardown (`ctx.style`, `ctx.signal`, `ctx.onStop`, timers, animation frames, observers, DOM root, PiP windows, and event listeners).
- **Native SpotiKit API integration:** Replace `SpicetifyBridge.js` with `SpotiKitBridge.js` backed by `SpotiKit.Player`, `SpotiKit.Queue`, `SpotiKit.Navigation`, `SpotiKit.Http`, `SpotiKit.Audio`, `SpotiKit.Storage`, `SpotiKit.Locale`, `SpotiKit.Platform`, `SpotiKit.ProfileMenu`, `SpotiKit.Playbar`, and `SpotiKit.notify`.
- **Preserve in-progress local features:** Keep all uncommitted local additions (`FullLyricsCreator.js`, `CustomSyncStorage.js`, `SpicyLyricsProvider.js`, `creator.css`, and edits in `App.js`, `LyricsView.js`, `SettingsModal.js`, `TopBar.js`, `LyricsService.js`, `i18n.js`, `icons.js`) intact and migrated to the SpotiKit runtime.
- **Keep Liquid Lyrics custom-sync compatibility:** Preserve `localStorage` keys `liquid-lyrics-custom-sync:<trackUri>`, `liquid-lyrics-custom-sync-index`, and custom event `liquid-lyrics:custom-sync-changed` in `CustomSyncStorage.js` for 100% interoperability with `NMWplays/Liquid-Lyrics` on SpotiKit.

### Non-Goals
- Maintaining backwards compatibility with Spicetify CLI or Spicetify Marketplace (`manifest.json` will be removed).
- Rewriting the vanilla DOM/CSS UI architecture into React/JSX or TypeScript.
- Publishing/pushing to GitHub automatically without user review (we prepare all files, run build & `spotikit-kit check`, and document the final push step if remote push isn't requested).

### Anti-Goals
- Leaving `Spicetify.*` fallback branches (which trigger `spotikit-kit check` warnings and split API maintenance).
- Using module-global singletons/caches that leak across `start(ctx)` restarts in SpotiKit Live Preview.
- Calling `location.reload()` to apply in-extension settings (such as language changes), which would reload the entire Spotify client.
- Introducing hashed Spotify CSS selectors (e.g., `.Ix6_...`) or open-ended `"spotify"` version ranges (e.g., `>=1.3.5`).

---

## 3. Constraints

- **Marketplace indexing contract (`spotikit-kit` `check.mjs` & `project.mjs`):**
  - `spotikit.json` must live at repository root.
  - Required fields: `"type": "extension"`, non-empty `"name"`, non-empty `"description"`, valid `"main"` pointing to a committed built JS file in the repository (`fullscreen-reloaded.js`), closed `"spotify"` version or range (`"1.3.5 - 1.3.9"`), `"preview": "preview.png"`, `"readme": "README.md"`.
  - Repository already has the GitHub topic `spotikit-extensions`; once `spotikit.json` and the rebuilt `fullscreen-reloaded.js` are committed and pushed to `main`, SpotiKit Marketplace picks it up automatically.
- **Build & CSS bundling constraint:**
  - `spotikit-kit build`'s built-in esbuild configuration does not include a `.css: "text"` loader for `import STYLES from "./styles/index.css"`.
  - Therefore, omitting `"source"` in `spotikit.json` (the same pattern used by `NMWplays/Liquid-Lyrics`) while keeping our zero-dependency Node.js `build.js` to bundle `src/` + `src/styles/*.css` into `fullscreen-reloaded.js` ensures `npm run build` works with zero dependencies **and** `spotikit-kit check` / `spotikit-kit dev` / `spotikit-kit pack` work cleanly.
- **SpotiKit API surface (`spotikit.d.ts`):**
  - `SpotiKit.Player.repeat` is `"off" | "context" | "track"` (a non-empty string, so `"off"` is truthy in JS and must be checked explicitly as `repeat !== "off"`).
  - `SpotiKit.Queue.next` returns `QueueEntry[]` (`{ uri, uid, title, artist, album, image, provider }`), which differs in shape from Spicetify's `Track` object (`metadata`, `artists`, `album.images`).
  - `SpotiKit.Audio.analysis(uri)` replaces `Spicetify.getAudioData(uri)`.
  - `SpotiKit.Http.get(url)` replaces `Spicetify.CosmosAsync.get(url)` and handles `sp://` plus automatic auth headers for `spclient.wg.spotify.com`.
  - `SpotiKit.Storage.scope("fullscreen-reloaded")` stores JSON values natively (no manual `JSON.stringify` wrapper required, though legacy string migration must parse safely).
- **Spotify Desktop version & Node.js:**
  - Local environment has Node.js `v24.14.0` and npm `11.9.0`; `spotikit-kit@0.9.0` requires Node `>=22`.

---

## 4. Approaches Considered

1. **Pure SpotiKit Refactor (Selected)**
   - Remove Spicetify manifest/APIs completely (`manifest.json`, `SpicetifyBridge.js`, all `Spicetify.*` calls) and migrate natively to `SpotiKit.*` APIs, `export default async function start(ctx)`, `ctx.style`, `ctx.signal`, `ctx.onStop`, and `spotikit.json`.
   - **Tradeoffs:** Drops legacy Spicetify support, in exchange for 0 warnings in `spotikit-kit check`, clean hot-reload/toggle lifecycle, native `SpotiKit.Storage`/`Http`/`Audio`/`Player`/`Queue`/`Locale`/`notify` integration, and simpler maintenance.
2. **Hybrid Dual-Platform Bridge (Rejected)**
   - Keep `SpotiKit` as primary with `Spicetify` fallback and both manifests.
   - **Tradeoffs:** Preserves Spicetify support, but triggers `spotikit-kit check` warnings for `Spicetify.*` references, requires maintaining two divergent playback/storage/auth/notification code paths, and retains legacy readiness polling.

---

## 5. Architecture & Detailed Design

### 5.1 Repository Manifests & Tooling Files
- **Add `spotikit.json`** at root:
  - `type`: `"extension"`
  - `name`: `"Fullscreen Reloaded"`
  - `description`: concise summary matching current extension capabilities
  - `version`: `"1.4.0"`
  - `preview`: `"preview.png"`
  - `readme`: `"README.md"`
  - `spotify`: `"1.3.5 - 1.3.9"`
  - `main`: `"fullscreen-reloaded.js"`
  - `authors`: `[{ "name": "Noramu Studios", "url": "https://github.com/NoramuAIO" }]`
  - `tags`: `["fullscreen", "lyrics", "liquid-glass", "picture-in-picture", "ambient", "karaoke"]`
- **Remove `manifest.json`** (Spicetify-only manifest).
- **Add `spotikit.d.ts` and `jsconfig.json`** (matching `spotikit-kit` template) for editor IntelliSense without affecting runtime.
- **Update `package.json`:**
  - Bump version to `"1.4.0"`, update keywords (`"spotikit"`, `"spotikit-extension"`, etc.), set `"engines": { "node": ">=22.0.0" }`, add scripts `"build": "node build.js"`, `"watch": "node build.js --watch"`, `"check": "npx --yes spotikit-kit check"`, `"dev": "npx --yes spotikit-kit dev"`, `"pack": "npx --yes spotikit-kit pack"`. Keep `build.js` zero-dependency so `npm run build` works offline/without `node_modules`.
- **Update `.gitignore`** (if needed) to ignore `*.zip` release archives and temporary artifacts while keeping `fullscreen-reloaded.js` tracked in Git (required because SpotiKit Marketplace loads `main` directly from the repository).
- **Update `README.md`:** Document SpotiKit Marketplace installation (`spotify:app:marketplace:install:NoramuAIO:Fullscreen-Reloaded`), manual `%APPDATA%\SpotiKit\Extensions` setup, `npm run build` / `npm run dev` / `npm run check`, and updated feature list (FullLyrics Creator Studio, Spicy Lyrics, Custom Sync, Mood Atmosphere, Waterfall Lyrics).

### 5.2 Build Pipeline (`build.js`) -> ESM `start(context)` Bundle
- Update `src/styles/index.css` to also include `@import "./creator.css";` so source CSS order matches `build.js`'s `CSS_FILES_ORDER`.
- Refactor `build.js` output template from an IIFE to an ES module exporting `start(context)`:
  - Encapsulate `__modules`, `__cache`, and `__require` inside `function __createRuntime()` called fresh on every `export default async function start(context)` invocation. This prevents stale cached singleton state (`App`, `LyricsView`, `FullLyricsCreator`, `Settings`, `CustomSelect`, `CustomColorPicker`) across Live Preview reloads or extension disable/re-enable cycles.
  - `start(context)` calls `__require("./index.js")` and awaits its default export `start(context)`, returning the teardown function (if any).
  - Verify `build.js` regex transforms cover all `import`/`export` forms used in `src/**/*.js`.

### 5.3 Entry Point & Lifecycle (`src/index.js`)
- Replace `injectStyles()` + `bootstrap()` top-level execution with `export default async function start(ctx)`:
  1. `await SpotiKit.ready;` (defensive await; no polling loop).
  2. `SpotiKitBridge.init(ctx);`
  3. `Settings.load();`
  4. `ctx.style(STYLES);` (registers stylesheet via SpotiKit so it sits after Spotify's styles and is auto-removed on stop).
  5. `App.mount(ctx);`
  6. Register `ctx.onStop(() => App.unmount());` and return `() => App.unmount()` (idempotent guard so unmount runs at most once).

### 5.4 `SpotiKitBridge` Service (`src/services/SpotiKitBridge.js`)
Replace `src/services/SpicetifyBridge.js` with `src/services/SpotiKitBridge.js`:
- **Lifecycle & Signals:**
  - `init(ctx)` stores `this._ctx = ctx` and exposes `getSignal()` -> `ctx?.signal` plus helper `createTimeoutSignal(ms)` that aborts on either timeout or `ctx.signal` (`AbortSignal.any` with manual listener fallback).
- **Player State & Controls (`SpotiKit.Player`):**
  - `getCurrentTrack()` -> `SpotiKit.Player?.track || SpotiKit.Player?.state?.item || null`
  - `getDuration()` -> `Number(SpotiKit.Player?.duration) || 0`
  - `getProgress()` -> `Number(SpotiKit.Player?.position) || 0`
  - `isPlaying()` -> `Boolean(SpotiKit.Player?.isPlaying)`
  - `seek(ms)` -> `SpotiKit.Player?.seek?.(Math.max(0, ms))`
  - `togglePlay()` -> `SpotiKit.Player?.toggle?.()`
  - `next()` -> `SpotiKit.Player?.next?.()`
  - `back()` -> `SpotiKit.Player?.previous?.()`
  - `getShuffle()` -> `Boolean(SpotiKit.Player?.shuffle)`
  - `toggleShuffle()` -> `SpotiKit.Player?.setShuffle?.(!this.getShuffle())`
  - `getRepeatMode()` -> `SpotiKit.Player?.repeat || "off"` (`"off" | "context" | "track"`)
  - `getRepeat()` -> `this.getRepeatMode() !== "off"`
  - `toggleRepeat()` -> cycles `"off" -> "context" -> "track" -> "off"` via `SpotiKit.Player?.setRepeat?.(nextMode)`
  - `getVolume()` -> clamped `[0, 1]` from `SpotiKit.Player?.volume`
  - `setVolume(vol)` -> unmutes if muted (`setMuted(false)`) and calls `SpotiKit.Player?.setVolume?.(clamped)`
  - `getMute()` -> `Boolean(SpotiKit.Player?.muted)`
  - `setMute(mute)` / `toggleMute()` -> `SpotiKit.Player?.setMuted?.(!!mute)`
  - `addPlayerListener(event, cb)` -> maps `"songchange"` -> `"track"`, `"playpause"` -> `"playpause"`, `"progress"` -> `"progress"`, `"state"` -> `"state"` via `SpotiKit.Player?.on(mappedEvent, cb)`.
- **Queue & Navigation (`SpotiKit.Queue` / `SpotiKit.Navigation`):**
  - `getNextTrack()`:
    1. Read `SpotiKit.Queue?.next?.[0]` and normalize `QueueEntry` (`uri, title, artist, album, image`) into the track shape expected by `UpNextCard` (`{ uri, name, metadata: { title, artist_name, album_title, image_xlarge_url }, artists: artist ? [{ name: artist }] : [], album: { name: album, images: image ? [{ url: image }] : [] } }`).
    2. Fallback to `SpotiKit.Platform?.PlayerAPI?._queue?.nextTracks?.[0]` or `await SpotiKit.Platform?.PlayerAPI?.getQueue?.()` inside `try/catch`.
  - `openQueue()` -> `SpotiKit.Navigation?.go?.("/queue")` with fallback to `SpotiKit.Platform?.History?.push?.("/queue")`.
- **HTTP, Auth & Audio Analysis:**
  - `httpGet(url, options)` -> `SpotiKit.Http?.get?.(url, options)`
  - `getAccessToken()`: checks `SpotiKit.Platform?.AuthorizationAPI?.getState?.()?.token?.accessToken`, `await SpotiKit.Platform?.AuthorizationAPI?.getAccessToken?.()`, `SpotiKit.Platform?.Session?.accessToken`, `await SpotiKit.Platform?.Session?.getAccessToken?.()`, and `await SpotiKit.Http?.get?.("sp://oauth/v2/token")` (all guarded by optional chaining & `try/catch`).
  - `getAudioData(uri)` -> `await SpotiKit.Audio?.analysis?.(uri)`
- **UI, Locale & Notifications:**
  - `notify(message, options)` -> `SpotiKit.notify?.(plainText, options)`
  - `getLocale()` -> `SpotiKit.Locale?.language || SpotiKit.Platform?.Translations?.getLocale?.() || navigator.language || "en"`
  - `isSpotifyFullscreenButton(target)`: checks `button[data-testid="fullscreen-mode-button"]`, legacy fullscreen `data-testid`s, aria-labels, and SpotiKit semantic extra-controls classes (`.now-playing-bar-extra-controls`, `.now-playing-bar`, `[data-testid="now-playing-bar"]`).

### 5.5 Launch Entry Points & Fullscreen Button Integration
- Intercept clicks on Spotify's native fullscreen button (`isSpotifyFullscreenButton`) on `document` in capture phase (`event.preventDefault(); event.stopImmediatePropagation(); app.toggleOpen();`) with `{ capture: true, signal: ctx.signal }`.
- Register a `SpotiKit.ProfileMenu.add` entry (`label: "Fullscreen Reloaded"`, `icon: "fullscreen"`, `onSelect: () => app.toggleOpen()`) so users can launch/toggle it even if a theme hides the native button.
- Register a fallback `SpotiKit.Playbar.add` button **only if** `[data-testid="fullscreen-mode-button"]` is absent in the DOM (e.g., Spotify Free tier or custom themes), and sync its `.active` state with `app.open`.
- Register keyboard shortcuts (`F` to open when closed, `Esc` to close, `E` to open FullLyrics Creator Studio, `F11` to toggle) with `{ capture: true, signal: ctx.signal }`.

### 5.6 Storage & Settings (`src/utils/settings.js`, `src/services/AppleMusicAuth.js`, `src/services/CustomSyncStorage.js`)
- **`Settings` (`src/utils/settings.js`):**
  - Scope storage via `SpotiKit.Storage?.scope?.("fullscreen-reloaded")`.
  - On `load()`, read `"settings"` from `SpotiKit.Storage` scope; if absent, migrate existing `"fullscreen-reloaded:settings"` from `window.localStorage` (if valid JSON) into `SpotiKit.Storage`. Fall back to `window.localStorage` only if `SpotiKit.Storage` is unavailable.
- **`AppleMusicAuth` (`src/services/AppleMusicAuth.js`):**
  - Cache `"apple-dev-token"` via `SpotiKit.Storage?.scope?.("fullscreen-reloaded")` (with fallback).
  - Replace hardcoded Turkish `Spicetify.showNotification` calls with `SpotiKitBridge.notify(...)` using localized i18n keys (`appleConnectError`, `appleConnected`, `appleConnectFailed`) added to `src/utils/i18n.js` (`en` and `tr`).
  - Pass `SpotiKitBridge.createTimeoutSignal(1500)` to `fetch`.
- **`CustomSyncStorage` (`src/services/CustomSyncStorage.js`):**
  - Keep `liquid-lyrics-custom-sync:<trackUri>`, `liquid-lyrics-custom-sync-index`, and `liquid-lyrics:custom-sync-changed` intact so custom syncs remain shared with `NMWplays/Liquid-Lyrics`.

### 5.7 Live Language Switching & Full Teardown Across Components
- **`i18n.js`:** Use `SpotiKitBridge.getLocale()` instead of `Spicetify.Locale` / `Spicetify.Platform.Translations`.
- **`SettingsModal.js` & `App.js`:** Remove `location.reload()` when changing `language`. Instead, `Settings.set("language", val)` triggers `App.rebuildForLanguage()`, which cleanly tears down and rebuilds the mounted `#fullscreen-reloaded-root` DOM in-place while preserving `this.open`, current track, and open settings panel state.
- **Complete Teardown (`App.unmount()` and component `destroy()` hooks):**
  - `App.unmount()` (called by `ctx.onStop`):
    - Calls `this.close()` (restores `document.body.style.overflow`, exits fullscreen if active, cancels `tickHandle` RAF, stops `Clock`).
    - Clears `this.idleTimer`, unsubscribes `songChangeListener` and `Settings.onChange` listener.
    - Calls `TopBar.destroy()` (closes open Document PiP window or exits video PiP), `LyricsView.destroy()` (clears `_providerTimer`, `userScrollTimer`, disconnects `ResizeObserver`), `FullLyricsCreator.destroy()` (cancels `_rafId`, clears `_toastTimer`, unbinds `_keyHandler`, removes `CHANGE_EVENT` listener via `signal`), `BottomDock.destroy()` (aborts any active drag `mousemove`/`mouseup` listeners), `CustomSelect.destroyAll()`, and `CustomColorPicker.destroyAll()`.
    - Removes `this.root` from `document.body` and resets singleton references.

### 5.8 Lyrics Providers & Audio Mood Engine
- **`SpotifyLyricsProvider.js`:** Replace `Spicetify.CosmosAsync.get(url)` with `SpotiKitBridge.httpGet(url)` (`SpotiKit.Http.get`), keeping `SpotiKitBridge.getAccessToken()` + `fetch(..., { signal })` fallback.
- **`SpicyLyricsProvider.js`:** Replace direct `Spicetify.*` token lookup with `SpotiKitBridge.getAccessToken()` and link `fetch` timeouts to `ctx.signal`.
- **`AppleMusicLyricsProvider.js`, `LrclibLyricsProvider.js`, `GeniusLyricsProvider.js`:** Link `fetch` `AbortController`s with `SpotiKitBridge.createTimeoutSignal(ms)` so stopping the extension aborts inflight requests.
- **`AudioMoodEngine.js`:** Replace `Spicetify.getAudioData(uri)` with `SpotiKitBridge.getAudioData(uri)` (`SpotiKit.Audio.analysis(uri)`).

### 5.9 Verification Criteria
- `npm run build` compiles `fullscreen-reloaded.js` cleanly as an ESM module exporting `default async function start(ctx)`.
- `npx --yes spotikit-kit check` exits with `0 error(s)` and `0 warning(s)` (valid `spotikit.json`, valid syntax across all JS/CSS files, zero hashed Spotify selectors, zero `Spicetify.*` references).
- `npx --yes spotikit-kit pack --out <temp>` succeeds and validates package structure cleanly (without leaving `.zip` artifacts in the working tree).
- Static check/test confirms `start(ctx)` followed by aborting `ctx` / triggering `onStop` removes `#fullscreen-reloaded-root`, injected `<style>`, listeners, timers, and observers cleanly without throwing when re-invoked (simulating SpotiKit Live Preview reload).

---

## 6. Left to the Builder

- Exact internal helper organization inside `SpotiKitBridge.js` and `build.js` (e.g., whether `build.js` preserves exact CommonJS-style module shim inside `start(context)` or adapts export regexes).
- Minor UI refinements for `BottomDock` repeat icon state (`"context"` vs `"track"`) if desired while mapping `SpotiKit.Player.repeat`.
- Designing automated Node/DOM smoke tests (e.g. mocking `globalThis.SpotiKit` + minimal DOM) to verify `start(ctx)` -> `stop()` idempotency and bridge mappings before running `spotikit-kit check`.
