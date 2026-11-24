/**
 * Parsers for synchronized lyrics formats (TTML, Enhanced LRC, and standard LRC).
 * - Preserves true word/syllable timestamps.
 * - Extracts Apple Music Background Vocals (`ttm:role="x-bg"` and parenthetical ad-libs)
 *   and Duet singer alignment (`ttm:agent="v2"` / `v2:`).
 */

import { finalizeWordSyllables } from "./letterTiming.js";

function isBgSpan(span, stopNode) {
  let curr = span;
  while (curr && curr !== stopNode) {
    const role = curr.getAttribute?.("ttm:role") || curr.getAttribute?.("role") || "";
    if (role === "x-bg") return true;
    curr = curr.parentElement || curr.parentNode;
  }
  return false;
}

function isIgnoredRole(span, stopNode) {
  let curr = span;
  while (curr && curr !== stopNode) {
    const role = curr.getAttribute?.("ttm:role") || curr.getAttribute?.("role") || "";
    if (role === "x-translation" || role === "x-roman") return true;
    curr = curr.parentElement || curr.parentNode;
  }
  return false;
}

function extractWordsFromSpans(spans, fallbackStartMs, fallbackEndMs) {
  const words = [];
  let currentWord = null;

  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    const rawText = s.textContent || "";
    const trimmed = rawText.trim();
    if (!trimmed.length) continue;

    const wStart = parseTTMLTime(s.getAttribute("begin"));
    const wEnd = parseTTMLTime(s.getAttribute("end"));

    let hasTrailingSpace = /\s$/.test(rawText);
    if (!hasTrailingSpace && s.nextSibling) {
      if (s.nextSibling.nodeType === 3 && /\s/.test(s.nextSibling.nodeValue || "")) {
        hasTrailingSpace = true;
      }
    }
    if (i === spans.length - 1) {
      hasTrailingSpace = true;
    }

    if (!currentWord) {
      currentWord = {
        text: trimmed,
        startMs: wStart,
        endMs: wEnd,
        exactWordSync: true,
        _syllables: [{ text: trimmed, startMs: wStart, endMs: wEnd }],
      };
    } else {
      currentWord.text += trimmed;
      if (wEnd != null) currentWord.endMs = wEnd;
      currentWord._syllables.push({ text: trimmed, startMs: wStart, endMs: wEnd });
    }

    if (hasTrailingSpace) {
      const isLast = i === spans.length - 1;
      currentWord.text = isLast ? currentWord.text : currentWord.text + " ";
      words.push(currentWord);
      currentWord = null;
    }
  }

  if (currentWord) {
    words.push(currentWord);
  }

  const hasValidWordTimes = words.some((w) => w.startMs != null);
  if (words.length && hasValidWordTimes) {
    const startMs = fallbackStartMs != null ? fallbackStartMs : words[0].startMs || 0;
    const endMs = fallbackEndMs != null ? fallbackEndMs : words[words.length - 1].endMs || startMs + 3000;

    for (let k = 0; k < words.length; k++) {
      if (words[k].startMs == null) {
        words[k].startMs = k === 0 ? startMs : words[k - 1].endMs || startMs;
      }
      if (words[k].endMs == null || words[k].endMs <= words[k].startMs) {
        words[k].endMs = words[k + 1]?.startMs || endMs;
      }
      finalizeWordSyllables(words[k]);
    }
  } else {
    for (let k = 0; k < words.length; k++) {
      delete words[k]._syllables;
    }
  }

  return { words, hasValidWordTimes };
}

/**
 * Splits trailing parenthetical background vocals from a line-synced text string:
 * e.g. "Neden ağlattın? (neden, neden)" -> main: "Neden ağlattın?", bg: "(neden, neden)"
 * Also detects standalone parenthetical lines like "(Yeah, ooh)".
 */
