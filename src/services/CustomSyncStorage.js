/**
 * CustomSyncStorage
 * 100% compatible with NMWplays/Liquid-Lyrics local storage schema (`liquid-lyrics-custom-sync:<trackUri>`
 * and `liquid-lyrics-custom-sync-index`) & Spicy Lyrics universal JSON format (`Static` | `Line` | `Syllable`),
 * plus TTML and Enhanced LRC import/export and Fullscreen Reloaded line conversion.
 */
import { parseTTML, parseLRC } from "../utils/parsers.js";
import { finalizeWordSyllables } from "../utils/letterTiming.js";

export const SYNC_PREFIX = "liquid-lyrics-custom-sync:";
export const INDEX_KEY = "liquid-lyrics-custom-sync-index";
export const CHANGE_EVENT = "liquid-lyrics:custom-sync-changed";

export function extractTrackId(uriOrId) {
  const s = String(uriOrId ?? "").trim();
  if (!s) return "";
  return s.includes(":") ? s.split(":")[2] || s : s;
}

export function normalizeTrackUri(uriOrId) {
  const s = String(uriOrId ?? "").trim();
  if (!s) return "";
  if (s.startsWith("spotify:track:")) return s;
  const id = extractTrackId(s);
  return id ? `spotify:track:${id}` : s;
}

export function isValidSyncRecord(obj) {
  if (!obj || typeof obj !== "object") return false;
  return (
    typeof obj.trackId === "string" &&
    (obj.mode === "line" || obj.mode === "word" || obj.mode === "static") &&
    Boolean(obj.lyrics) &&
    Boolean(obj.draft)
  );
}

export function getCustomSync(trackOrUriOrId) {
  let rawUri = "";
  let rawId = "";
  if (trackOrUriOrId && typeof trackOrUriOrId === "object") {
    rawUri = String(trackOrUriOrId.uri || trackOrUriOrId.trackUri || "").trim();
    rawId = extractTrackId(rawUri || trackOrUriOrId.id || trackOrUriOrId.trackId || "");
  } else {
    rawUri = String(trackOrUriOrId ?? "").trim();
    rawId = extractTrackId(rawUri);
  }

  const candidates = [];
  if (rawUri) candidates.push(rawUri);
  if (rawId) {
    const fullUri = `spotify:track:${rawId}`;
    if (!candidates.includes(fullUri)) candidates.push(fullUri);
    if (!candidates.includes(rawId)) candidates.push(rawId);
  }

  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(SYNC_PREFIX + key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (isValidSyncRecord(parsed)) return parsed;
    } catch (_) {}
  }
  return null;
}

export function hasCustomSync(trackOrUriOrId) {
  return getCustomSync(trackOrUriOrId) !== null;
}

export function listCustomSyncs() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && (item.trackUri || item.trackId))
      .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
  } catch (_) {
    return [];
  }
}

function saveCustomSyncIndex(list) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("[FullLyrics Creator] Could not update sync index:", e);
  }
}

function dispatchSyncChange(trackUri, trackId) {
  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT, {
      detail: { trackUri, trackId },
    })
  );
}

export function saveCustomSync(record) {
  const trackId = extractTrackId(record.trackUri || record.trackId);
  const trackUri = normalizeTrackUri(record.trackUri || trackId);
  if (!trackUri) throw new Error("Missing track URI or ID");

  // Keep record.mode as "line" or "word" for 100% Liquid-Lyrics `go(t)` validator compatibility
  const compatMode = record.mode === "word" ? "word" : "line";
  const updatedAt = Date.now();

  const payload = {
    ...record,
    version: 1,
    trackId,
    trackUri,
    mode: compatMode,
    updatedAt,
    draft: {
      ...record.draft,
      trackId,
      trackUri,
      updatedAt,
    },
  };

  localStorage.setItem(SYNC_PREFIX + trackUri, JSON.stringify(payload));

  // Also update index
  const existing = listCustomSyncs().filter(
    (entry) =>
      normalizeTrackUri(entry.trackUri || entry.trackId) !== trackUri &&
      extractTrackId(entry.trackId || entry.trackUri) !== trackId
  );
  existing.unshift({
    trackId,
    trackUri,
    title: payload.title || "Unknown Title",
    artist: payload.artist || "Unknown Artist",
    mode: compatMode,
    updatedAt,
  });
  saveCustomSyncIndex(existing);
  dispatchSyncChange(trackUri, trackId);
  return payload;
}

export function deleteCustomSync(trackOrUriOrId) {
  const existing = getCustomSync(trackOrUriOrId);
  const trackId = extractTrackId(
    typeof trackOrUriOrId === "object"
      ? trackOrUriOrId?.uri || trackOrUriOrId?.trackUri || trackOrUriOrId?.id
      : trackOrUriOrId
  );
  const trackUri = normalizeTrackUri(
    typeof trackOrUriOrId === "object"
      ? trackOrUriOrId?.uri || trackOrUriOrId?.trackUri || trackId
      : trackOrUriOrId
  );

  if (trackUri) localStorage.removeItem(SYNC_PREFIX + trackUri);
  if (trackId) {
    localStorage.removeItem(SYNC_PREFIX + trackId);
    localStorage.removeItem(SYNC_PREFIX + `spotify:track:${trackId}`);
  }

  const nextIndex = listCustomSyncs().filter(
    (entry) =>
      normalizeTrackUri(entry.trackUri || entry.trackId) !== trackUri &&
      extractTrackId(entry.trackId || entry.trackUri) !== trackId
  );
  saveCustomSyncIndex(nextIndex);
  dispatchSyncChange(existing?.trackUri || trackUri, existing?.trackId || trackId);
}

