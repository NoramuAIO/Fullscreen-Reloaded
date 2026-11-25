// tests/letter-timing.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { installDomStub } from "./helpers/domStub.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

async function loadLetterModules() {
  const [timing, parsers, customSync] = await Promise.all([
    import(pathToFileURL(path.join(ROOT, "src/utils/letterTiming.js")).href),
    import(pathToFileURL(path.join(ROOT, "src/utils/parsers.js")).href),
    import(pathToFileURL(path.join(ROOT, "src/services/CustomSyncStorage.js")).href),
  ]);
  return { ...timing, ...parsers, ...customSync };
}

test("segmentGraphemes preserves Turkish diacritics, combining marks, and emoji clusters", async () => {
  const { segmentGraphemes } = await loadLetterModules();

  assert.deepEqual(segmentGraphemes("Şarkı!"), ["Ş", "a", "r", "k", "ı", "!"]);
  assert.deepEqual(segmentGraphemes("café".normalize("NFD")), ["c", "a", "f", "e\u0301"]);
  assert.deepEqual(segmentGraphemes("A✨ "), ["A", "✨", " "]);
  assert.deepEqual(segmentGraphemes(""), []);
});

test("canAnimateLetters disables splitting for RTL/complex scripts and blank strings", async () => {
  const { canAnimateLetters } = await loadLetterModules();

  assert.equal(canAnimateLetters("Şimdi"), true);
  assert.equal(canAnimateLetters("I"), true);
  assert.equal(canAnimateLetters("   "), false);
  assert.equal(canAnimateLetters(""), false);
  assert.equal(canAnimateLetters("مرحبا"), false);
  assert.equal(canAnimateLetters("שלום"), false);
});

test("buildCharTimeline respects exact sub-word syllables and weights punctuation lighter", async () => {
  const { buildCharTimeline } = await loadLetterModules();

  const timeline = buildCharTimeline({
    text: "beautiful! ",
    startMs: 1000,
    endMs: 2200,
    syllables: [
      { text: "beau", startMs: 1000, endMs: 1200 },
      { text: "ti", startMs: 1200, endMs: 1400 },
      { text: "ful!", startMs: 1400, endMs: 2200 },
    ],
  });

  // 10 visible graphemes ("beautiful!") + 1 space node (" ")
  assert.equal(timeline.entries.length, 11);
  assert.equal(timeline.visible.length, 10);
  assert.equal(timeline.entries[10].isSpace, true);

  // First syllable ends cleanly around 1200ms ("u" at index 3), held syllable "ful!" spans 1400..2200
  const uSlot = timeline.visible[3];
  const fSlot = timeline.visible[6];
  const lSlot = timeline.visible[8];
  const bangSlot = timeline.visible[9];

  assert.ok(uSlot.rawEnd <= 1205);
  assert.ok(fSlot.rawStart >= 1395);
  // Punctuation "!" gets lower weight (0.25) than letters ("l" weight 1.0)
  assert.ok(bangSlot.rawEnd - bangSlot.rawStart < lSlot.rawEnd - lSlot.rawStart);
  assert.equal(timeline.visible[0].fillStartMs, 1000);
  assert.equal(bangSlot.fillEndMs, 2200);
});

test("buildCharTimeline handles single-character words cleanly", async () => {
  const { buildCharTimeline } = await loadLetterModules();
  const single = buildCharTimeline({
    text: "O ",
    startMs: 500,
    endMs: 900,
  });
  assert.equal(single.visible.length, 1);
  assert.equal(single.visible[0].fillStartMs, 500);
  assert.equal(single.visible[0].fillEndMs, 900);
  assert.equal(single.visible[0].normCenter, 0.5);
});