export function splitParentheticalBg(rawText, startMs = 0, endMs = 3000) {
  const trimmed = String(rawText || "").trim();
  if (!trimmed) return { mainText: "", bgVocal: null, isBgOnly: false };

  // Case 1: Entire line is inside parentheses "(...)" with no outside text
  if (/^\([^()]+\)$/.test(trimmed) && trimmed.length >= 4) {
    return { mainText: trimmed, bgVocal: null, isBgOnly: true };
  }

  // Case 2: Main lyric followed by a trailing parenthetical vocal at the end: "Main lyric (bg vocal)"
  const m = trimmed.match(/^(.*?[^\s(])\s+(\([^()]{2,65}\))$/);
  if (m) {
    const mainText = m[1].trim();
    const bgText = m[2].trim();
    if (mainText.length >= 2 && bgText.length >= 3) {
      const dur = Math.max(800, (endMs || startMs + 3000) - startMs);
      const bgStart = startMs + Math.round(dur * 0.42);
      const bgEnd = startMs + Math.round(dur * 0.98);
      const bgParts = bgText.split(/\s+/).filter(Boolean);
      return {
        mainText,
        isBgOnly: false,
        bgVocal: {
          text: bgText,
          startMs: bgStart,
          endMs: bgEnd,
          isWordSynced: false,
          words: bgParts.map((w, idx) => ({
            text: idx < bgParts.length - 1 ? w + " " : w,
            startMs: bgStart,
            endMs: bgEnd,
          })),
        },
      };
    }
  }

  return { mainText: trimmed, bgVocal: null, isBgOnly: false };
}

export function parseTTML(ttmlString) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(ttmlString, "application/xml");
  } catch (e) {
    return [];
  }

  const ttEl = doc.documentElement;
  const rootTiming = (
    ttEl?.getAttribute("lrc:timing") ||
    ttEl?.getAttribute("itunes:timing") ||
    ""
  ).toLowerCase();

  const paragraphs = Array.from(doc.getElementsByTagName("p"));
  const lines = [];
  let primaryAgent = null;

  for (const p of paragraphs) {
    const agent = (p.getAttribute("ttm:agent") || p.getAttribute("agent") || "").trim();
    if (agent && !primaryAgent) {
      primaryAgent = agent;
    }
    const isDuet = Boolean(agent && primaryAgent && agent !== primaryAgent);
    const pRole = p.getAttribute("ttm:role") || p.getAttribute("role") || "";

    // Collect only leaf spans (spans that do not wrap nested child spans)
    // so container <span ttm:role="x-bg"> elements are not duplicated alongside their children
    const rawSpans = Array.from(p.getElementsByTagName("span")).filter(
      (s) => !isIgnoredRole(s, p)
    );
    const leafSpans = rawSpans.filter((s) => {
      const childSpans = Array.from(s.getElementsByTagName("span")).filter(
        (cs) => !isIgnoredRole(cs, p)
      );
      return childSpans.length === 0;
    });

    const lineStart = parseTTMLTime(p.getAttribute("begin"));
    const lineEnd = parseTTMLTime(p.getAttribute("end"));

    if (leafSpans.length && rootTiming !== "line") {
      const mainSpans = [];
      const bgSpans = [];

      for (const s of leafSpans) {
        if (pRole === "x-bg" || isBgSpan(s, p)) {
          bgSpans.push(s);
        } else {
          mainSpans.push(s);
        }
      }

      const mainRes = extractWordsFromSpans(mainSpans, lineStart, lineEnd);
      const bgRes = extractWordsFromSpans(bgSpans, null, lineEnd);

      let bgVocal = null;
      if (bgRes.words.length > 0) {
        const bgStartMs = bgRes.words[0].startMs ?? lineStart ?? 0;
        const bgEndMs =
          bgRes.words[bgRes.words.length - 1].endMs ?? lineEnd ?? bgStartMs + 2200;
        bgVocal = {
          text: bgRes.words.map((w) => w.text).join("").trim(),
          startMs: bgStartMs,
          endMs: bgEndMs,
          isWordSynced: bgRes.hasValidWordTimes,
          words: bgRes.words,
        };
      }

      if (mainRes.words.length && mainRes.hasValidWordTimes) {
        const startMs = lineStart != null ? lineStart : mainRes.words[0].startMs || 0;
        const endMs =
          lineEnd != null
            ? lineEnd
            : mainRes.words[mainRes.words.length - 1].endMs || startMs + 3000;

        lines.push({
          startMs,
          endMs,
          hasLineTime: true,
          isWordSynced: true,
          isDuet,
          isBgOnly: false,
          words: mainRes.words,
          bgVocal,
        });
        continue;
      } else if (!mainRes.words.length && bgVocal && bgRes.hasValidWordTimes) {
        // Standalone background vocal paragraph
        lines.push({
          startMs: bgVocal.startMs,
          endMs: bgVocal.endMs,
          hasLineTime: true,
          isWordSynced: true,
          isDuet,
          isBgOnly: true,
          words: bgVocal.words,
          bgVocal: null,
        });
        continue;
      }
    }

    // Fallback: line-synced or unsynced <p>
    let mainText = "";
    let bgTextFromSpan = "";

    // Check if there is a direct <span ttm:role="x-bg"> inside a line-timed <p>
    const bgContainers = Array.from(p.getElementsByTagName("span")).filter(
      (s) => (s.getAttribute("ttm:role") || s.getAttribute("role")) === "x-bg"
    );
    if (bgContainers.length > 0) {
      bgTextFromSpan = bgContainers.map((b) => (b.textContent || "").trim()).join(" ").trim();
      const clone = p.cloneNode(true);
      Array.from(clone.getElementsByTagName("span")).forEach((s) => {
        const r = s.getAttribute("ttm:role") || s.getAttribute("role") || "";
        if (r === "x-bg" || r === "x-translation" || r === "x-roman") {
          s.parentNode?.removeChild(s);
        }
      });
      mainText = (clone.textContent || "").trim();
    } else {
      mainText = (p.textContent || "").trim();
    }

    if (mainText.length || bgTextFromSpan.length) {
      const hasLineTime = lineStart != null;
      const startMs = lineStart || 0;
      const endMs = lineEnd || startMs + 3500;

      let bgVocal = null;
      let isBgOnly = pRole === "x-bg";

      if (bgTextFromSpan && mainText) {
        const bgStart = startMs + Math.round((endMs - startMs) * 0.4);
        const bgParts = bgTextFromSpan.split(/\s+/).filter(Boolean);
        bgVocal = {
          text: bgTextFromSpan,
          startMs: bgStart,
          endMs,
          isWordSynced: false,
          words: bgParts.map((w, idx) => ({
            text: idx < bgParts.length - 1 ? w + " " : w,
            startMs: bgStart,
            endMs,
          })),
        };
      } else if (!mainText && bgTextFromSpan) {
        mainText = bgTextFromSpan;
        isBgOnly = true;
      } else if (hasLineTime) {
        const split = splitParentheticalBg(mainText, startMs, endMs);
        mainText = split.mainText;
        bgVocal = split.bgVocal;
        if (split.isBgOnly) isBgOnly = true;
      }

      const parts = mainText.split(/\s+/).filter(Boolean);
      if (parts.length) {
        lines.push({
          startMs,
          endMs,
          hasLineTime,
          isWordSynced: false,
          isDuet,
          isBgOnly,
          bgVocal,
          words: parts.map((w, idx) => ({
            text: idx < parts.length - 1 ? w + " " : w,
            startMs: hasLineTime ? startMs : null,
            endMs: hasLineTime ? endMs : null,
          })),
        });
      }
    }
  }

  const hasAnyTime = lines.some((l) => l.hasLineTime || l.isWordSynced);
  return hasAnyTime ? lines.sort((a, b) => a.startMs - b.startMs) : lines;
}

