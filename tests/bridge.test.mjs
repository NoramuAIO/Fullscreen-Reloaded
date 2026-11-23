// tests/bridge.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { installDomStub, createSpotiKitMock } from "./helpers/domStub.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

async function loadBridgeAndIcons() {
  const [{ SpotiKitBridge }, { Icons }] = await Promise.all([
    import(pathToFileURL(path.join(ROOT, "src/services/SpotiKitBridge.js")).href),
    import(pathToFileURL(path.join(ROOT, "src/utils/icons.js")).href),
  ]);
  return { SpotiKitBridge, Icons };
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
      dom.reset();
    },
  };
}

test("Icons.fullscreen exports SVG markup", async () => {
  const { Icons } = await loadBridgeAndIcons();
  assert.equal(typeof Icons.fullscreen, "string");
  assert.match(Icons.fullscreen, /<svg[\s>]/);
  assert.match(Icons.fullscreen, /<\/svg>/);
});

test("repeatModeHandling: treats 'off' as false and cycles off -> context -> track -> off", async () => {
  const env = setupEnv();
  try {
    const { SpotiKitBridge } = await loadBridgeAndIcons();
    SpotiKitBridge.init(env.mock.ctx);

    env.mock.SpotiKit.Player.repeat = "off";
    assert.equal(SpotiKitBridge.getRepeatMode(), "off");
    assert.equal(SpotiKitBridge.getRepeat(), false);

    SpotiKitBridge.toggleRepeat();
    assert.equal(env.mock.SpotiKit.Player.repeat, "context");
    assert.equal(SpotiKitBridge.getRepeatMode(), "context");
    assert.equal(SpotiKitBridge.getRepeat(), true);

    SpotiKitBridge.toggleRepeat();
    assert.equal(env.mock.SpotiKit.Player.repeat, "track");
    assert.equal(SpotiKitBridge.getRepeatMode(), "track");
    assert.equal(SpotiKitBridge.getRepeat(), true);

    SpotiKitBridge.toggleRepeat();
    assert.equal(env.mock.SpotiKit.Player.repeat, "off");
    assert.equal(SpotiKitBridge.getRepeatMode(), "off");
    assert.equal(SpotiKitBridge.getRepeat(), false);
  } finally {
    env.teardown();
  }
});

test("queueNormalization: normalizes SpotiKit.Queue.next[0] and falls back to Platform.PlayerAPI", async () => {
  const env = setupEnv({
    Queue: {
      next: [
        {
          uri: "spotify:track:next1",
          uid: "uid-1",
          title: "Next Song",
          artist: "Next Artist",
          album: "Next Album",
          image: "https://i.scdn.co/image/next1",
          provider: "queue",
        },
      ],
    },
  });
  try {
    const { SpotiKitBridge } = await loadBridgeAndIcons();
    SpotiKitBridge.init(env.mock.ctx);

    const normalized = await SpotiKitBridge.getNextTrack();
    assert.equal(normalized.uri, "spotify:track:next1");
    assert.equal(normalized.name, "Next Song");
    assert.deepEqual(normalized.metadata, {
      title: "Next Song",
      artist_name: "Next Artist",
      album_title: "Next Album",
      image_xlarge_url: "https://i.scdn.co/image/next1",
    });
    assert.deepEqual(normalized.artists, [{ name: "Next Artist" }]);
    assert.deepEqual(normalized.album, {
      name: "Next Album",
      images: [{ url: "https://i.scdn.co/image/next1" }],
    });

    // Empty SpotiKit.Queue.next -> falls back to Platform.PlayerAPI._queue.nextTracks
    env.mock.SpotiKit.Queue.next = [];
    env.mock.SpotiKit.Platform.PlayerAPI._queue = {
      nextTracks: [{ uri: "spotify:track:sync2", metadata: { title: "Sync Queue Track" } }],
    };
    const fromSyncInternal = await SpotiKitBridge.getNextTrack();
    assert.equal(fromSyncInternal.uri, "spotify:track:sync2");

    // Empty _queue -> falls back to async Platform.PlayerAPI.getQueue()
    env.mock.SpotiKit.Platform.PlayerAPI._queue = { nextTracks: [] };
    env.mock.SpotiKit.Platform.PlayerAPI.getQueue = async () => ({
      nextTracks: [{ uri: "spotify:track:async3", metadata: { title: "Async Queue Track" } }],
    });
    const fromAsync = await SpotiKitBridge.getNextTrack();
    assert.equal(fromAsync.uri, "spotify:track:async3");

    // Throwing Platform.PlayerAPI.getQueue() returns null safely
    env.mock.SpotiKit.Platform.PlayerAPI.getQueue = async () => {
      throw new Error("queue unavailable");
    };
    assert.equal(await SpotiKitBridge.getNextTrack(), null);
  } finally {
    env.teardown();
  }
});

