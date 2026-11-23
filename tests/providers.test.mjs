// tests/providers.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { installDomStub, createSpotiKitMock } from "./helpers/domStub.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

async function loadModules() {
  const [
    { SpotiKitBridge },
    { AudioMoodEngine },
    { SpotifyLyricsProvider },
    { SpicyLyricsProvider },
    { AppleMusicLyricsProvider },
    { LrclibLyricsProvider },
    { GeniusLyricsProvider },
  ] = await Promise.all([
    import(pathToFileURL(path.join(ROOT, "src/services/SpotiKitBridge.js")).href),
    import(pathToFileURL(path.join(ROOT, "src/services/AudioMoodEngine.js")).href),
    import(pathToFileURL(path.join(ROOT, "src/services/providers/SpotifyLyricsProvider.js")).href),
    import(pathToFileURL(path.join(ROOT, "src/services/providers/SpicyLyricsProvider.js")).href),
    import(pathToFileURL(path.join(ROOT, "src/services/providers/AppleMusicLyricsProvider.js")).href),
    import(pathToFileURL(path.join(ROOT, "src/services/providers/LrclibLyricsProvider.js")).href),
    import(pathToFileURL(path.join(ROOT, "src/services/providers/GeniusLyricsProvider.js")).href),
  ]);
  return {
    SpotiKitBridge,
    AudioMoodEngine,
    SpotifyLyricsProvider,
    SpicyLyricsProvider,
    AppleMusicLyricsProvider,
    LrclibLyricsProvider,
    GeniusLyricsProvider,
  };
}

function setupEnv(overrides = {}) {
  const dom = installDomStub();
  const mock = createSpotiKitMock(overrides);
  const prevSpotiKitDesc = Object.getOwnPropertyDescriptor(globalThis, "SpotiKit");
  const prevFetchDesc = Object.getOwnPropertyDescriptor(globalThis, "fetch");

  Object.defineProperty(globalThis, "SpotiKit", {
    configurable: true,
    writable: true,
    value: mock.SpotiKit,
  });

  return {
    dom,
    mock,
    setFetch(fn) {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        writable: true,
        value: fn,
      });
    },
    teardown() {
      mock.reset();
      if (prevFetchDesc === undefined) {
        delete globalThis.fetch;
      } else {
        Object.defineProperty(globalThis, "fetch", prevFetchDesc);
      }
      if (prevSpotiKitDesc === undefined) {
        delete globalThis.SpotiKit;
      } else {
        Object.defineProperty(globalThis, "SpotiKit", prevSpotiKitDesc);
      }
      dom.reset();
    },
  };
}

test("spotifyProviderUsesHttpGet: fetches and parses LINE_SYNCED lyrics via SpotiKit.Http.get", async () => {
  const requestedUrls = [];
  const env = setupEnv({
    Http: {
      get: async (url) => {
        requestedUrls.push(url);
        return {
          lyrics: {
            syncType: "LINE_SYNCED",
            lines: [{ startTimeMs: "1000", words: "Hello world" }],
          },
        };
      },
    },
  });

  try {
    const { SpotiKitBridge, SpotifyLyricsProvider } = await loadModules();
    SpotiKitBridge.init(env.mock.ctx);

    const provider = new SpotifyLyricsProvider();
    const result = await provider.fetch({ uri: "spotify:track:abc" });

    assert.equal(requestedUrls.length, 1);
    assert.match(requestedUrls[0], /color-lyrics\/v2\/track\/abc/);
    assert.ok(result);
    assert.equal(result.type, "synced");
    assert.equal(result.source, "Spotify");
    assert.equal(result.lines.length, 1);
    assert.equal(result.lines[0].startMs, 1000);
    assert.deepEqual(
      result.lines[0].words.map((w) => w.text),
      ["Hello ", "world"]
    );
  } finally {
    env.teardown();
  }
});

test("spotifyProviderFallbackAndStopGuard: handles string JSON, fetch fallback, and skips fallback when stopped", async () => {
  let fetchCalls = 0;
  const env = setupEnv({
    Http: {
      get: async () =>
        JSON.stringify({
          lyrics: {
            syncType: "UNSYNCED",
            lines: [{ startTimeMs: "0", words: "String line" }],
          },
        }),
    },
  });

  try {
    const { SpotiKitBridge, SpotifyLyricsProvider } = await loadModules();
    SpotiKitBridge.init(env.mock.ctx);

    const provider = new SpotifyLyricsProvider();
    const fromString = await provider.fetch({ uri: "spotify:track:str1" });
    assert.equal(fromString?.type, "unsynced");
    assert.equal(fromString?.lines?.[0]?.words?.[0]?.text, "String ");

    // Failure in Http.get falls back to fetch with bridge token when not stopped
    env.mock.SpotiKit.Http.get = async () => null;
    let receivedAuth = null;
    let receivedSignal = null;
    env.setFetch(async (_url, init) => {
      fetchCalls++;
      receivedAuth = init?.headers?.Authorization;
      receivedSignal = init?.signal;
      return {
        ok: true,
        json: async () => ({
          lyrics: {
            syncType: "LINE_SYNCED",
            lines: [{ startTimeMs: "500", words: "Fallback line" }],
          },
        }),
      };
    });

    const fromFallback = await provider.fetch({ uri: "spotify:track:fb1" });
    assert.equal(fetchCalls, 1);
    assert.equal(receivedAuth, "Bearer mock-access-token");
    assert.ok(receivedSignal instanceof AbortSignal);
    assert.equal(fromFallback?.type, "synced");

    // When stopped, fallback fetch must not run
    env.mock.abortController.abort();
    const whenStopped = await provider.fetch({ uri: "spotify:track:stop1" });
    assert.equal(whenStopped, null);
    assert.equal(fetchCalls, 1);
  } finally {
    env.teardown();
  }
});