// ============================================================================
// Draft Line Helpers & Plain Text Parser / Serializer (Liquid Lyrics Compatible)
// ============================================================================

export function splitTextIntoTokens(text, prevTokens = []) {
  const words = String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.map((w, idx) => {
    const prev = prevTokens[idx];
    return {
      text: w,
      start: prev && prev.text === w ? prev.start ?? null : null,
      end: prev && prev.text === w ? prev.end ?? null : null,
    };
  });
}

export function createLyricDraftLine(text = "", isDuet = false, prevLine = null) {
  const clean = String(text ?? "").trim();
  const tokens = splitTextIntoTokens(clean, prevLine?.tokens || []);
  return {
    kind: "lyric",
    text: clean,
    isDuet: Boolean(isDuet ?? prevLine?.isDuet),
    tokens,
    backgrounds: prevLine?.backgrounds ? prevLine.backgrounds.map((b) => ({ ...b })) : [],
    start: prevLine?.start ?? null,
    end: prevLine?.end ?? null,
  };
}

export function createInterludeDraftLine(start = null, end = null) {
  return {
    kind: "interlude",
    start: start ?? null,
    end: end ?? null,
  };
}

export function createBackgroundDraftEntry(text = "", prevBg = null) {
  const clean = String(text ?? "").trim();
  return {
    text: clean,
    tokens: splitTextIntoTokens(clean, prevBg?.tokens || []),
    start: prevBg?.start ?? null,
    end: prevBg?.end ?? null,
  };
}

/**
 * Parses bulk editor text into draft lines while preserving existing timestamps
 * whenever lines match. Supports:
 * - `#interlude` or `♪` -> instrumental break
 * - `[background text]` below a lyric line -> attaches background vocal to that line
 * - `v2: lyric text` -> sets Duet (singer 2 / right-aligned) flag on that line
 */
export function parsePlainTextToDraftLines(rawText, prevLines = []) {
  const usedIndices = new Set();
  const takeMatchingPrev = (predicate) => {
    for (let i = 0; i < prevLines.length; i++) {
      if (usedIndices.has(i)) continue;
      const cand = prevLines[i];
      if (predicate(cand)) {
        usedIndices.add(i);
        return cand;
      }
    }
    return null;
  };

  const result = [];
  let lastLyricLine = null;

  for (const rawRow of String(rawText ?? "").split(/\r?\n/)) {
    let trimmed = rawRow.trim();
    if (!trimmed) continue;

    if (/^#interlude$/i.test(trimmed) || trimmed === "♪") {
      const prevInterlude = takeMatchingPrev((c) => c.kind === "interlude");
      result.push({
        kind: "interlude",
        start: prevInterlude?.start ?? null,
        end: prevInterlude?.end ?? null,
      });
      lastLyricLine = null;
      continue;
    }

    const bgMatch = trimmed.match(/^\[(.+)\]$/);
    if (bgMatch && lastLyricLine && !/^v[12]$/i.test(bgMatch[1].trim())) {
      const bgText = bgMatch[1].trim();
      if (!bgText) continue;
      const bgIdx = lastLyricLine.backgrounds.length;
      const prevBg = lastLyricLine._prevBgs?.[bgIdx];
      lastLyricLine.backgrounds.push(createBackgroundDraftEntry(bgText, prevBg));
      continue;
    }

    let isDuet = false;
    if (/^(?:v2\s*:|\[v2\])\s*/i.test(trimmed)) {
      isDuet = true;
      trimmed = trimmed.replace(/^(?:v2\s*:|\[v2\])\s*/i, "").trim();
    } else if (/^(?:v1\s*:|\[v1\])\s*/i.test(trimmed)) {
      trimmed = trimmed.replace(/^(?:v1\s*:|\[v1\])\s*/i, "").trim();
    }
    if (!trimmed) continue;

    const exactPrev =
      takeMatchingPrev((c) => c.kind === "lyric" && c.text === trimmed) ||
      takeMatchingPrev((c) => c.kind === "lyric");

    const lineObj = {
      kind: "lyric",
      text: trimmed,
      isDuet: isDuet || Boolean(exactPrev?.isDuet),
      tokens: splitTextIntoTokens(trimmed, exactPrev?.tokens || []),
      backgrounds: [],
      _prevBgs: exactPrev?.backgrounds || [],
      start: exactPrev?.start ?? null,
      end: exactPrev?.end ?? null,
    };

    result.push(lineObj);
    lastLyricLine = lineObj;
  }

  for (const item of result) {
    if (item.kind === "lyric") {
      delete item._prevBgs;
    }
  }

  return result;
}

export function serializeDraftLinesToText(lines = []) {
  const out = [];
  for (const line of lines) {
    if (!line) continue;
    if (line.kind === "interlude") {
      out.push("#interlude");
      continue;
    }
    const prefix = line.isDuet ? "v2: " : "";
    out.push(`${prefix}${line.text || ""}`);
    if (Array.isArray(line.backgrounds)) {
      for (const bg of line.backgrounds) {
        if (bg && bg.text) {
          out.push(`[${bg.text}]`);
        }
      }
    }
  }
  return out.join("\n");
}

// ============================================================================
// Compiler: Draft -> Spicy Lyrics / Liquid Lyrics Universal Payload
// ============================================================================