test("signalPropagation: init binds createTimeoutSignal and isStopped to ctx.signal", async () => {
  const env = setupEnv();
  try {
    const { SpotiKitBridge } = await loadBridgeAndIcons();
    SpotiKitBridge.init(env.mock.ctx);

    assert.equal(SpotiKitBridge.getSignal(), env.mock.ctx.signal);
    assert.equal(SpotiKitBridge.isStopped(), false);

    const sig = SpotiKitBridge.createTimeoutSignal(5000);
    assert.equal(sig.aborted, false);

    env.mock.abortController.abort();
    assert.equal(SpotiKitBridge.isStopped(), true);
    assert.equal(sig.aborted, true);

    // Creating a timeout signal after ctx is already aborted returns an immediately aborted signal
    const alreadyAbortedSig = SpotiKitBridge.createTimeoutSignal(5000);
    assert.equal(alreadyAbortedSig.aborted, true);
  } finally {
    env.teardown();
  }
});

test("signalPropagation: createTimeoutSignal aborts after timeout ms", async () => {
  const env = setupEnv();
  try {
    const { SpotiKitBridge } = await loadBridgeAndIcons();
    SpotiKitBridge.init(env.mock.ctx);

    const sig = SpotiKitBridge.createTimeoutSignal(15);
    assert.equal(sig.aborted, false);
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(sig.aborted, true);
  } finally {
    env.teardown();
  }
});

test("fullscreenSelector: matches native fullscreen button and extra-controls aria-label", async () => {
  const env = setupEnv();
  try {
    const { SpotiKitBridge } = await loadBridgeAndIcons();

    const modeBtn = document.createElement("button");
    modeBtn.setAttribute("data-testid", "fullscreen-mode-button");
    const modeChild = document.createElement("span");
    modeBtn.appendChild(modeChild);
    document.body.appendChild(modeBtn);

    assert.equal(SpotiKitBridge.isSpotifyFullscreenButton(modeBtn), true);
    assert.equal(SpotiKitBridge.isSpotifyFullscreenButton(modeChild), true);

    const extraControls = document.createElement("div");
    extraControls.className = "now-playing-bar-extra-controls";
    const extraFsBtn = document.createElement("button");
    extraFsBtn.setAttribute("aria-label", "Enter Fullscreen");
    const extraFsIcon = document.createElement("svg");
    extraFsBtn.appendChild(extraFsIcon);
    extraControls.appendChild(extraFsBtn);

    const unrelatedBtn = document.createElement("button");
    unrelatedBtn.setAttribute("aria-label", "Connect to a device");
    extraControls.appendChild(unrelatedBtn);
    document.body.appendChild(extraControls);

    assert.equal(SpotiKitBridge.isSpotifyFullscreenButton(extraFsBtn), true);
    assert.equal(SpotiKitBridge.isSpotifyFullscreenButton(extraFsIcon), true);
    assert.equal(SpotiKitBridge.isSpotifyFullscreenButton(unrelatedBtn), false);

    const plainBtn = document.createElement("button");
    plainBtn.setAttribute("aria-label", "Play");
    document.body.appendChild(plainBtn);

    assert.equal(SpotiKitBridge.isSpotifyFullscreenButton(plainBtn), false);
    assert.equal(SpotiKitBridge.isSpotifyFullscreenButton(null), false);
    assert.equal(SpotiKitBridge.isSpotifyFullscreenButton({}), false);
  } finally {
    env.teardown();
  }
});

