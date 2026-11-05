/**
 * Real-time Audio Analysis & Mood Atmosphere Engine.
 * - Uses Spicetify.getAudioData() `segments` (loudness_start, loudness_max, loudness_max_time, timbre)
 *   with true logarithmic decibel-to-amplitude conversion (10^(dB/20)) and transient onset detection.
 * - Never fires fake metronome pulses during quiet sections or when audio analysis is unavailable.
 * - Automatically classifies each track into one of 4 atmospheric moods:
 *   "energetic" | "melancholic" | "latenight" | "dreamy"
 */
import { Settings } from "../utils/settings.js";

const MELANCHOLIC_KEYWORDS = [
  "ağla", "agla", "veda", "yalnız", "yalniz", "hüzün", "huzun", "gözyaş", "gozyas",
  "ayrılık", "ayrilik", "gitme", "kırık", "kirik", "keder", "dert", "özlem", "ozlem",
  "bitti", "yara", "acı", "aci", "ölüm", "olum", "sensiz", "unut", "kaybet", "vazgeç",
  "sad", "cry", "tears", "lonely", "broken", "hurt", "pain", "rain", "yağmur", "yagmur",
  "sorry", "goodbye", "empty", "cold", "grief", "heartbreak",
];

const ENERGETIC_KEYWORDS = [
  "remix", "phonk", "drill", "club", "dance", "party", "hype", "trap", "bass",
  "workout", "gym", "hardstyle", "techno", "rave", "jump", "fire", "ateş", "ates",
  "patla", "uç", "hız", "enerji", "vip", "banger", "boost",
];

const LATENIGHT_KEYWORDS = [
  "gece", "karanlık", "karanlik", "sokak", "duman", "alkol", "şarap", "sarap",
  "night", "midnight", "3am", "4am", "lofi", "lo-fi", "slowed", "reverb",
  "dark", "shadow", "moon", "city", "drive", "smoke", "chill", "uyku", "sessiz",
];