function findPreviousTimelineEnd(lines, fromIdx, fallbackStartMs = 0) {
  for (let i = fromIdx - 1; i >= 0; i--) {
    const cand = lines[i];
    if (!cand) continue;
    if (cand.kind === "interlude" && cand.end != null) return cand.end;
    if (cand.kind === "lyric") {
      const e = cand.end ?? cand.tokens?.[cand.tokens.length - 1]?.end ?? null;
      if (e != null) return e;
      const s = cand.start ?? cand.tokens?.[0]?.start ?? null;
      if (s != null) return s + 2500;
    }
  }
  return fallbackStartMs;
}

function findNextTimelineStart(lines, fromIdx, fallbackEndMs) {
  for (let i = fromIdx + 1; i < lines.length; i++) {
    const cand = lines[i];
    if (!cand) continue;
    if (cand.kind === "interlude" && cand.start != null) return cand.start;
    if (cand.kind === "lyric") {
      const s = cand.start ?? cand.tokens?.[0]?.start ?? null;
      if (s != null) return s;
    }
  }
  return fallbackEndMs;
}

export function isDraftLineComplete(line, mode) {
  if (!line) return false;
  if (mode === "static") return line.kind === "lyric" && Boolean(line.text?.trim());
  if (line.kind === "interlude") return line.start != null;
  if (mode === "line") return line.start != null;
  return (
    line.tokens.length > 0 &&
    line.tokens.every((t) => t.start != null) &&
    line.backgrounds.every((b) => b.tokens.length > 0 && b.tokens.every((t) => t.start != null))
  );
}

export function compileDraftToSpicyLyrics(draft) {
  const trackId = extractTrackId(draft.trackUri || draft.trackId);
  const credit = draft.credit?.trim() || undefined;
  const syncMode = draft.syncMode || draft.mode || "line";
  const lines = Array.isArray(draft.lines) ? draft.lines : [];
  const durationFallback = draft.endMs ?? (draft.durationMs > 0 ? draft.durationMs : 180000);

  // 1. Check if static mode or if zero timestamps exist across all lines
  const hasAnyTimestamp = lines.some((l) => {
    if (!l) return false;
    if (l.start != null) return true;
    if (l.kind === "lyric" && l.tokens?.some((tok) => tok.start != null)) return true;
    return false;
  });

  if (syncMode === "static" || !hasAnyTimestamp) {
    return {
      Id: trackId,
      Type: "Static",
      SongWriters: [],
      Lines: lines
        .filter((l) => l && l.kind === "lyric" && l.text?.trim())
        .map((l) => ({
          Text: l.text.trim(),
          OppositeAligned: Boolean(l.isDuet),
          IsRTL: false,
        })),
      Provider: "local",
      ...(credit ? { LiquidLyricsCredit: credit } : {}),
    };
  }

  // 2. Line-synced mode
  if (syncMode === "line") {
    const content = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      let start = l.start ?? l.tokens?.[0]?.start ?? null;
      const prevEnd = findPreviousTimelineEnd(lines, i, 0);
      const nextStart = findNextTimelineStart(lines, i, durationFallback);

      // Gracefully interpolate untimed interludes positioned between timed lines
      if (start == null && l.kind === "interlude" && nextStart > prevEnd + 1500) {
        start = prevEnd + 200;
      }
      if (start == null) continue;

      const rawEnd = l.end != null && l.end > start ? l.end : nextStart;
      const end = Math.max(start + 200, rawEnd || start + 3000);

      if (l.kind === "interlude") {
        content.push({
          Type: "Interlude",
          Text: "♪",
          StartTime: Math.round(start),
          EndTime: Math.round(end),
          OppositeAligned: false,
          IsRTL: false,
        });
      } else {
        const bgTexts = (l.backgrounds || []).map((b) => b.text?.trim()).filter(Boolean);
        content.push({
          Type: "Line",
          Text: l.text,
          StartTime: Math.round(start),
          EndTime: Math.round(end),
          OppositeAligned: Boolean(l.isDuet),
          IsRTL: false,
          ...(bgTexts.length ? { BackgroundText: `(${bgTexts.join(" ")})` } : {}),
        });
      }
    }

    content.sort((a, b) => (Number(a.StartTime) || 0) - (Number(b.StartTime) || 0));

    return {
      Id: trackId,
      Type: "Line",
      SongWriters: [],
      Content: content,
      StartTime: content[0]?.StartTime ?? 0,
      EndTime: content[content.length - 1]?.EndTime ?? durationFallback,
      Provider: "local",
      ...(credit ? { LiquidLyricsCredit: credit } : {}),
    };
  }

  // 3. Word-synced (Karaoke / Syllable) mode
  const content = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    const prevEnd = findPreviousTimelineEnd(lines, i, 0);
    const nextLineStart = findNextTimelineStart(lines, i, durationFallback);

    if (l.kind === "interlude") {
      let intStart = l.start;
      if (intStart == null && nextLineStart > prevEnd + 1500) {
        intStart = prevEnd + 200;
      }
      if (intStart == null) continue;
      const end = Math.max(intStart + 200, l.end != null && l.end > intStart ? l.end : nextLineStart);
      content.push({
        Type: "Vocal",
        OppositeAligned: false,
        IsRTL: false,
        Lead: {
          StartTime: Math.round(intStart),
          EndTime: Math.round(end),
          Syllables: [
            {
              Text: "♪",
              IsPartOfWord: false,
              StartTime: Math.round(intStart),
              EndTime: Math.round(end),
            },
          ],
        },
      });
      continue;
    }

    // Lyric line in word mode (also gracefully handles partially-timed lines!)
    const timedTokens = (l.tokens || []).filter((t) => t.start != null);
    const lineStart = timedTokens[0]?.start ?? l.start ?? null;
    if (lineStart == null) continue;

    const lineEndRaw = l.end != null && l.end > lineStart ? l.end : nextLineStart;
    const lineEnd = Math.max(lineStart + 200, lineEndRaw || lineStart + 3000);

    const tokenCount = Math.max(1, l.tokens.length);
    const sliceMs = (lineEnd - lineStart) / tokenCount;

    const syllables = l.tokens.map((tok, idx) => {
      const tStart = tok.start != null ? tok.start : Math.round(lineStart + idx * sliceMs);
      const nextTokStart = l.tokens[idx + 1]?.start;
      let tEnd = tok.end != null && tok.end > tStart ? tok.end : nextTokStart ?? lineEnd;
      if (tEnd <= tStart) tEnd = tStart + Math.max(100, Math.round(sliceMs));
      return {
        Text: tok.text,
        IsPartOfWord: false,
        StartTime: Math.round(tStart),
        EndTime: Math.round(tEnd),
      };
    });

    const leadStart = syllables[0]?.StartTime ?? Math.round(lineStart);
    const leadEnd = syllables[syllables.length - 1]?.EndTime ?? Math.round(lineEnd);

    const backgrounds = [];
    for (const bg of l.backgrounds || []) {
      if (!bg || !bg.tokens?.length) continue;
      const bgStart = bg.tokens[0]?.start ?? bg.start ?? leadStart + Math.round((leadEnd - leadStart) * 0.35);
      const bgEndRaw = bg.end != null && bg.end > bgStart ? bg.end : leadEnd;
      const bgEnd = Math.max(bgStart + 160, bgEndRaw);
      const bgSlice = (bgEnd - bgStart) / Math.max(1, bg.tokens.length);

      const bgSyllables = bg.tokens.map((bt, bIdx) => {
        const bs = bt.start != null ? bt.start : Math.round(bgStart + bIdx * bgSlice);
        const nextBs = bg.tokens[bIdx + 1]?.start;
        let be = bt.end != null && bt.end > bs ? bt.end : nextBs ?? bgEnd;
        if (be <= bs) be = bs + Math.max(90, Math.round(bgSlice));
        return {
          Text: bt.text,
          IsPartOfWord: false,
          StartTime: Math.round(bs),
          EndTime: Math.round(be),
        };
      });

      backgrounds.push({
        StartTime: bgSyllables[0]?.StartTime ?? Math.round(bgStart),
        EndTime: bgSyllables[bgSyllables.length - 1]?.EndTime ?? Math.round(bgEnd),
        Syllables: bgSyllables,
      });
    }

    content.push({
      Type: "Vocal",
      OppositeAligned: Boolean(l.isDuet),
      IsRTL: false,
      Lead: {
        StartTime: leadStart,
        EndTime: leadEnd,
        Syllables: syllables,
      },
      ...(backgrounds.length ? { Background: backgrounds } : {}),
    });
  }

  content.sort((a, b) => {
    const aStart = a.Lead?.StartTime ?? a.StartTime ?? 0;
    const bStart = b.Lead?.StartTime ?? b.StartTime ?? 0;
    return aStart - bStart;
  });

  return {
    Id: trackId,
    Type: "Syllable",
    SongWriters: [],
    Content: content,
    StartTime: content[0]?.Lead?.StartTime ?? 0,
    EndTime: content[content.length - 1]?.Lead?.EndTime ?? durationFallback,
    Provider: "local",
    ...(credit ? { LiquidLyricsCredit: credit } : {}),
  };
}