export function parseTTMLTime(value) {
  if (!value) return null;
  const str = String(value).trim();

  let m = str.match(/^(\d+(?:\.\d+)?)s?$/);
  if (m) return Math.round(parseFloat(m[1]) * 1000);

  m = str.match(/^(\d+):(\d\d):(\d\d)[.:](\d+)$/);
  if (m) {
    const [, h, mi, s, frac] = m;
    const ms = frac.length === 2 ? Number(frac) * 10 : Number(frac.slice(0, 3).padEnd(3, "0"));
    return (Number(h) * 3600 + Number(mi) * 60 + Number(s)) * 1000 + ms;
  }

  m = str.match(/^(\d+):(\d\d)[.:](\d+)$/);
  if (m) {
    const [, mi, s, frac] = m;
    const ms = frac.length === 2 ? Number(frac) * 10 : Number(frac.slice(0, 3).padEnd(3, "0"));
    return (Number(mi) * 60 + Number(s)) * 1000 + ms;
  }

  m = str.match(/^(\d+):(\d\d)$/);
  if (m) {
    return (Number(m[1]) * 60 + Number(m[2])) * 1000;
  }

  return null;
}

/**
 * Parses standard [mm:ss.xx] LRC and Enhanced <mm:ss.xx> word-synced LRC formats.
 */