test("spicyProviderUsesBridgeToken: sends SpicyLyrics-WebAuth Bearer token and respects ctx.signal abort", async () => {
  const fetchCalls = [];
  const env = setupEnv({
    Platform: {
      AuthorizationAPI: {
        getState: () => ({
          isAuthorized: true,
          token: { accessToken: "spicy-bridge-token" },
        }),
      },
    },
  });

  try {
    const { SpotiKitBridge, SpicyLyricsProvider } = await loadModules();
    SpotiKitBridge.init(env.mock.ctx);

    env.setFetch(async (url, init = {}) => {
      fetchCalls.push({ url: String(url), init, aborted: Boolean(init.signal?.aborted) });
      if (init.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (String(url).endsWith("/version")) {
        return { ok: true, text: async () => "6.3.12" };
      }
      return {
        ok: true,
        json: async () => ({
          queries: [
            {
              operation: "lyrics",
              result: {
                httpStatus: 200,
                data: {
                  Type: "Line",
                  StartTime: 0,
                  EndTime: 5,
                  Content: [{ Text: "Spicy line", StartTime: 1, EndTime: 3 }],
                },
              },
            },
          ],
        }),
      };
    });

    const provider = new SpicyLyricsProvider();
    const res = await provider.fetch({ uri: "spotify:track:spicy1" });

    const queryCall = fetchCalls.find((c) => c.url.includes("/query"));
    assert.ok(queryCall, "Expected /query fetch call");
    assert.equal(queryCall.init.headers["SpicyLyrics-WebAuth"], "Bearer spicy-bridge-token");
    assert.ok(queryCall.init.signal instanceof AbortSignal);
    assert.equal(res?.type, "synced");
    assert.equal(res?.source, "Spicy Lyrics");

    // Abort ctx and verify fetch receives an aborted signal and resolves null cleanly
    fetchCalls.length = 0;
    env.mock.abortController.abort();
    const abortedRes = await provider.fetch({ uri: "spotify:track:spicy2" });
    assert.equal(abortedRes, null);
    const abortedQuery = fetchCalls.find((c) => c.url.includes("/query"));
    assert.ok(abortedQuery, "Expected /query fetch call with aborted signal");
    assert.equal(abortedQuery.aborted, true);
  } finally {
    env.teardown();
  }
});

test("audioMoodEngineUsesSpotiKitAudio: loads track analysis from SpotiKit.Audio.analysis", async () => {
  const analysisCalls = [];
  const env = setupEnv({
    Audio: {
      analysis: async (uri) => {
        analysisCalls.push(uri);
        return {
          track: { tempo: 128 },
          segments: [
            {
              start: 0,
              duration: 0.4,
              loudness_start: -20,
              loudness_max: -3,
              loudness_max_time: 0.02,
              timbre: [0, -20],
            },
          ],
        };
      },
    },
  });

  try {
    const { SpotiKitBridge, AudioMoodEngine } = await loadModules();
    SpotiKitBridge.init(env.mock.ctx);
    AudioMoodEngine._audioCache.clear();

    await AudioMoodEngine.loadTrack({ uri: "spotify:track:abc", metadata: {} });

    assert.deepEqual(analysisCalls, ["spotify:track:abc"]);
    assert.equal(AudioMoodEngine.hasExactAudio, true);
    assert.equal(AudioMoodEngine.bpm, 128);
  } finally {
    env.teardown();
  }
});

test("externalProvidersRespectExtensionAbort: Lrclib, AppleMusic, and Genius pass aborted signal and resolve null", async () => {
  const env = setupEnv();
  try {
    const {
      SpotiKitBridge,
      LrclibLyricsProvider,
      AppleMusicLyricsProvider,
      GeniusLyricsProvider,
    } = await loadModules();
    SpotiKitBridge.init(env.mock.ctx);

    const seenSignals = [];
    env.setFetch(async (_url, init = {}) => {
      seenSignals.push(init.signal);
      if (init.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      return { ok: false, status: 500 };
    });

    env.mock.abortController.abort();

    const track = {
      uri: "spotify:track:ext1",
      name: "Test Song",
      metadata: { title: "Test Song", artist_name: "Test Artist", duration: 180000 },
    };

    const lrcRes = await new LrclibLyricsProvider().fetch(track);
    const appleRes = await new AppleMusicLyricsProvider().fetch(track);
    const geniusRes = await new GeniusLyricsProvider().fetch(track);

    assert.equal(lrcRes, null);
    assert.equal(appleRes, null);
    assert.equal(geniusRes, null);
    assert.equal(seenSignals.length, 3, "Each provider should issue only its initial fetch and skip retries when aborted");
    for (const sig of seenSignals) {
      assert.ok(sig instanceof AbortSignal);
      assert.equal(sig.aborted, true);
    }
  } finally {
    env.teardown();
  }
});

test("lrclibDoesNotRetry503AfterStop: skips retry when ctx aborts on 503 response", async () => {
  const env = setupEnv();
  try {
    const { SpotiKitBridge, LrclibLyricsProvider } = await loadModules();
    SpotiKitBridge.init(env.mock.ctx);

    let calls = 0;
    env.setFetch(async (_url, init = {}) => {
      calls++;
      assert.ok(init.signal instanceof AbortSignal);
      env.mock.abortController.abort();
      return { ok: false, status: 503 };
    });

    const track = {
      uri: "spotify:track:lrc503",
      name: "Retry Song",
      metadata: { title: "Retry Song", artist_name: "Retry Artist", duration: 180000 },
    };

    const res = await new LrclibLyricsProvider().fetch(track);
    assert.equal(res, null);
    assert.equal(calls, 1);
  } finally {
    env.teardown();
  }
});