// ============================================================================
// Converter: Spicy / Liquid Lyrics Payload -> Fullscreen Reloaded Lines
// ============================================================================

function syllablesToWords(syllables = [], fallbackStartMs = 0, fallbackEndMs = 3000) {
  const words = [];
  let current = null;

  for (let i = 0; i < syllables.length; i++) {
    const syl = syllables[i];
    if (!syl) continue;
    const rawText = String(syl.Text ?? "");
    const trimmed = rawText.trim();
    if (!trimmed) continue;

    const sStart = syl.StartTime != null ? Number(syl.StartTime) : null;
    const sEnd = syl.EndTime != null ? Number(syl.EndTime) : null;
    const isPart = Boolean(syl.IsPartOfWord);

    if (!current) {
      current = {
        text: trimmed,
        startMs: sStart,
        endMs: sEnd,
        exactWordSync: true,
        _syllables: [{ text: trimmed, startMs: sStart, endMs: sEnd }],
      };
    } else {
      current.text += trimmed;
      if (sEnd != null) current.endMs = sEnd;
      current._syllables.push({ text: trimmed, startMs: sStart, endMs: sEnd });
    }

    if (!isPart || i === syllables.length - 1) {
      words.push(current);
      current = null;
    }
  }

  if (current) words.push(current);

  for (let k = 0; k < words.length; k++) {
    const isLast = k === words.length - 1;
    if (!isLast && !words[k].text.endsWith(" ")) {
      words[k].text += " ";
    }
    if (words[k].startMs == null) {
      words[k].startMs = k === 0 ? fallbackStartMs : words[k - 1].endMs ?? fallbackStartMs;
    }
    if (words[k].endMs == null || words[k].endMs <= words[k].startMs) {
      words[k].endMs = words[k + 1]?.startMs ?? fallbackEndMs;
    }
    finalizeWordSyllables(words[k]);
  }

  return words;
}