test("computeWordWaveParams tracks syllable focal position and tapers smoothly at edges", async () => {
  const { buildCharTimeline, computeWordWaveParams } = await loadLetterModules();

  const timeline = buildCharTimeline({
    text: "shine",
    startMs: 1000,
    endMs: 2000,
  });

  const atStart = computeWordWaveParams(timeline.visible, 1000, 1000, 2000, { wfMode: "normal" });
  const atMid = computeWordWaveParams(timeline.visible, 1500, 1000, 2000, { wfMode: "normal" });
  const atEnd = computeWordWaveParams(timeline.visible, 2000, 1000, 2000, { wfMode: "normal" });

  assert.equal(atStart.maxLiftPx, 0);
  assert.equal(atEnd.maxLiftPx, 0);
  assert.ok(atMid.maxLiftPx < -2);
  assert.ok(atMid.focalNorm > 0.35 && atMid.focalNorm < 0.65);

  const fastWord = computeWordWaveParams(
    buildCharTimeline({ text: "go", startMs: 0, endMs: 110 }).visible,
    55,
    0,
    110,
    { wfMode: "normal" }
  );
  const offMode = computeWordWaveParams(timeline.visible, 1500, 1000, 2000, { wfMode: "off" });
  assert.ok(Math.abs(fastWord.maxLiftPx) < Math.abs(atMid.maxLiftPx));
  assert.ok(Math.abs(offMode.maxLiftPx) < Math.abs(atMid.maxLiftPx));
});

test("spicyLyricsToFullscreenLines and parseTTML preserve multi-syllable sub-word timings", async () => {
  const dom = installDomStub();
  const prevDOMParserDesc = Object.getOwnPropertyDescriptor(globalThis, "DOMParser");

  try {
    const { spicyLyricsToFullscreenLines, parseTTML } = await loadLetterModules();

    // 1. Spicy Syllable payload with IsPartOfWord: true
    const spicyParsed = spicyLyricsToFullscreenLines({
      Type: "Syllable",
      Content: [
        {
          Type: "Vocal",
          Lead: {
            StartTime: 1000,
            EndTime: 2200,
            Syllables: [
              { Text: "For", IsPartOfWord: true, StartTime: 1000, EndTime: 1250 },
              { Text: "ev", IsPartOfWord: true, StartTime: 1250, EndTime: 1550 },
              { Text: "er", IsPartOfWord: false, StartTime: 1550, EndTime: 2050 },
              { Text: "now", IsPartOfWord: false, StartTime: 2050, EndTime: 2200 },
            ],
          },
        },
      ],
    });

    assert.equal(spicyParsed.type, "word-synced");
    assert.equal(spicyParsed.lines.length, 1);
    const words = spicyParsed.lines[0].words;
    assert.equal(words.length, 2);
    assert.equal(words[0].text, "Forever ");
    assert.equal(words[0].startMs, 1000);
    assert.equal(words[0].endMs, 2050);
    assert.equal(words[0].syllables.length, 3);
    assert.deepEqual(
      words[0].syllables.map((s) => s.text),
      ["For", "ev", "er"]
    );
    assert.equal(words[1].text, "now");
    assert.equal(words[1].syllables, undefined);

    // 2. TTML multi-span word preservation via lightweight DOMParser mock
    const withTagSearch = (node) => {
      node.getElementsByTagName = (tag) => node.querySelectorAll(tag);
      return node;
    };
    globalThis.DOMParser = class MockTTMLParser {
      parseFromString() {
        const docEl = withTagSearch(dom.document.createElement("tt"));
        docEl.setAttribute("itunes:timing", "word");
        const p = withTagSearch(dom.document.createElement("p"));
        p.setAttribute("begin", "1.000s");
        p.setAttribute("end", "2.500s");

        const s1 = withTagSearch(dom.document.createElement("span"));
        s1.setAttribute("begin", "1.000s");
        s1.setAttribute("end", "1.300s");
        s1.textContent = "glo";

        const s2 = withTagSearch(dom.document.createElement("span"));
        s2.setAttribute("begin", "1.300s");
        s2.setAttribute("end", "2.100s");
        s2.textContent = "wing";

        const spaceNode = dom.document.createTextNode(" ");

        const s3 = withTagSearch(dom.document.createElement("span"));
        s3.setAttribute("begin", "2.100s");
        s3.setAttribute("end", "2.500s");
        s3.textContent = "sky";

        p.append(s1, s2, spaceNode, s3);
        docEl.appendChild(p);
        return {
          documentElement: docEl,
          getElementsByTagName: (tag) => docEl.querySelectorAll(tag),
        };
      }
    };

    const ttmlLines = parseTTML("<tt></tt>");
    assert.equal(ttmlLines.length, 1);
    assert.equal(ttmlLines[0].words.length, 2);
    assert.equal(ttmlLines[0].words[0].text, "glowing ");
    assert.equal(ttmlLines[0].words[0].syllables.length, 2);
    assert.deepEqual(ttmlLines[0].words[0].syllables, [
      { text: "glo", startMs: 1000, endMs: 1300 },
      { text: "wing", startMs: 1300, endMs: 2100 },
    ]);
    assert.equal(ttmlLines[0].words[1].syllables, undefined);
  } finally {
    if (prevDOMParserDesc === undefined) delete globalThis.DOMParser;
    else Object.defineProperty(globalThis, "DOMParser", prevDOMParserDesc);
    dom.reset();
  }
});

