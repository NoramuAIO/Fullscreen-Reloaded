/**
 * Spotify native lyrics provider.
 * Updated for Spotify 1.3.6: supports both SpotiKit.Http.get and native fetch with session token.
 */
import { BaseLyricsProvider } from "./BaseLyricsProvider.js";
import { SpotiKitBridge } from "../SpotiKitBridge.js";
import { splitParentheticalBg } from "../../utils/parsers.js";

export class SpotifyLyricsProvider extends BaseLyricsProvider {
  async fetch(track) {
    if (!track || !track.uri) return null;
    const parts = track.uri.split(":");
    const id = parts[2] || parts[parts.length - 1];
    if (!id) return null;

    const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`;
    let res = null;

    // Strategy 1: SpotiKit.Http.get
    if (!SpotiKitBridge.isStopped()) {
      let timer = null;
      try {
        const httpPromise = SpotiKitBridge.httpGet(url);
        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), 1500);
        });
        res = await Promise.race([httpPromise, timeoutPromise]);
        if (typeof res === "string") {
          try { res = JSON.parse(res); } catch (_) {}
        } else if (res && !res.lyrics && res.body) {
          res = typeof res.body === "string" ? JSON.parse(res.body) : res.body;
        }
      } catch (e) {
        // SpotiKit.Http.get failed or timed out, continue to Strategy 2
      } finally {
        if (timer !== null) clearTimeout(timer);
      }
    }

    // Strategy 2: Direct HTTP fetch with session access token (Spotify 1.3.6 compatible)
    if ((!res || !res.lyrics) && !SpotiKitBridge.isStopped()) {
      try {
        const token = await SpotiKitBridge.getAccessToken();
        if (token && !SpotiKitBridge.isStopped()) {
          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              "app-platform": "WebPlayer",
            },
            signal: SpotiKitBridge.createTimeoutSignal(1800),
          });
          if (response.ok) {
            res = await response.json();
          }
        }
      } catch (e) {
        // fetch failed or aborted
      }
    }

    if (!res || !res.lyrics || !Array.isArray(res.lyrics.lines)) {
      return null;
    }

    const syncType = res.lyrics.syncType; // "LINE_SYNCED" | "UNSYNCED" | "SYLLABLE_SYNCED"
    const isSynced = syncType === "LINE_SYNCED" || syncType === "SYLLABLE_SYNCED";
    let hasSyllables = false;

    const rawLines = res.lyrics.lines
      .map((l) => {
        const startMs = Number(l.startTimeMs) || 0;
        const rawText = typeof l.words === "string" ? l.words : "";

        // Check if Spotify provided syllable/word timings
        if (Array.isArray(l.syllables) && l.syllables.length > 0) {
          const syllableWords = [];
          let charCursor = 0;

          for (let i = 0; i < l.syllables.length; i++) {
            const syl = l.syllables[i];
            const sStart = Number(syl.startTimeMs ?? startMs);
            const sEnd = syl.endTimeMs != null ? Number(syl.endTimeMs) : null;
            let sylText = "";

            if (typeof syl.text === "string" && syl.text.length) {
              sylText = syl.text;
            } else if (syl.numChars != null && rawText.length) {
              const count = Number(syl.numChars) || 0;
              sylText = rawText.slice(charCursor, charCursor + count);
              charCursor += count;
              // Include trailing whitespace if present
              while (charCursor < rawText.length && /\s/.test(rawText[charCursor])) {
                sylText += rawText[charCursor];
                charCursor++;
              }
            }

            if (sylText.trim().length) {
              syllableWords.push({
                text: sylText.endsWith(" ") ? sylText : sylText + " ",
                startMs: sStart,
                endMs: sEnd,
                exactWordSync: true,
              });
            }
          }

          if (syllableWords.length > 0) {
            hasSyllables = true;
            return {
              startMs,
              isWordSynced: true,
              words: syllableWords,
            };
          }
        }

        const text = rawText.trim();
        return {
          startMs,
          _rawCleanText: text,
          words: this.splitWords(text, isSynced ? startMs : null),
        };
      })
      .filter((l) => l.words && l.words.length > 0);

    if (!rawLines.length) return null;

    if (isSynced) {
      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        const nextStart = rawLines[i + 1] ? rawLines[i + 1].startMs : line.startMs + 3600;
        if (!line.isWordSynced && line._rawCleanText) {
          const split = splitParentheticalBg(line._rawCleanText, line.startMs, nextStart);
          delete line._rawCleanText;
          line.isBgOnly = split.isBgOnly;
          line.bgVocal = split.bgVocal;
          line.words = this.splitWords(split.mainText, line.startMs);
        }
      }
    }

    return {
      type: hasSyllables ? "word-synced" : isSynced ? "synced" : "unsynced",
      source: "Spotify",
      lines: rawLines,
    };
  }
}