export function spicyLyricsToFullscreenLines(spicyData, defaultSource = "Spicy Lyrics") {
  if (!spicyData || typeof spicyData !== "object") return null;

  const source =
    spicyData.Provider === "local"
      ? spicyData.LiquidLyricsCredit
        ? `Local · ${spicyData.LiquidLyricsCredit}`
        : "FullLyrics Local"
      : defaultSource;

  // 1. Static (unsynced)
  if (spicyData.Type === "Static") {
    const rawLines = Array.isArray(spicyData.Lines) ? spicyData.Lines : [];
    const lines = rawLines
      .map((item) => {
        const text = String(item?.Text ?? "").trim();
        if (!text) return null;
        const parts = text.split(/\s+/).filter(Boolean);
        return {
          startMs: 0,
          endMs: 0,
          isWordSynced: false,
          isDuet: Boolean(item?.OppositeAligned),
          words: parts.map((w, idx) => ({
            text: idx < parts.length - 1 ? w + " " : w,
          })),
        };
      })
      .filter(Boolean);

    if (!lines.length) return null;
    return {
      type: "unsynced",
      source,
      lines,
    };
  }

  // 2. Line-synced
  if (spicyData.Type === "Line") {
    const content = Array.isArray(spicyData.Content) ? spicyData.Content : [];
    const lines = content
      .map((item, idx) => {
        if (!item) return null;
        const startMs = Number(item.StartTime) || 0;
        const nextStart = content[idx + 1] ? Number(content[idx + 1].StartTime) : startMs + 3500;
        const endMs = Number(item.EndTime) > startMs ? Number(item.EndTime) : nextStart;

        if (item.Type === "Interlude" || String(item.Text ?? "").trim() === "♪") {
          return {
            startMs,
            endMs,
            hasLineTime: true,
            isWordSynced: false,
            isDuet: false,
            words: [{ text: "♪", startMs, endMs }],
          };
        }

        const text = String(item.Text ?? "").trim();
        if (!text) return null;
        const parts = text.split(/\s+/).filter(Boolean);

        let bgVocal = null;
        if (item.BackgroundText) {
          const bgClean = String(item.BackgroundText).trim();
          const bgStart = startMs + Math.round((endMs - startMs) * 0.4);
          const bgParts = bgClean.split(/\s+/).filter(Boolean);
          bgVocal = {
            text: bgClean.startsWith("(") ? bgClean : `(${bgClean})`,
            startMs: bgStart,
            endMs,
            isWordSynced: false,
            words: bgParts.map((w, wIdx) => ({
              text: wIdx < bgParts.length - 1 ? w + " " : w,
              startMs: bgStart,
              endMs,
            })),
          };
        }

        return {
          startMs,
          endMs,
          hasLineTime: true,
          isWordSynced: false,
          isDuet: Boolean(item.OppositeAligned),
          bgVocal,
          words: parts.map((w, wIdx) => ({
            text: wIdx < parts.length - 1 ? w + " " : w,
            startMs,
            endMs,
          })),
        };
      })
      .filter(Boolean);

    if (!lines.length) return null;
    lines.sort((a, b) => (Number(a.startMs) || 0) - (Number(b.startMs) || 0));
    return {
      type: "synced",
      source,
      lines,
    };
  }

  // 3. Syllable / Word-synced
  if (spicyData.Type === "Syllable") {
    const content = Array.isArray(spicyData.Content) ? spicyData.Content : [];
    const lines = content
      .map((item, idx) => {
        if (!item) return null;
        if (item.Type === "Interlude") {
          const startMs = Number(item.StartTime) || 0;
          const endMs = Number(item.EndTime) || startMs + 3000;
          return {
            startMs,
            endMs,
            hasLineTime: true,
            isWordSynced: true,
            isDuet: false,
            words: [{ text: "♪", startMs, endMs }],
          };
        }

        const lead = item.Lead || item;
        const syllables = Array.isArray(lead?.Syllables) ? lead.Syllables : [];
        const startMs = Number(lead?.StartTime ?? syllables[0]?.StartTime) || 0;
        const nextStart = content[idx + 1]?.Lead?.StartTime
          ? Number(content[idx + 1].Lead.StartTime)
          : startMs + 3500;
        const endMs =
          Number(lead?.EndTime) > startMs
            ? Number(lead.EndTime)
            : Number(syllables[syllables.length - 1]?.EndTime) || nextStart;

        const words = syllablesToWords(syllables, startMs, endMs);
        if (!words.length) return null;

        // Check if it's an interlude vocal
        if (words.length === 1 && words[0].text.trim() === "♪") {
          return {
            startMs,
            endMs,
            hasLineTime: true,
            isWordSynced: true,
            isDuet: false,
            words: [{ text: "♪", startMs, endMs }],
          };
        }

        let bgVocal = null;
        if (Array.isArray(item.Background) && item.Background.length > 0) {
          const allBgWords = [];
          let bgStartMs = null;
          let bgEndMs = null;
          for (const bgItem of item.Background) {
            const bStart = Number(bgItem.StartTime) || startMs;
            const bEnd = Number(bgItem.EndTime) || endMs;
            if (bgStartMs == null || bStart < bgStartMs) bgStartMs = bStart;
            if (bgEndMs == null || bEnd > bgEndMs) bgEndMs = bEnd;
            const bWords = syllablesToWords(bgItem.Syllables || [], bStart, bEnd);
            allBgWords.push(...bWords);
          }
          if (allBgWords.length > 0) {
            // Ensure spaces between merged background groups
            for (let k = 0; k < allBgWords.length - 1; k++) {
              if (!allBgWords[k].text.endsWith(" ")) allBgWords[k].text += " ";
            }
            const rawBgText = allBgWords.map((w) => w.text).join("").trim();
            bgVocal = {
              text: rawBgText.startsWith("(") ? rawBgText : `(${rawBgText})`,
              startMs: bgStartMs ?? startMs,
              endMs: bgEndMs ?? endMs,
              isWordSynced: true,
              words: allBgWords,
            };
          }
        }

        return {
          startMs,
          endMs,
          hasLineTime: true,
          isWordSynced: true,
          isDuet: Boolean(item.OppositeAligned),
          bgVocal,
          words,
        };
      })
      .filter(Boolean);

    if (!lines.length) return null;
    lines.sort((a, b) => (Number(a.startMs) || 0) - (Number(b.startMs) || 0));
    return {
      type: "word-synced",
      source,
      lines,
    };
  }

  return null;
}

