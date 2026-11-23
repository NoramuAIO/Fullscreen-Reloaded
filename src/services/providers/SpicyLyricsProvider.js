/**
 * SpicyLyricsProvider
 * Fetches syllable/word-synced, line-synced, and static lyrics from api.spicylyrics.org
 * using the exact Liquid Lyrics / Spicy Lyrics protocol (`SpicyLyrics-WebAuth` + `SLObjPack` unpacker).
 */
import { BaseLyricsProvider } from "./BaseLyricsProvider.js";
import { SpotiKitBridge } from "../SpotiKitBridge.js";
import { extractTrackId, spicyLyricsToFullscreenLines } from "../CustomSyncStorage.js";

const SPICY_API_BASE = "https://api.spicylyrics.org";
const DEFAULT_SPICY_VERSION = "6.3.12";

let _cachedVersion = null;
let _versionPromise = null;

const PACK_LIMITS = {
  depth: 512,
  arrayLength: 1048576,
  objectKeys: 65536,
  streamLength: 16777216,
  valuesLength: 4194304,
  decodeOps: 4194304,
};
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isSLObjPacked(val) {
  return (
    Array.isArray(val) &&
    val.length === 2 &&
    Array.isArray(val[0]) &&
    Array.isArray(val[1])
  );
}

/**
 * Decodes Spicy Lyrics SLObjPack `[valuesList, stream]` binary-like JSON array format.
 */