test("playbackAndPlatform: playback controls, listeners, HTTP, audio, tokens, queue, notify, locale", async () => {
  const env = setupEnv({
    Locale: { language: "tr-TR" },
  });
  try {
    const { SpotiKitBridge } = await loadBridgeAndIcons();
    SpotiKitBridge.init(env.mock.ctx);

    await SpotiKitBridge.waitForReady();

    // Player metadata & playback state
    env.mock.emitTrack({ uri: "spotify:track:abc", name: "Track ABC" });
    env.mock.SpotiKit.Player.duration = 200000;
    env.mock.SpotiKit.Player.position = 45000;
    assert.equal(SpotiKitBridge.getCurrentTrack()?.uri, "spotify:track:abc");
    assert.equal(SpotiKitBridge.getDuration(), 200000);
    assert.equal(SpotiKitBridge.getProgress(), 45000);
    assert.equal(SpotiKitBridge.isPlaying(), false);

    SpotiKitBridge.togglePlay();
    assert.equal(SpotiKitBridge.isPlaying(), true);

    SpotiKitBridge.seek(-50);
    assert.equal(SpotiKitBridge.getProgress(), 0);
    SpotiKitBridge.seek(12000);
    assert.equal(SpotiKitBridge.getProgress(), 12000);

    let nextCalls = 0;
    let prevCalls = 0;
    env.mock.SpotiKit.Player.next = () => { nextCalls++; };
    env.mock.SpotiKit.Player.previous = () => { prevCalls++; };
    SpotiKitBridge.next();
    SpotiKitBridge.back();
    assert.equal(nextCalls, 1);
    assert.equal(prevCalls, 1);

    // Shuffle
    assert.equal(SpotiKitBridge.getShuffle(), false);
    SpotiKitBridge.toggleShuffle();
    assert.equal(SpotiKitBridge.getShuffle(), true);

    // Volume & mute
    SpotiKitBridge.setMute(true);
    assert.equal(SpotiKitBridge.getMute(), true);
    SpotiKitBridge.setVolume(1.5);
    assert.equal(SpotiKitBridge.getMute(), false);
    assert.equal(SpotiKitBridge.getVolume(), 1);
    SpotiKitBridge.setVolume(-0.2);
    assert.equal(SpotiKitBridge.getVolume(), 0);
    SpotiKitBridge.toggleMute();
    assert.equal(SpotiKitBridge.getMute(), true);

    // Listener mapping: "songchange" -> "track"
    const seenTracks = [];
    const unsub = SpotiKitBridge.addPlayerListener("songchange", (t) => seenTracks.push(t?.uri));
    env.mock.emitTrack({ uri: "spotify:track:first" });
    unsub();
    env.mock.emitTrack({ uri: "spotify:track:second" });
    assert.deepEqual(seenTracks, ["spotify:track:first"]);

    // httpGet & getAudioData
    let httpCall = null;
    env.mock.SpotiKit.Http.get = async (url, opts) => {
      httpCall = { url, opts };
      return { ok: true };
    };
    const httpRes = await SpotiKitBridge.httpGet("https://example.com/api", { headers: { X: "1" } });
    assert.deepEqual(httpRes, { ok: true });
    assert.deepEqual(httpCall, { url: "https://example.com/api", opts: { headers: { X: "1" } } });

    env.mock.SpotiKit.Audio.analysis = async (uri) => ({ track: { tempo: 120 }, uri });
    assert.deepEqual(await SpotiKitBridge.getAudioData("spotify:track:abc"), {
      track: { tempo: 120 },
      uri: "spotify:track:abc",
    });

    // getAccessToken: AuthorizationAPI.getState -> Session -> Http.get("sp://oauth/v2/token")
    assert.equal(await SpotiKitBridge.getAccessToken(), "mock-access-token");

    env.mock.SpotiKit.Platform.AuthorizationAPI = {
      getState: () => {
        throw new Error("auth state error");
      },
    };
    env.mock.SpotiKit.Platform.Session = { accessToken: "session-token" };
    assert.equal(await SpotiKitBridge.getAccessToken(), "session-token");

    env.mock.SpotiKit.Platform.Session = {};
    env.mock.SpotiKit.Http.get = async (url) =>
      url === "sp://oauth/v2/token" ? { accessToken: "oauth-http-token" } : null;
    assert.equal(await SpotiKitBridge.getAccessToken(), "oauth-http-token");

    // openQueue
    let navTarget = null;
    env.mock.SpotiKit.Navigation.go = (route) => { navTarget = route; };
    SpotiKitBridge.openQueue();
    assert.equal(navTarget, "/queue");

    // notify
    let notified = null;
    env.mock.SpotiKit.notify = (msg, opts) => { notified = { msg, opts }; };
    SpotiKitBridge.notify("<b>Hello</b> World", { type: "info" });
    assert.deepEqual(notified, { msg: "Hello World", opts: { type: "info" } });

    // getLocale
    assert.equal(SpotiKitBridge.getLocale(), "tr-TR");
  } finally {
    env.teardown();
  }
});

test("graceful degradation when SpotiKit global is undefined", async () => {
  const dom = installDomStub();
  const prevDesc = Object.getOwnPropertyDescriptor(globalThis, "SpotiKit");
  delete globalThis.SpotiKit;
  try {
    const { SpotiKitBridge } = await loadBridgeAndIcons();
    SpotiKitBridge.init(null);
    assert.equal(SpotiKitBridge.getSignal(), null);
    assert.equal(SpotiKitBridge.isStopped(), false);
    assert.equal(await SpotiKitBridge.waitForReady(), null);
    assert.equal(await SpotiKitBridge.getAccessToken(), null);
    assert.equal(await SpotiKitBridge.httpGet("https://example.com"), null);
    assert.equal(await SpotiKitBridge.getAudioData("spotify:track:1"), null);
    assert.equal(await SpotiKitBridge.getNextTrack(), null);
    assert.equal(SpotiKitBridge.getCurrentTrack(), null);
    assert.equal(SpotiKitBridge.getDuration(), 0);
    assert.equal(SpotiKitBridge.getProgress(), 0);
    assert.equal(SpotiKitBridge.isPlaying(), false);
    assert.equal(SpotiKitBridge.getShuffle(), false);
    assert.equal(SpotiKitBridge.getRepeatMode(), "off");
    assert.equal(SpotiKitBridge.getRepeat(), false);
    assert.equal(SpotiKitBridge.getVolume(), 1);
    assert.equal(SpotiKitBridge.getMute(), false);
    assert.equal(SpotiKitBridge.getLocale(), "en-US");
    const unsub = SpotiKitBridge.addPlayerListener("songchange", () => {});
    unsub();
    SpotiKitBridge.notify("hello");
  } finally {
    if (prevDesc !== undefined) {
      Object.defineProperty(globalThis, "SpotiKit", prevDesc);
    }
    dom.reset();
  }
});