// ============================================================================
// Decompiler: Resolved Fullscreen Lines / Spicy JSON / TTML / LRC -> Draft
// ============================================================================

export function fullscreenLinesToDraft(resolvedData, trackInfo = {}) {
  const trackId = extractTrackId(trackInfo.trackUri || trackInfo.uri || trackInfo.trackId || "");
  const trackUri = normalizeTrackUri(trackInfo.trackUri || trackInfo.uri || trackId);
  const title = trackInfo.title || "Unknown Title";
  const artist = trackInfo.artist || "Unknown Artist";
  const durationMs = Number(trackInfo.durationMs) || 0;

  if (!resolvedData || !Array.isArray(resolvedData.lines) || !resolvedData.lines.length) {
    return {
      trackId,
      trackUri,
      title,
      artist,
      durationMs,
      mode: "word",
      syncMode: "word",
      credit: "",
      lines: [],
      endMs: durationMs > 0 ? durationMs : null,
      updatedAt: Date.now(),
    };
  }

  const syncMode =
    resolvedData.type === "word-synced"
      ? "word"
      : resolvedData.type === "synced"
      ? "line"
      : "static";

  const draftLines = [];
  for (const line of resolvedData.lines) {
    if (!line) continue;
    const rawWords = Array.isArray(line.words) ? line.words : [];
    const joinedText = rawWords
      .map((w) => (typeof w === "string" ? w : w.text || ""))
      .join("")
      .trim();

    if (joinedText === "♪" || joinedText === "🎵" || line._isMusic) {
      draftLines.push({
        kind: "interlude",
        start: line.startMs != null ? Math.round(line.startMs) : null,
        end: line.endMs != null ? Math.round(line.endMs) : null,
      });
      continue;
    }

    if (!joinedText) continue;

    const tokens = rawWords
      .map((w) => {
        const wText = (typeof w === "string" ? w : w.text || "").trim();
        if (!wText) return null;
        return {
          text: wText,
          start:
            syncMode === "word" && w.startMs != null
              ? Math.round(w.startMs)
              : syncMode === "line" && line.startMs != null
              ? null
              : null,
          end: syncMode === "word" && w.endMs != null ? Math.round(w.endMs) : null,
        };
      })
      .filter(Boolean);

    const backgrounds = [];
    if (line.bgVocal && line.bgVocal.text) {
      const cleanBg = String(line.bgVocal.text)
        .replace(/^\(|\)$/g, "")
        .trim();
      if (cleanBg) {
        const bgWords = Array.isArray(line.bgVocal.words) ? line.bgVocal.words : [];
        const bgTokens = bgWords.length
          ? bgWords
              .map((bw) => {
                const bt = String(bw.text || "")
                  .replace(/^\(|\)$/g, "")
                  .trim();
                if (!bt) return null;
                return {
                  text: bt,
                  start:
                    line.bgVocal.isWordSynced && bw.startMs != null ? Math.round(bw.startMs) : null,
                  end: line.bgVocal.isWordSynced && bw.endMs != null ? Math.round(bw.endMs) : null,
                };
              })
              .filter(Boolean)
          : splitTextIntoTokens(cleanBg);

        backgrounds.push({
          text: cleanBg,
          tokens: bgTokens,
          start: line.bgVocal.startMs != null ? Math.round(line.bgVocal.startMs) : null,
          end: line.bgVocal.endMs != null ? Math.round(line.bgVocal.endMs) : null,
        });
      }
    }

    draftLines.push({
      kind: "lyric",
      text: tokens.map((t) => t.text).join(" "),
      isDuet: Boolean(line.isDuet),
      tokens,
      backgrounds,
      start: syncMode !== "static" && line.startMs != null ? Math.round(line.startMs) : null,
      end: syncMode !== "static" && line.endMs != null ? Math.round(line.endMs) : null,
    });
  }

  const lastLine = draftLines[draftLines.length - 1];
  const inferredEndMs = lastLine?.end ?? (durationMs > 0 ? durationMs : null);

  return {
    trackId,
    trackUri,
    title,
    artist,
    durationMs,
    mode: syncMode === "word" ? "word" : "line",
    syncMode,
    credit: "",
    lines: draftLines,
    endMs: inferredEndMs,
    updatedAt: Date.now(),
  };
}

/**
 * Imports any external lyrics file (.json, .ttml, .xml, .lrc, .txt) into a Draft object.
 */