export function decodeSLObjPack(packed) {
  const values = packed[0];
  const stream = packed[1];
  if (values.length > PACK_LIMITS.valuesLength) {
    throw new Error("SLObjPack: valuesList exceeds limit");
  }
  if (stream.length > PACK_LIMITS.streamLength) {
    throw new Error("SLObjPack: stream exceeds limit");
  }

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) continue;
    const t = typeof v;
    if (!(t === "string" || t === "boolean") && !(t === "number" && Number.isFinite(v))) {
      throw new Error(`SLObjPack: invalid value at ${i}`);
    }
  }

  let pos = 0;
  const nextOp = () => {
    if (pos >= stream.length) throw new Error("SLObjPack: unexpected end of stream");
    return stream[pos++];
  };
  const getVal = (ptr) => {
    if (typeof ptr !== "number" || !Number.isInteger(ptr) || ptr < 0 || ptr >= values.length) {
      throw new Error(`SLObjPack: invalid value pointer ${ptr}`);
    }
    return values[ptr];
  };
  const getKey = () => {
    const k = getVal(nextOp());
    if (typeof k !== "string") throw new Error("SLObjPack: keys must be strings");
    if (FORBIDDEN_KEYS.has(k)) throw new Error(`SLObjPack: forbidden key ${k}`);
    return k;
  };
  const setProp = (obj, k, v) => {
    Object.defineProperty(obj, k, {
      value: v,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  };
  const checkCount = (cnt, max, label) => {
    if (typeof cnt !== "number" || !Number.isInteger(cnt) || cnt < 0 || cnt > max) {
      throw new Error(`SLObjPack: invalid ${label} count ${cnt}`);
    }
    return cnt;
  };
  const checkRemaining = (needed, label) => {
    if (needed > stream.length - pos) {
      throw new Error(`SLObjPack: ${label} exceeds remaining stream`);
    }
  };

  const decodeNode = (depth) => {
    if (depth > PACK_LIMITS.depth) throw new Error("SLObjPack: max depth exceeded");
    const op = nextOp();
    if (typeof op !== "number" || !Number.isInteger(op)) {
      throw new Error(`SLObjPack: invalid opcode ${op}`);
    }
    if (op >= 0) return getVal(op);

    switch (op) {
      case -1: {
        const count = checkCount(nextOp(), PACK_LIMITS.objectKeys, "object key");
        checkRemaining(count * 2, "object");
        const keys = new Array(count);
        for (let i = 0; i < count; i++) keys[i] = getKey();
        const obj = {};
        for (let i = 0; i < count; i++) setProp(obj, keys[i], decodeNode(depth + 1));
        return obj;
      }
      case -2: {
        const count = checkCount(nextOp(), PACK_LIMITS.arrayLength, "array item");
        checkRemaining(count, "array");
        const arr = new Array(count);
        for (let i = 0; i < count; i++) arr[i] = decodeNode(depth + 1);
        return arr;
      }
      case -3: {
        const rowCount = checkCount(nextOp(), PACK_LIMITS.arrayLength, "schema array item");
        const keyCount = checkCount(nextOp(), PACK_LIMITS.objectKeys, "schema key");
        if (rowCount * keyCount > PACK_LIMITS.decodeOps) {
          throw new Error("SLObjPack: schema array budget exceeded");
        }
        checkRemaining(keyCount + rowCount * keyCount, "schema array");
        const keys = new Array(keyCount);
        for (let k = 0; k < keyCount; k++) keys[k] = getKey();
        const rows = new Array(rowCount);
        for (let r = 0; r < rowCount; r++) {
          const item = {};
          for (let k = 0; k < keyCount; k++) setProp(item, keys[k], decodeNode(depth + 1));
          rows[r] = item;
        }
        return rows;
      }
      case -4:
        return [];
      case -5:
        return [decodeNode(depth + 1)];
      case -6:
        return {};
      default:
        throw new Error(`SLObjPack: unknown opcode ${op}`);
    }
  };

  const result = decodeNode(0);
  if (pos !== stream.length) throw new Error("SLObjPack: extra data after decoding");
  return result;
}

async function getSpicyVersion() {
  if (_cachedVersion) return _cachedVersion;
  if (!_versionPromise) {
    _versionPromise = (async () => {
      try {
        const res = await fetch(`${SPICY_API_BASE}/version`, {
          signal: SpotiKitBridge.createTimeoutSignal(1800),
        });
        if (res.ok) {
          const txt = (await res.text()).trim();
          if (/^\d+\.\d+\.\d+$/.test(txt)) {
            _cachedVersion = txt;
          }
        }
      } catch (_) {}
      if (!_cachedVersion) _cachedVersion = DEFAULT_SPICY_VERSION;
    })();
  }
  await _versionPromise;
  return _cachedVersion || DEFAULT_SPICY_VERSION;
}

function convertSpicyTimesToMs(data) {
  if (!data || data.Type === "Static") return;
  const toMs = (sec) => Math.round(Number(sec || 0) * 1000);
  data.StartTime = toMs(data.StartTime);
  data.EndTime = toMs(data.EndTime);

  if (data.Type === "Syllable" && Array.isArray(data.Content)) {
    for (const item of data.Content) {
      if (item.Lead) {
        item.Lead.StartTime = toMs(item.Lead.StartTime);
        item.Lead.EndTime = toMs(item.Lead.EndTime);
        for (const s of item.Lead.Syllables || []) {
          s.StartTime = toMs(s.StartTime);
          s.EndTime = toMs(s.EndTime);
        }
      }
      if (Array.isArray(item.Background)) {
        for (const bg of item.Background) {
          bg.StartTime = toMs(bg.StartTime);
          bg.EndTime = toMs(bg.EndTime);
          for (const bs of bg.Syllables || []) {
            bs.StartTime = toMs(bs.StartTime);
            bs.EndTime = toMs(bs.EndTime);
          }
        }
      }
    }
  } else if (data.Type === "Line" && Array.isArray(data.Content)) {
    for (const item of data.Content) {
      item.StartTime = toMs(item.StartTime);
      item.EndTime = toMs(item.EndTime);
    }
  }
}

export class SpicyLyricsProvider extends BaseLyricsProvider {
  async fetch(track) {
    if (!track) return null;
    const trackId = extractTrackId(track.uri || track.id || "");
    if (!trackId) return null;

    try {
      const version = await getSpicyVersion();
      const token = await SpotiKitBridge.getAccessToken();
      const authHeader = token ? `Bearer ${token}` : null;

      const res = await fetch(`${SPICY_API_BASE}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "SpicyLyrics-Version": version,
          "X-mode": "2",
          ...(authHeader ? { "SpicyLyrics-WebAuth": authHeader } : {}),
        },
        body: JSON.stringify({
          queries: [
            {
              operation: "lyrics",
              variables: {
                id: trackId,
                auth: "SpicyLyrics-WebAuth",
              },
            },
          ],
          client: { version },
        }),
        signal: SpotiKitBridge.createTimeoutSignal(3200),
      });

      if (!res.ok) return null;
      const body = await res.json();
      const queries = Array.isArray(body?.queries) ? body.queries.flat() : [];
      const job =
        queries.find((q) => q?.operation === "lyrics" && Boolean(q?.result)) ||
        queries.find((q) => Boolean(q?.result));
      if (!job?.result) return null;

      const rawResult = job.result;
      const httpStatus = rawResult.httpStatus;
      let payload = rawResult.data ?? rawResult;

      if (httpStatus && httpStatus !== 200) return null;
      if (payload && typeof payload === "object" && typeof payload.error === "string") {
        return null;
      }

      if (isSLObjPacked(payload)) {
        payload = decodeSLObjPack(payload);
      }

      if (
        !payload ||
        typeof payload !== "object" ||
        !(payload.Type === "Syllable" || payload.Type === "Line" || payload.Type === "Static")
      ) {
        return null;
      }

      payload.Provider = "spicy";
      convertSpicyTimesToMs(payload);

      return spicyLyricsToFullscreenLines(payload, "Spicy Lyrics");
    } catch (_) {
      return null;
    }
  }
}
