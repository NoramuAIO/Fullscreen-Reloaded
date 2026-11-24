/**
 * Letter-by-letter grapheme segmentation, syllable boundary normalization,
 * sub-character timeline mapping, and Gaussian liquid-wave kinematics.
 */

const RTL_OR_COMPLEX_RE = /[\u0590-\u08FF\u0900-\u0DFF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const WHITESPACE_RE = /^\s+$/;
let PUNCT_RE = null;
try {
  PUNCT_RE = /^[\p{P}\p{S}]+$/u;
} catch (_) {
  PUNCT_RE = /^[.,!?;:'"()[\]{}\-–—…/\\@#$%^&*+=~`|<>]+$/;
}

let _graphemeSegmenter = null;
function getSegmenter() {
  if (_graphemeSegmenter === null && typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    _graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  }
  return _graphemeSegmenter;
}

export function clamp01(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function smoothstep(edge0, edge1, x) {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Splits a string into user-perceived grapheme clusters (preserving accents,
 * Turkish diacritics, surrogate pairs, and emoji sequences).
 */
export function segmentGraphemes(text) {
  const str = String(text ?? "");
  if (!str) return [];
  const seg = getSegmenter();
  if (seg) {
    const out = [];
    for (const part of seg.segment(str)) {
      if (part && part.segment) out.push(part.segment);
    }
    return out;
  }
  return Array.from(str);
}

/**
 * Returns true if the word is safe and meaningful to animate character-by-character.
 * Skips complex joining/RTL scripts where per-glyph inline-block spans break shaping.
 */
export function canAnimateLetters(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return false;
  if (RTL_OR_COMPLEX_RE.test(trimmed)) return false;
  return true;
}

/**
 * Normalizes internal `_syllables` metadata on a combined word object into a
 * monotonic `syllables` array whenever 2+ syllable spans form a single word.
 */
export function finalizeWordSyllables(word) {
  if (!word || typeof word !== "object") return;
  const raw = word._syllables;
  delete word._syllables;
  if (!Array.isArray(raw) || raw.length < 2) return;

  const wStart = Number(word.startMs) || 0;
  const wEnd = Math.max(wStart + 20, Number(word.endMs) || wStart + 200);
  const totalSpan = wEnd - wStart;
  const normalized = [];

  for (let i = 0; i < raw.length; i++) {
    const syl = raw[i];
    if (!syl) continue;
    const text = String(syl.text ?? "").trim();
    if (!text) continue;

    const fallbackStart =
      i === 0 ? wStart : normalized[normalized.length - 1]?.endMs ?? wStart;
    const rawStart = syl.startMs != null && Number.isFinite(Number(syl.startMs))
      ? Number(syl.startMs)
      : fallbackStart;
    const sStart = Math.max(wStart, Math.min(wEnd - 1, rawStart));

    let rawEnd = syl.endMs != null && Number.isFinite(Number(syl.endMs)) ? Number(syl.endMs) : null;
    if (rawEnd == null || rawEnd <= sStart) {
      const nextSyl = raw[i + 1];
      const nextStart = nextSyl?.startMs != null ? Number(nextSyl.startMs) : null;
      if (nextStart != null && nextStart > sStart) {
        rawEnd = nextStart;
      } else {
        const remainingRatio = 1 / Math.max(1, raw.length - i);
        rawEnd = sStart + Math.max(20, (wEnd - sStart) * remainingRatio);
      }
    }
    const sEnd = Math.min(wEnd, Math.max(sStart + 10, rawEnd));
    normalized.push({
      text,
      startMs: sStart,
      endMs: Math.min(wEnd, sEnd),
    });
  }

  if (normalized.length >= 2 && totalSpan > 0) {
    normalized[normalized.length - 1].endMs = Math.max(
      normalized[normalized.length - 1].startMs + 10,
      Math.min(wEnd, Math.max(normalized[normalized.length - 1].endMs, wEnd - 1))
    );
    word.syllables = normalized;
  }
}

function getCharWeight(grapheme) {
  return PUNCT_RE.test(grapheme) ? 0.25 : 1.0;
}

function distributeSlots(items, startMs, endMs) {
  const count = items.length;
  if (!count) return;
  const span = Math.max(20, endMs - startMs);
  let totalWeight = 0;
  for (let i = 0; i < count; i++) {
    totalWeight += items[i].weight;
  }
  if (totalWeight <= 0) totalWeight = count;

  let cursor = startMs;
  for (let i = 0; i < count; i++) {
    const portion = (items[i].weight / totalWeight) * span;
    const slotEnd = i === count - 1 ? startMs + span : cursor + portion;
    items[i].rawStart = cursor;
    items[i].rawEnd = Math.max(cursor + 5, slotEnd);
    cursor = slotEnd;
  }
}

/**
 * Builds grapheme entries and smooth overlapping fill intervals for a word object.
 * Uses exact inner `syllables` timing when available, otherwise weights graphemes cleanly.
 */
export function buildCharTimeline(wordObj) {
  const text = String(wordObj?.text ?? "");
  const graphemes = segmentGraphemes(text);
  const wStart = Number(wordObj?.startMs) || 0;
  const wEnd = Math.max(wStart + 40, Number(wordObj?.endMs) || wStart + 350);

  const entries = [];
  const visible = [];

  for (let i = 0; i < graphemes.length; i++) {
    const ch = graphemes[i];
    const isSpace = WHITESPACE_RE.test(ch);
    const entry = {
      text: ch,
      isSpace,
      weight: isSpace ? 0 : getCharWeight(ch),
      rawStart: wStart,
      rawEnd: wEnd,
      fillStartMs: wStart,
      fillEndMs: wEnd,
      normCenter: 0.5,
    };
    entries.push(entry);
    if (!isSpace) visible.push(entry);
  }

  const n = visible.length;
  if (n === 0) {
    return { entries, visible };
  }

  let usedSyllables = false;
  if (Array.isArray(wordObj?.syllables) && wordObj.syllables.length > 1) {
    const sylGroups = wordObj.syllables
      .map((s) => ({
        chars: segmentGraphemes(String(s?.text ?? "").trim()).filter((g) => !WHITESPACE_RE.test(g)),
        startMs: Number(s?.startMs),
        endMs: Number(s?.endMs),
      }))
      .filter((g) => g.chars.length > 0 && Number.isFinite(g.startMs) && Number.isFinite(g.endMs));

    const expectedVisible = visible.map((v) => v.text).join("");
    const sylJoined = sylGroups.map((g) => g.chars.join("")).join("");
    if (sylGroups.length > 1 && sylJoined === expectedVisible) {
      let offset = 0;
      for (let gIdx = 0; gIdx < sylGroups.length; gIdx++) {
        const grp = sylGroups[gIdx];
        const slice = visible.slice(offset, offset + grp.chars.length);
        const sStart = Math.max(wStart, Math.min(wEnd, grp.startMs));
        const sEnd = Math.max(sStart + 10, Math.min(wEnd, grp.endMs));
        distributeSlots(slice, sStart, sEnd);
        offset += grp.chars.length;
      }
      usedSyllables = true;
    }
  }

  if (!usedSyllables) {
    distributeSlots(visible, wStart, wEnd);
  }

  // Smooth neighbor overlap so adjacent characters blend like a liquid light ribbon
  for (let i = 0; i < n; i++) {
    const cur = visible[i];
    const slotSpan = Math.max(12, cur.rawEnd - cur.rawStart);
    const padBefore = i === 0 ? 0 : Math.min(slotSpan * 0.28, Math.max(0, (cur.rawStart - wStart) * 0.55));
    const padAfter = i === n - 1 ? 0 : Math.min(slotSpan * 0.28, Math.max(0, (wEnd - cur.rawEnd) * 0.55));
    cur.fillStartMs = i === 0 ? wStart : Math.max(wStart, cur.rawStart - padBefore);
    cur.fillEndMs = i === n - 1 ? wEnd : Math.min(wEnd, cur.rawEnd + padAfter);
    if (cur.fillEndMs <= cur.fillStartMs) {
      cur.fillEndMs = Math.min(wEnd, cur.fillStartMs + 20);
    }
    cur.normCenter = (i + 0.5) / n;
  }

  return { entries, visible };
}

/**
 * Evaluates the current vocal focal point and Gaussian crest parameters
 * at `progressMs` within an active word `[wStart, wEnd]`.
 */
export function computeWordWaveParams(visible, progressMs, wStart, wEnd, options = {}) {
  const n = visible.length;
  const wordDur = Math.max(40, wEnd - wStart);
  const wordProgress = clamp01((progressMs - wStart) / wordDur);
  const wfMode = options.wfMode || "normal";
  const dropScale = Number.isFinite(options.dropScale) ? options.dropScale : 1;

  let focalNorm = wordProgress;
  if (n > 0) {
    if (progressMs <= visible[0].rawStart) {
      focalNorm = 0;
    } else if (progressMs >= visible[n - 1].rawEnd) {
      focalNorm = 1;
    } else {
      for (let i = 0; i < n; i++) {
        const slot = visible[i];
        if (progressMs <= slot.rawEnd) {
          const span = Math.max(1, slot.rawEnd - slot.rawStart);
          const localT = clamp01((progressMs - slot.rawStart) / span);
          focalNorm = (i + localT) / n;
          break;
        }
      }
    }
  }

  // Smooth attack and settle envelope so glyphs rest onto baseline before word ends
  const edgeEnv = smoothstep(0, 0.14, wordProgress) * (1 - smoothstep(0.74, 1.0, wordProgress));
  const glowEnv = smoothstep(0, 0.12, wordProgress) * (1 - smoothstep(0.82, 1.0, wordProgress));

  // Scale expressiveness cleanly: crisp on rapid words, lush on sustained held vocals
  const durAmp = Math.max(0.45, Math.min(1.18, 0.45 + (wordDur - 120) / 560));

  const baseLift = wfMode === "intense" ? -7.2 : wfMode === "off" ? -2.0 : -5.2;
  const baseScale = wfMode === "intense" ? 0.08 : wfMode === "off" ? 0.025 : 0.06;
  const rawLift = baseLift * dropScale * durAmp * edgeEnv;

  return {
    wordProgress,
    focalNorm,
    sigma: Math.max(0.16, 1.45 / Math.max(2, n)),
    maxLiftPx: rawLift === 0 ? 0 : rawLift,
    maxScaleDelta: baseScale * dropScale * durAmp * edgeEnv,
    glowEnv,
  };
}