export function importFileToDraft(fileContent, fileName = "", trackInfo = {}) {
  const lower = String(fileName || "").toLowerCase();
  const trimmed = String(fileContent || "").trim();
  if (!trimmed) throw new Error("Empty file");

  // 1. JSON (Liquid Lyrics custom sync record OR raw Spicy Lyrics JSON)
  if (lower.endsWith(".json") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    if (parsed && parsed.draft && Array.isArray(parsed.draft.lines)) {
      const d = parsed.draft;
      const trackId = extractTrackId(trackInfo.trackUri || d.trackUri || d.trackId);
      const trackUri = normalizeTrackUri(trackInfo.trackUri || d.trackUri || trackId);
      return {
        ...d,
        trackId,
        trackUri,
        title: trackInfo.title || d.title || parsed.title || "Unknown Title",
        artist: trackInfo.artist || d.artist || parsed.artist || "Unknown Artist",
        durationMs: trackInfo.durationMs || d.durationMs || 0,
        syncMode: d.syncMode || d.mode || "line",
        mode: d.mode === "word" ? "word" : "line",
        lines: d.lines.map((l) =>
          l.kind === "interlude"
            ? { kind: "interlude", start: l.start ?? null, end: l.end ?? null }
            : {
                kind: "lyric",
                text: l.text || "",
                isDuet: Boolean(l.isDuet),
                tokens: (l.tokens || []).map((t) => ({
                  text: t.text,
                  start: t.start ?? null,
                  end: t.end ?? null,
                })),
                backgrounds: (l.backgrounds || []).map((b) => ({
                  text: b.text || "",
                  tokens: (b.tokens || []).map((bt) => ({
                    text: bt.text,
                    start: bt.start ?? null,
                    end: bt.end ?? null,
                  })),
                  start: b.start ?? null,
                  end: b.end ?? null,
                })),
                start: l.start ?? null,
                end: l.end ?? null,
              }
        ),
      };
    }

    if (parsed && (parsed.Type === "Syllable" || parsed.Type === "Line" || parsed.Type === "Static")) {
      const resolved = spicyLyricsToFullscreenLines(parsed);
      return fullscreenLinesToDraft(resolved, trackInfo);
    }
    throw new Error("Unsupported JSON format");
  }

  // 2. TTML / XML
  if (lower.endsWith(".ttml") || lower.endsWith(".xml") || trimmed.includes("<tt")) {
    const lines = parseTTML(trimmed);
    if (!lines.length) throw new Error("No valid lyrics found in TTML file");
    const isWord = lines.some((l) => l.isWordSynced);
    const isLine = lines.some((l) => l.hasLineTime);
    return fullscreenLinesToDraft(
      {
        type: isWord ? "word-synced" : isLine ? "synced" : "unsynced",
        lines,
      },
      trackInfo
    );
  }

  // 3. LRC / Enhanced LRC
  if (lower.endsWith(".lrc") || /^\s*\[\d+:\d+/m.test(trimmed)) {
    const lines = parseLRC(trimmed);
    if (!lines.length) throw new Error("No valid lyrics found in LRC file");
    const isWord = lines.some((l) => l.isWordSynced);
    return fullscreenLinesToDraft(
      {
        type: isWord ? "word-synced" : "synced",
        lines,
      },
      trackInfo
    );
  }

  // 4. Plain Text (.txt)
  const draftLines = parsePlainTextToDraftLines(trimmed, []);
  const trackId = extractTrackId(trackInfo.trackUri || trackInfo.trackId || "");
  const trackUri = normalizeTrackUri(trackInfo.trackUri || trackId);
  return {
    trackId,
    trackUri,
    title: trackInfo.title || "Unknown Title",
    artist: trackInfo.artist || "Unknown Artist",
    durationMs: Number(trackInfo.durationMs) || 0,
    mode: "word",
    syncMode: "word",
    credit: "",
    lines: draftLines,
    endMs: Number(trackInfo.durationMs) || null,
    updatedAt: Date.now(),
  };
}

// ============================================================================
// Exporters: JSON (Liquid Lyrics), TTML (Apple Music / Spicy), LRC (Enhanced)
// ============================================================================

function formatTTMLTimestamp(ms) {
  const safe = Math.max(0, Math.round(Number(ms) || 0));
  const totalSec = Math.floor(safe / 1000);
  const milli = safe % 1000;
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const msStr = String(milli).padStart(3, "0");
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${msStr}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${msStr}`;
}

function escapeXml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function exportDraftAsTTML(draft) {
  const compiled = compileDraftToSpicyLyrics(draft);
  const timingMode =
    compiled.Type === "Syllable" ? "Word" : compiled.Type === "Line" ? "Line" : "None";

  const pNodes = [];

  if (compiled.Type === "Static") {
    for (const l of compiled.Lines || []) {
      const agentAttr = l.OppositeAligned ? ' ttm:agent="v2"' : ' ttm:agent="v1"';
      pNodes.push(`      <p${agentAttr}>${escapeXml(l.Text)}</p>`);
    }
  } else if (compiled.Type === "Line") {
    for (const item of compiled.Content || []) {
      if (item.Type === "Interlude") continue;
      const begin = formatTTMLTimestamp(item.StartTime);
      const end = formatTTMLTimestamp(item.EndTime);
      const agentAttr = item.OppositeAligned ? ' ttm:agent="v2"' : ' ttm:agent="v1"';
      const bgPart = item.BackgroundText
        ? ` <span ttm:role="x-bg">${escapeXml(item.BackgroundText)}</span>`
        : "";
      pNodes.push(
        `      <p begin="${begin}" end="${end}"${agentAttr}>${escapeXml(item.Text)}${bgPart}</p>`
      );
    }
  } else if (compiled.Type === "Syllable") {
    for (const item of compiled.Content || []) {
      const lead = item.Lead;
      if (!lead || !Array.isArray(lead.Syllables) || !lead.Syllables.length) continue;
      if (lead.Syllables.length === 1 && lead.Syllables[0].Text === "♪") continue;

      const begin = formatTTMLTimestamp(lead.StartTime);
      const end = formatTTMLTimestamp(lead.EndTime);
      const agentAttr = item.OppositeAligned ? ' ttm:agent="v2"' : ' ttm:agent="v1"';

      const mainSpans = lead.Syllables.map((s) => {
        const sBegin = formatTTMLTimestamp(s.StartTime);
        const sEnd = formatTTMLTimestamp(s.EndTime);
        return `<span begin="${sBegin}" end="${sEnd}">${escapeXml(s.Text)}</span>`;
      }).join(" ");

      let bgSpans = "";
      if (Array.isArray(item.Background) && item.Background.length) {
        const bgParts = item.Background.map((bg) => {
          const bBegin = formatTTMLTimestamp(bg.StartTime);
          const bEnd = formatTTMLTimestamp(bg.EndTime);
          const inner = (bg.Syllables || [])
            .map(
              (bs) =>
                `<span begin="${formatTTMLTimestamp(bs.StartTime)}" end="${formatTTMLTimestamp(bs.EndTime)}">${escapeXml(bs.Text)}</span>`
            )
            .join(" ");
          return `<span ttm:role="x-bg" begin="${bBegin}" end="${bEnd}">${inner}</span>`;
        });
        bgSpans = " " + bgParts.join(" ");
      }

      pNodes.push(`      <p begin="${begin}" end="${end}"${agentAttr}>${mainSpans}${bgSpans}</p>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml"
    xmlns:ttm="http://www.w3.org/ns/ttml#metadata"
    xmlns:itunes="http://music.apple.com/lyric-ttml-internal"
    itunes:timing="${timingMode}">
  <head>
    <metadata>
      <ttm:title>${escapeXml(draft.title || "")}</ttm:title>
      <ttm:agent xml:id="v1" type="person"/>
      <ttm:agent xml:id="v2" type="person"/>
    </metadata>
  </head>
  <body>
    <div>
${pNodes.join("\n")}
    </div>
  </body>
</tt>
`;
}

function formatLRCTimestamp(ms, bracket = "[") {
  const close = bracket === "<" ? ">" : "]";
  const safe = Math.max(0, Math.round(Number(ms) || 0));
  const mins = Math.floor(safe / 60000);
  const secs = Math.floor((safe % 60000) / 1000);
  const cs = Math.floor((safe % 1000) / 10);
  return `${bracket}${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}${close}`;
}

export function exportDraftAsLRC(draft) {
  const compiled = compileDraftToSpicyLyrics(draft);
  const header = [
    `[ti:${draft.title || ""}]`,
    `[ar:${draft.artist || ""}]`,
    `[by:${draft.credit || "FullLyrics Creator (Fullscreen Reloaded)"}]`,
    "",
  ];

  if (compiled.Type === "Static") {
    return [...header, ...(compiled.Lines || []).map((l) => l.Text)].join("\n");
  }

  if (compiled.Type === "Line") {
    const body = (compiled.Content || []).map((item) => {
      const tag = formatLRCTimestamp(item.StartTime, "[");
      if (item.Type === "Interlude") return `${tag} ♪`;
      const duetPrefix = item.OppositeAligned ? "v2: " : "";
      const bgSuffix = item.BackgroundText ? ` ${item.BackgroundText}` : "";
      return `${tag}${duetPrefix}${item.Text}${bgSuffix}`;
    });
    return [...header, ...body].join("\n");
  }

  if (compiled.Type === "Syllable") {
    const body = (compiled.Content || []).map((item) => {
      const lead = item.Lead;
      const lineTag = formatLRCTimestamp(lead.StartTime, "[");
      const duetPrefix = item.OppositeAligned ? "v2: " : "";
      const words = (lead.Syllables || [])
        .map((s) => `${formatLRCTimestamp(s.StartTime, "<")}${s.Text}`)
        .join(" ");
      let bgSuffix = "";
      if (Array.isArray(item.Background) && item.Background.length) {
        const bgWords = item.Background.flatMap((b) => b.Syllables || [])
          .map((bs) => bs.Text)
          .join(" ");
        if (bgWords) bgSuffix = ` (${bgWords})`;
      }
      return `${lineTag}${duetPrefix}${words}${bgSuffix}`;
    });
    return [...header, ...body].join("\n");
  }

  return header.join("\n");
}

export function exportDraftAsJSON(draft) {
  const trackId = extractTrackId(draft.trackUri || draft.trackId);
  const trackUri = normalizeTrackUri(draft.trackUri || trackId);
  const compatMode = draft.syncMode === "word" || draft.mode === "word" ? "word" : "line";
  const lyrics = compileDraftToSpicyLyrics(draft);
  const payload = {
    version: 1,
    trackId,
    trackUri,
    title: draft.title || "Unknown Title",
    artist: draft.artist || "Unknown Artist",
    durationMs: Number(draft.durationMs) || 0,
    mode: compatMode,
    ...(draft.credit?.trim() ? { credit: draft.credit.trim() } : {}),
    updatedAt: Date.now(),
    lyrics,
    draft: {
      ...draft,
      trackId,
      trackUri,
      mode: compatMode,
      updatedAt: Date.now(),
    },
  };
  return JSON.stringify(payload, null, 2);
}