export function parseLRC(lrcString) {
  const lines = [];
  const lineRe = /^\s*\[(\d+):(\d+(?:\.\d+)?)\](.*)/;
  const wordTagRe = /<(\d+):(\d+(?:\.\d+)?)>\s*([^<]*)/g;

  for (const raw of (lrcString || "").split("\n")) {
    const m = raw.match(lineRe);
    if (!m) continue;
    const [, min, sec, rawContent] = m;
    const startMs = Math.round((Number(min) * 60 + parseFloat(sec)) * 1000);

    let content = rawContent.replace(/^\s*(\[\d+:\d+(?:\.\d+)?\])+/, "").trim();
    if (!content.length) continue;

    // Detect optional duet singer markers like "v2:" or "[v2]"
    let isDuet = false;
    if (/^(?:\[?v2\]?\s*:?\s+)/i.test(content)) {
      isDuet = true;
      content = content.replace(/^(?:\[?v2\]?\s*:?\s+)/i, "").trim();
    } else if (/^(?:\[?v1\]?\s*:?\s+)/i.test(content)) {
      content = content.replace(/^(?:\[?v1\]?\s*:?\s+)/i, "").trim();
    }

    // Check for Enhanced LRC <mm:ss.xx> real word timestamps
    if (content.includes("<") && /<\d+:\d+(?:\.\d+)?>/.test(content)) {
      const extracted = [];
      let wm;
      wordTagRe.lastIndex = 0;
      while ((wm = wordTagRe.exec(content)) !== null) {
        const wStart = Math.round((Number(wm[1]) * 60 + parseFloat(wm[2])) * 1000);
        const wText = wm[3].trim();
        if (wText.length) {
          const subWords = wText.split(/\s+/).filter(Boolean);
          subWords.forEach((sw) => {
            extracted.push({
              text: sw,
              startMs: wStart,
              exactWordSync: true,
            });
          });
        }
      }
      if (extracted.length > 1) {
        const words = extracted.map((w, idx) => ({
          ...w,
          text: idx < extracted.length - 1 ? w.text + " " : w.text,
          endMs: extracted[idx + 1] ? extracted[idx + 1].startMs : w.startMs + 400,
        }));
        lines.push({
          startMs: words[0].startMs ?? startMs,
          endMs: words[words.length - 1].endMs,
          isWordSynced: true,
          isDuet,
          isBgOnly: false,
          words,
        });
        continue;
      }
    }

    const cleanText = content.replace(/<[^>]+>/g, "").trim();
    if (!cleanText.length) continue;

    lines.push({
      startMs,
      isWordSynced: false,
      isDuet,
      _rawCleanText: cleanText,
      words: [],
    });
  }

  const sorted = lines.sort((a, b) => a.startMs - b.startMs);
  for (let i = 0; i < sorted.length; i++) {
    const line = sorted[i];
    if (!line.endMs) {
      line.endMs = sorted[i + 1] ? sorted[i + 1].startMs : line.startMs + 4000;
    }
    if (!line.isWordSynced && line._rawCleanText) {
      const split = splitParentheticalBg(line._rawCleanText, line.startMs, line.endMs);
      delete line._rawCleanText;
      line.isBgOnly = split.isBgOnly;
      line.bgVocal = split.bgVocal;
      const parts = split.mainText.split(/\s+/).filter(Boolean);
      line.words = parts.map((w, idx) => ({
        text: idx < parts.length - 1 ? w + " " : w,
        startMs: line.startMs,
        endMs: line.endMs,
      }));
    }
  }
  return sorted;
}
