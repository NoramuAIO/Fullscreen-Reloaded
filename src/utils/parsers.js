/**
 * Parsers for synchronized lyrics formats (TTML, Enhanced LRC, and standard LRC).
 * Strictly preserves true word/syllable timestamps without fabricating fake word timings
 * on line-synced tracks.
 */

export function parseTTML(ttmlString) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(ttmlString, "application/xml");
  } catch (e) {
    return [];
  }

  // Check root timing attribute (e.g. lrc:timing="Word" vs "Line")
  const ttEl = doc.documentElement;
  const rootTiming = (
    ttEl?.getAttribute("lrc:timing") ||
    ttEl?.getAttribute("itunes:timing") ||
    ""
  ).toLowerCase();

  const paragraphs = Array.from(doc.getElementsByTagName("p"));
  const lines = [];

  for (const p of paragraphs) {
    // Only take direct or vocal spans (skip translation/romanization metadata spans if any)
    const allSpans = Array.from(p.getElementsByTagName("span")).filter((s) => {
      const role = s.getAttribute("ttm:role") || "";
      return role !== "x-translation" && role !== "x-roman";
    });

    const lineStart = parseTTMLTime(p.getAttribute("begin"));
    const lineEnd = parseTTMLTime(p.getAttribute("end"));

    if (allSpans.length && rootTiming !== "line") {
      const words = [];
      let currentWord = null;

      for (let i = 0; i < allSpans.length; i++) {
        const s = allSpans[i];
        const rawText = s.textContent || "";
        const trimmed = rawText.trim();
        if (!trimmed.length) continue;

        const wStart = parseTTMLTime(s.getAttribute("begin"));
        const wEnd = parseTTMLTime(s.getAttribute("end"));

        // Determine if there is whitespace after this span (word boundary vs syllable inside the same word)
        let hasTrailingSpace = /\s$/.test(rawText);
        if (!hasTrailingSpace && s.nextSibling) {
          if (s.nextSibling.nodeType === 3 && /\s/.test(s.nextSibling.nodeValue || "")) {
            hasTrailingSpace = true;
          }
        }
        if (i === allSpans.length - 1) {
          hasTrailingSpace = true;
        }

        // Merge syllables of the same word into a single whole word so words never split visually
        if (!currentWord) {
          currentWord = {
            text: trimmed,
            startMs: wStart,
            endMs: wEnd,
            exactWordSync: true,
          };
        } else {
          currentWord.text += trimmed;
          if (wEnd != null) currentWord.endMs = wEnd;
        }

        if (hasTrailingSpace) {
          const isLast = i === allSpans.length - 1;
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
        const startMs = lineStart != null ? lineStart : words[0].startMs || 0;
        const endMs = lineEnd != null ? lineEnd : words[words.length - 1].endMs || startMs + 3000;

        // Fill any missing endMs on individual syllables/words
        for (let k = 0; k < words.length; k++) {
          if (words[k].startMs == null) {
            words[k].startMs = k === 0 ? startMs : words[k - 1].endMs || startMs;
          }
          if (words[k].endMs == null || words[k].endMs <= words[k].startMs) {
            words[k].endMs = words[k + 1]?.startMs || endMs;
          }
        }

        lines.push({
          startMs,
          endMs,
          isWordSynced: true,
          words,
        });
        continue;
      }
    }

    const text = (p.textContent || "").trim();
    if (text.length) {
      const startMs = lineStart || 0;
      const endMs = lineEnd || startMs + 3500;
      const parts = text.split(/\s+/).filter(Boolean);
      lines.push({
        startMs,
        endMs,
        isWordSynced: false,
        words: parts.map((w, idx) => ({
          text: idx < parts.length - 1 ? w + " " : w,
          startMs,
          endMs,
        })),
      });
    }
  }

  return lines.sort((a, b) => a.startMs - b.startMs);
}

export function parseTTMLTime(value) {
  if (!value) return null;
  const str = String(value).trim();

  // "12.345s" or bare seconds "27.395"
  let m = str.match(/^(\d+(?:\.\d+)?)s?$/);
  if (m) return Math.round(parseFloat(m[1]) * 1000);

  // "00:00:12.340" or "00:00:12:340"
  m = str.match(/^(\d+):(\d\d):(\d\d)[.:](\d+)$/);
  if (m) {
    const [, h, mi, s, frac] = m;
    const ms = frac.length === 2 ? Number(frac) * 10 : Number(frac.slice(0, 3).padEnd(3, "0"));
    return (Number(h) * 3600 + Number(mi) * 60 + Number(s)) * 1000 + ms;
  }

  // "00:12.340" or "00:12:34"
  m = str.match(/^(\d+):(\d\d)[.:](\d+)$/);
  if (m) {
    const [, mi, s, frac] = m;
    const ms = frac.length === 2 ? Number(frac) * 10 : Number(frac.slice(0, 3).padEnd(3, "0"));
    return (Number(mi) * 60 + Number(s)) * 1000 + ms;
  }

  // "00:12"
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

    const content = rawContent.replace(/^\s*(\[\d+:\d+(?:\.\d+)?\])+/, "").trim();
    if (!content.length) continue;

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
          words,
        });
        continue;
      }
    }

    const cleanText = content.replace(/<[^>]+>/g, "").trim();
    if (!cleanText.length) continue;

    const parts = cleanText.split(/\s+/).filter(Boolean);
    lines.push({
      startMs,
      isWordSynced: false,
      words: parts.map((w, idx) => ({
        text: idx < parts.length - 1 ? w + " " : w,
        startMs,
      })),
    });
  }

  const sorted = lines.sort((a, b) => a.startMs - b.startMs);
  for (let i = 0; i < sorted.length; i++) {
    if (!sorted[i].endMs) {
      sorted[i].endMs = sorted[i + 1] ? sorted[i + 1].startMs : sorted[i].startMs + 4000;
    }
  }
  return sorted;
}