test("normalizeWordTimings repairs identical/overlapping word timestamps and preserves valid studio timings", async () => {
  const { normalizeWordTimings, computeWrappedRowRatios, compileDraftToSpicyLyrics } = await loadLetterModules();

  // Case 1: Forgotten word timestamps (all 3 words start at 1000ms) -> sequential non-overlapping windows
  const repaired = normalizeWordTimings(
    [
      { text: "Valla ", startMs: 1000, endMs: 3000 },
      { text: "gençler ", startMs: 1000, endMs: 3000 },
      { text: "obama", startMs: 1000, endMs: 3000 },
    ],
    1000,
    2000
  );
  assert.equal(repaired[0].startMs, 1000);
  assert.ok(repaired[0].endMs <= repaired[1].startMs + 1);
  assert.ok(repaired[1].endMs <= repaired[2].startMs + 1);
  assert.ok(repaired[1].startMs > repaired[0].startMs);
  assert.ok(repaired[2].startMs > repaired[1].startMs);

  // Case 2: Overlapping endMs clamped to next word startMs
  const clamped = normalizeWordTimings(
    [
      { text: "One ", startMs: 1000, endMs: 2800 },
      { text: "Two", startMs: 1500, endMs: 2400 },
    ],
    1000,
    1800
  );
  assert.equal(clamped[0].endMs, 1500);
  assert.equal(clamped[1].startMs, 1500);
  assert.equal(clamped[1].endMs, 2400);

  // Case 3: Wrapped line-synced row ratios are sequential [0..split] then [split..1]
  const rows = computeWrappedRowRatios(["Karanlık yollardan geçtim,", "içinden çok çile seçtim"]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].startRatio, 0);
  assert.equal(rows[0].endRatio, rows[1].startRatio);
  assert.equal(rows[1].endRatio, 1);
  assert.ok(rows[0].endRatio > 0.4 && rows[0].endRatio < 0.65);

  // Case 4: CustomSyncStorage draft compilation with unstamped middle tokens never stretches EndTime to lineEnd
  const compiled = compileDraftToSpicyLyrics({
    trackId: "test123",
    syncMode: "word",
    lines: [
      {
        kind: "lyric",
        text: "Valla gençler obama",
        start: 1000,
        end: 3000,
        tokens: [
          { text: "Valla", start: 1000, end: null },
          { text: "gençler", start: null, end: null },
          { text: "obama", start: null, end: null },
        ],
      },
    ],
  });
  const syls = compiled.Content[0].Lead.Syllables;
  assert.equal(syls.length, 3);
  assert.ok(syls[0].EndTime <= syls[1].StartTime);
  assert.ok(syls[1].EndTime <= syls[2].StartTime);
  assert.ok(syls[0].EndTime < 2500);
});