export const AudioMoodEngine = {
  _currentUri: null,
  _audioCache: new Map(),

  // Extracted track properties
  bpm: 110,
  baseEnergy: 0.5,
  hasExactAudio: false,
  segments: [],
  beats: [],

  // Color & lyric signals
  _colorWarmth: 0.5,
  _colorLum: 0.4,
  _colorSat: 0.5,
  _wordsPerSec: 1.5,
  _trackText: "",

  // Computed mood & smoothed 60fps outputs
  _autoMood: "dreamy",
  _smoothBeat: 0,
  _smoothBar: 0,
  _smoothEnergy: 0.35,
  _segCursor: 0,
  _beatCursor: 0,

  /**
   * Initializes analysis for a newly loaded track.
   */
  async loadTrack(track, colors = null) {
    if (!track || !track.uri) return;
    const uri = track.uri;
    this._currentUri = uri;

    this._segCursor = 0;
    this._beatCursor = 0;
    this.segments = [];
    this.beats = [];
    this.hasExactAudio = false;
    this.bpm = 110;
    this.baseEnergy = 0.5;
    this._wordsPerSec = 1.5;
    this._smoothBeat = 0;
    this._smoothBar = 0;

    const meta = track.metadata || {};
    const title = meta.title || track.name || "";
    const artist = meta.artist_name || "";
    const album = meta.album_title || track.album?.name || "";
    this._trackText = `${title} ${artist} ${album}`.toLowerCase();

    if (colors) {
      this._analyzeColors(colors);
    }

    this._recomputeAutoMood();

    const audio = await this._fetchAudioData(uri);
    if (this._currentUri !== uri) return;

    if (audio) {
      this._parseAudioData(audio);
      this._recomputeAutoMood();
    }
  },

  updateColors(colors) {
    if (!colors) return;
    this._analyzeColors(colors);
    this._recomputeAutoMood();
  },

  updateLyricsMetrics(lines, syncType, durationMs) {
    if (!Array.isArray(lines) || !lines.length) return;

    let totalWords = 0;
    for (let i = 0; i < lines.length; i++) {
      const wLen = Array.isArray(lines[i].words)
        ? lines[i].words.length
        : String(lines[i].text || "").trim().split(/\s+/).filter(Boolean).length;
      totalWords += wLen;
    }

    const durSec = Math.max(45, (durationMs || 180000) / 1000);
    this._wordsPerSec = totalWords / durSec;
    this._recomputeAutoMood();
  },

  getEffectiveMood() {
    const setting = Settings.get("moodMode") || "auto";
    if (setting === "off") return "off";
    if (setting !== "auto") return setting;
    return this._autoMood || "dreamy";
  },

  /**
   * Called every animation frame (60fps) from App.startTicking().
   * Computes real instantaneous amplitude and bass kick transients from Spotify `segments`.
   * Quiet sections produce 0.0 bass pulse; only genuine high-energy bass/drum transients trigger a pulse.
   */
  sample(progressMs, isPlaying) {
    const mood = this.getEffectiveMood();
    const beatMode = Settings.get("beatReactive") || "normal";

    if (!isPlaying || beatMode === "off" || !this.hasExactAudio || !this.segments.length) {
      this._smoothBeat *= 0.84;
      this._smoothBar *= 0.84;
      this._smoothEnergy += (0.3 - this._smoothEnergy) * 0.05;
      return {
        mood,
        beatPulse: this._smoothBeat < 0.005 ? 0 : this._smoothBeat,
        barPulse: this._smoothBar < 0.005 ? 0 : this._smoothBar,
        sectionEnergy: this._smoothEnergy,
        bpm: this.bpm,
      };
    }

    const intensityMult = beatMode === "intense" ? 1.35 : 1.0;
    const seg = this._findInterval(this.segments, progressMs, "_segCursor");

    let rawKick = 0;
    let targetEnergy = 0.25;

    if (seg) {
      // 1. Interpolate instantaneous decibel envelope inside the current segment:
      //    loudness_start -> loudness_max (at peakOffsetMs) -> loudness_end
      const elapsedMs = Math.max(0, progressMs - seg.startMs);
      let currentDb;
      if (elapsedMs <= seg.peakOffsetMs) {
        const t = seg.peakOffsetMs > 5 ? elapsedMs / seg.peakOffsetMs : 1;
        currentDb = seg.dbStart + (seg.dbMax - seg.dbStart) * t;
      } else {
        const remDur = Math.max(20, seg.durMs - seg.peakOffsetMs);
        const t = Math.min(1, (elapsedMs - seg.peakOffsetMs) / remDur);
        currentDb = seg.dbMax + (seg.dbEnd - seg.dbMax) * t;
      }

      // Convert relative decibels (dB below track's loudest peak) to physical linear amplitude: 10^(relDb / 20)
      // e.g. 0dB below peak -> 1.0, -6dB -> 0.50, -12dB -> 0.25, -20dB -> 0.10, -30dB -> 0.03
      const relDb = currentDb - this._trackPeakDb;
      const linearAmp = Math.pow(10, Math.max(-40, Math.min(0, relDb)) / 20);
      targetEnergy = Math.max(0.15, Math.min(1, linearAmp));

      // 2. Real Bass / Kick Transient Detection:
      //    Only trigger when the segment is loud (top 6.5dB of the song, i.e. peakAmp >= 0.47)
      //    AND has a sharp percussive attack (deltaDb >= 3.8dB) + low-end bass weight.
      if (seg.kickStrength > 0) {
        const distFromPeakMs = elapsedMs - seg.peakOffsetMs;
        if (distFromPeakMs >= -25 && distFromPeakMs <= 190) {
          const env =
            distFromPeakMs < 0
              ? 1 + distFromPeakMs / 25
              : Math.pow(1 - distFromPeakMs / 190, 2.2);
          rawKick = env * seg.kickStrength * intensityMult;
        }
      }
    }

    // Fast attack on genuine kick transient, smooth natural release
    const attackRate = rawKick > this._smoothBeat ? 0.48 : 0.15;
    this._smoothBeat += (rawKick - this._smoothBeat) * attackRate;
    this._smoothBar = this._smoothBeat * 0.65;
    this._smoothEnergy += (targetEnergy - this._smoothEnergy) * 0.06;

    return {
      mood,
      beatPulse: Math.min(1.2, this._smoothBeat < 0.008 ? 0 : this._smoothBeat),
      barPulse: Math.min(1.0, this._smoothBar < 0.008 ? 0 : this._smoothBar),
      sectionEnergy: Math.max(0.15, Math.min(1, this._smoothEnergy)),
      bpm: this.bpm,
    };
  },

  _findInterval(arr, progressMs, cursorKey) {
    if (!arr.length) return null;
    let idx = Math.min(this[cursorKey] || 0, arr.length - 1);
    while (idx + 1 < arr.length && arr[idx + 1].startMs <= progressMs) idx++;
    while (idx > 0 && arr[idx].startMs > progressMs) idx--;
    this[cursorKey] = idx;
    const item = arr[idx];
    if (progressMs >= item.startMs && progressMs <= item.startMs + item.durMs + 80) {
      return item;
    }
    return null;
  },

  _analyzeColors(colors) {
    const dom = colors.dominant || [60, 60, 80];
    const acc = colors.accent || dom;

    const r = (dom[0] + acc[0]) * 0.5;
    const g = (dom[1] + acc[1]) * 0.5;
    const b = (dom[2] + acc[2]) * 0.5;

    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    this._colorLum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    this._colorSat = max === 0 ? 0 : (max - min) / max;
    this._colorWarmth = Math.max(0, Math.min(1, 0.5 + (r - b) / 320));
  },

  _recomputeAutoMood() {
    const txt = this._trackText || "";

    const hasMelancholicWord = MELANCHOLIC_KEYWORDS.some((kw) => txt.includes(kw));
    const hasEnergeticWord = ENERGETIC_KEYWORDS.some((kw) => txt.includes(kw));
    const hasLateNightWord = LATENIGHT_KEYWORDS.some((kw) => txt.includes(kw));

    let scoreEnergetic = 0;
    let scoreMelancholic = 0;
    let scoreLateNight = 0;
    let scoreDreamy = 0.35;

    if (hasEnergeticWord) scoreEnergetic += 0.65;
    if (hasMelancholicWord) scoreMelancholic += 0.65;
    if (hasLateNightWord) scoreLateNight += 0.65;

    if (this.bpm >= 124 || this._wordsPerSec >= 2.35) {
      scoreEnergetic += 0.55;
    } else if (this.bpm <= 95) {
      scoreMelancholic += 0.42;
      scoreLateNight += 0.3;
    } else {
      scoreDreamy += 0.25;
      scoreLateNight += 0.2;
    }

    if (this.baseEnergy >= 0.68) {
      scoreEnergetic += 0.45;
    } else if (this.baseEnergy <= 0.42) {
      scoreMelancholic += 0.35;
      scoreLateNight += 0.25;
    }

    if (this._colorLum < 0.32) {
      scoreLateNight += 0.38;
      scoreMelancholic += 0.22;
    }
    if (this._colorWarmth < 0.44) {
      scoreMelancholic += 0.32;
    } else if (this._colorWarmth > 0.58) {
      scoreDreamy += 0.35;
      if (this._colorSat > 0.6) scoreEnergetic += 0.2;
    }

    const candidates = [
      { id: "energetic", score: scoreEnergetic },
      { id: "melancholic", score: scoreMelancholic },
      { id: "latenight", score: scoreLateNight },
      { id: "dreamy", score: scoreDreamy },
    ];
    candidates.sort((a, b) => b.score - a.score);
    this._autoMood = candidates[0].id;
  },

  async _fetchAudioData(uri) {
    if (this._audioCache.has(uri)) {
      return this._audioCache.get(uri);
    }
    if (typeof Spicetify === "undefined" || typeof Spicetify.getAudioData !== "function") {
      return null;
    }

    try {
      const result = await Promise.race([
        Spicetify.getAudioData(uri),
        new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);
      if (result && Array.isArray(result.segments) && result.segments.length > 0) {
        if (this._audioCache.size > 30) {
          const oldest = this._audioCache.keys().next().value;
          this._audioCache.delete(oldest);
        }
        this._audioCache.set(uri, result);
        return result;
      }
    } catch (_) {
      // Ignore audio-analysis errors gracefully
    }
    return null;
  },

  _parseAudioData(data) {
    if (!data || !Array.isArray(data.segments) || !data.segments.length) return;

    if (data.track && typeof data.track.tempo === "number" && data.track.tempo > 30) {
      this.bpm = Math.round(data.track.tempo);
    }

    const rawSegs = data.segments;
    // Find the track's 95th-percentile peak loudness (in dB) so quiet sections are accurately gated out
    const maxValues = rawSegs
      .map((s) => (typeof s.loudness_max === "number" ? s.loudness_max : -20))
      .sort((a, b) => a - b);
    const p95Idx = Math.min(maxValues.length - 1, Math.floor(maxValues.length * 0.95));
    const trackPeakDb = maxValues[p95Idx] ?? -4;
    this._trackPeakDb = trackPeakDb;

    let sumLinearAmp = 0;

    this.segments = rawSegs.map((s, idx) => {
      const startMs = Math.round((s.start || 0) * 1000);
      const durMs = Math.max(40, Math.round((s.duration || 0.25) * 1000));
      const peakOffsetMs = Math.max(
        5,
        Math.min(durMs - 5, Math.round((s.loudness_max_time || 0.03) * 1000))
      );

      const dbStart = typeof s.loudness_start === "number" ? s.loudness_start : -24;
      const dbMax = typeof s.loudness_max === "number" ? s.loudness_max : dbStart;
      const nextSeg = rawSegs[idx + 1];
      const dbEnd =
        nextSeg && typeof nextSeg.loudness_start === "number"
          ? nextSeg.loudness_start
          : typeof s.loudness_end === "number"
          ? s.loudness_end
          : dbStart;

      // Physical linear peak amplitude relative to the track's loudest peak: 10^((dbMax - trackPeakDb) / 20)
      const relPeakDb = dbMax - trackPeakDb;
      const peakAmp = Math.pow(10, Math.max(-40, Math.min(2, relPeakDb)) / 20);
      sumLinearAmp += Math.min(1, peakAmp);

      // Transient jump in dB from segment start to segment peak
      const deltaDb = Math.max(0, dbMax - dbStart);

      // Timbre low-frequency bass check: timbre[1] is spectral brightness (lower = deeper bass)
      let bassFactor = 1.0;
      if (Array.isArray(s.timbre) && s.timbre.length >= 2) {
        const brightness = s.timbre[1]; // typically -100 (sub-bass) to +100 (hi-hat/treble)
        if (brightness > 45) {
          bassFactor = 0.25; // high-hat / sibilance, not a bass kick
        } else if (brightness < -10) {
          bassFactor = 1.25; // deep low-end punch
        }
      }

      // Gate out quiet parts! A bass kick ONLY fires if:
      // 1) Segment peak is within 6.5dB of the track's loudest moments (peakAmp >= 0.47)
      // 2) Segment has a sharp percussive attack (deltaDb >= 3.5dB in <= 110ms)
      let kickStrength = 0;
      if (peakAmp >= 0.47 && deltaDb >= 3.5 && peakOffsetMs <= 110) {
        const normAttack = Math.min(1, (deltaDb - 3.0) / 9.0);
        const normLoud = Math.min(1, (peakAmp - 0.45) / 0.55);
        kickStrength = Math.min(1, normAttack * normLoud * bassFactor);
      }

      return {
        startMs,
        durMs,
        peakOffsetMs,
        dbStart,
        dbMax,
        dbEnd,
        kickStrength,
      };
    });

    this.baseEnergy = Math.max(0.2, Math.min(0.95, sumLinearAmp / rawSegs.length));
    this.hasExactAudio = true;
  },
};
