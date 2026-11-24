/**
 * Settings Panel Modal component with Custom Liquid Glass Dropdowns.
 */
import { el, toggle } from "../utils/dom.js";
import { t } from "../utils/i18n.js";
import { Settings } from "../utils/settings.js";
import { createCustomSelect } from "./CustomSelect.js";
import { createCustomColorPicker } from "./CustomColorPicker.js";

export const SettingsModal = {
  root: null,

  build() {
    const panel = el("div", "fr-settings-panel");

    // ================= Section 1: Background =================
    const sec1 = el("div", "fr-settings-section");
    sec1.appendChild(el("div", "fr-settings-title", t("background")));

    // Background mode dropdown
    const bgRow = el("div", "fr-settings-row");
    const bgSelect = createCustomSelect({
      options: [
        { value: "solid", label: t("solidColor") },
        { value: "gradient", label: t("gradient") },
        { value: "dynamic-gradient", label: t("dynamicGradient") },
        { value: "blurred-artwork", label: t("blurredArtwork") },
        { value: "artwork", label: t("artwork") },
        { value: "darkened-artwork", label: t("darkenedArtwork") },
        { value: "custom-color", label: t("customColor") },
      ],
      value: Settings.get("backgroundMode"),
      onChange: (val) => Settings.set("backgroundMode", val),
    });
    bgRow.append(el("label", null, t("mode")), bgSelect);
    sec1.appendChild(bgRow);

    // Custom color picker (Liquid Glass)
    const colorRow = el("div", "fr-settings-row");
    const colorPicker = createCustomColorPicker({
      value: Settings.get("customColor") || "#101014",
      onChange: (hex) => Settings.set("customColor", hex),
    });
    colorRow.append(el("label", null, t("customColor")), colorPicker);
    sec1.appendChild(colorRow);

    // Mood Atmosphere Dropdown (Auto / Energetic / Melancholic / Late Night / Dreamy / Off)
    const moodRow = el("div", "fr-settings-row");
    const moodSelect = createCustomSelect({
      options: [
        {
          value: "auto",
          label: t("moodAuto"),
          shortLabel: t("providerAutoShort"),
          sublabel: t("moodAutoSub"),
          badge: t("badgeSmart"),
        },
        { value: "energetic", label: t("moodEnergetic"), shortLabel: t("moodEnergetic") },
        { value: "melancholic", label: t("moodMelancholic"), shortLabel: t("moodMelancholic") },
        { value: "latenight", label: t("moodLateNight"), shortLabel: t("moodLateNight") },
        { value: "dreamy", label: t("moodDreamy"), shortLabel: t("moodDreamy") },
        { value: "off", label: t("moodOff"), shortLabel: t("moodOff") },
      ],
      value: Settings.get("moodMode") || "auto",
      onChange: (val) => Settings.set("moodMode", val),
    });
    moodRow.append(el("label", null, t("moodAtmosphere")), moodSelect);
    sec1.appendChild(moodRow);

    // Beat & Bass Pulse Dropdown (Normal / Intense / Off)
    const beatRow = el("div", "fr-settings-row");
    const beatSelect = createCustomSelect({
      options: [
        { value: "normal", label: t("beatNormal"), shortLabel: t("beatNormal") },
        { value: "intense", label: t("beatIntense"), shortLabel: t("beatIntense") },
        { value: "off", label: t("beatOff"), shortLabel: t("beatOff") },
      ],
      value: Settings.get("beatReactive") || "normal",
      onChange: (val) => Settings.set("beatReactive", val),
    });
    beatRow.append(el("label", null, t("beatReactive")), beatSelect);
    sec1.appendChild(beatRow);

    panel.appendChild(sec1);
    panel.appendChild(el("div", "fr-settings-divider"));

    // ================= Section 2: Appearance =================
    const sec2 = el("div", "fr-settings-section");
    sec2.appendChild(el("div", "fr-settings-title", t("appearance")));

    // Show Lyrics Toggle
    const lyricsRow = el("div", "fr-settings-row");
    const lyricsToggle = toggle(Settings.get("showLyrics"), (v) => Settings.set("showLyrics", v));
    lyricsRow.append(el("label", null, t("showLyrics")), lyricsToggle);
    sec2.appendChild(lyricsRow);

    // Idle Mode Lyrics Toggle
    const idleLyricsRow = el("div", "fr-settings-row");
    const idleLyricsToggle = toggle(Settings.get("idleLyrics"), (v) => Settings.set("idleLyrics", v));
    idleLyricsRow.append(el("label", null, t("idleLyrics")), idleLyricsToggle);
    sec2.appendChild(idleLyricsRow);

    // Waterfall Flow Mode Dropdown (Şelale Akışı)
    const waterfallRow = el("div", "fr-settings-row");
    const waterfallSelect = createCustomSelect({
      options: [
        { value: "normal", label: t("waterfallNormal"), shortLabel: t("waterfallNormal") },
        { value: "intense", label: t("waterfallIntense"), shortLabel: t("waterfallIntense") },
        { value: "off", label: t("waterfallOff"), shortLabel: t("waterfallOff") },
      ],
      value: Settings.get("waterfallMode") || "normal",
      onChange: (val) => Settings.set("waterfallMode", val),
    });
    waterfallRow.append(el("label", null, t("waterfallFlow")), waterfallSelect);
    sec2.appendChild(waterfallRow);

    // Letter-by-Letter Flow Toggle (Word-synced Karaoke)
    const letterByLetterRow = el("div", "fr-settings-row");
    const letterByLetterToggle = toggle(
      Settings.get("letterByLetter") !== false,
      (v) => Settings.set("letterByLetter", v)
    );
    letterByLetterRow.append(el("label", null, t("letterByLetter")), letterByLetterToggle);
    sec2.appendChild(letterByLetterRow);

    // Interlude Dots Toggle (Apple Music • • •)
    const interludeRow = el("div", "fr-settings-row");
    const interludeToggle = toggle(Settings.get("interludeDots") !== false, (v) => Settings.set("interludeDots", v));
    interludeRow.append(el("label", null, t("interludeDots")), interludeToggle);
    sec2.appendChild(interludeRow);

    // Background Vocals & Duet View Toggle (Apple Music Sing / Duet)
    const bgDuetRow = el("div", "fr-settings-row");
    const bgDuetToggle = toggle(Settings.get("bgVocalsDuet") !== false, (v) => Settings.set("bgVocalsDuet", v));
    bgDuetRow.append(el("label", null, t("bgVocalsDuet")), bgDuetToggle);
    sec2.appendChild(bgDuetRow);

    // Lyrics Provider Dropdown (Apple Music / LRCLIB / Genius / Spotify)
    const providerRow = el("div", "fr-settings-row");
    const providerSelect = createCustomSelect({
      options: [
        {
          value: "auto",
          label: t("providerAuto"),
          shortLabel: t("providerAutoShort"),
          sublabel: t("providerAutoSub"),
          badge: t("badgeSmart"),
        },
        {
          value: "applemusic",
          label: t("providerApple"),
          shortLabel: "Apple Music",
          badge: t("badgeWordSync"),
        },
        {
          value: "spicy",
          label: t("providerSpicy"),
          shortLabel: "Spicy Lyrics",
          badge: t("badgeWordSync"),
        },
        {
          value: "lrclib",
          label: t("providerLrclib"),
          shortLabel: "LRCLIB",
          badge: t("badgeSynced"),
        },
        {
          value: "genius",
          label: t("providerGenius"),
          shortLabel: "Genius",
          badge: t("badgeUnsynced"),
        },
        {
          value: "spotify",
          label: t("providerSpotify"),
          shortLabel: "Spotify",
          badge: t("badgeOfficial"),
        },
      ],
      value: Settings.get("lyricsProvider") || "auto",
      onChange: (val) => Settings.set("lyricsProvider", val),
    });
    providerRow.append(el("label", null, t("lyricsProvider")), providerSelect);
    sec2.appendChild(providerRow);

    // Ambient Glow Toggle
    const glowRow = el("div", "fr-settings-row");
    const glowToggle = toggle(Settings.get("albumArtGlow"), (v) => Settings.set("albumArtGlow", v));
    glowRow.append(el("label", null, t("ambientGlow")), glowToggle);
    sec2.appendChild(glowRow);

    // Shadow Toggle
    const shadowRow = el("div", "fr-settings-row");
    const shadowToggle = toggle(Settings.get("albumArtShadow"), (v) => Settings.set("albumArtShadow", v));
    shadowRow.append(el("label", null, t("glowShadow")), shadowToggle);
    sec2.appendChild(shadowRow);

    // Artwork Size Dropdown
    const sizeRow = el("div", "fr-settings-row");
    const sizeSelect = createCustomSelect({
      options: [
        { value: "small", label: t("small") },
        { value: "medium", label: t("medium") },
        { value: "large", label: t("large") },
      ],
      value: Settings.get("albumArtSize") || "large",
      onChange: (val) => Settings.set("albumArtSize", val),
    });
    sizeRow.append(el("label", null, t("artworkSize")), sizeSelect);
    sec2.appendChild(sizeRow);

    // Idle Clock Position Dropdown
    const clockRow = el("div", "fr-settings-row");
    const clockSelect = createCustomSelect({
      options: [
        { value: "top", label: t("top") },
        { value: "bottom", label: t("bottom") },
        { value: "none", label: t("none") },
      ],
      value: Settings.get("clockPosition") || "top",
      onChange: (val) => Settings.set("clockPosition", val),
    });
    clockRow.append(el("label", null, t("idleClockPos")), clockSelect);
    sec2.appendChild(clockRow);

    // Unsynced Lyrics Auto-Scroll Speed Dropdown (NEW!)
    const scrollRow = el("div", "fr-settings-row");
    const scrollSelect = createCustomSelect({
      options: [
        { value: "track", label: t("trackProgress") },
        { value: "slow", label: t("slow") },
        { value: "normal", label: t("normal") },
        { value: "fast", label: t("fast") },
        { value: "off", label: t("off") },
      ],
      value: Settings.get("unsyncedScrollMode") || "track",
      onChange: (val) => Settings.set("unsyncedScrollMode", val),
    });
    scrollRow.append(el("label", null, t("unsyncedScroll")), scrollSelect);
    sec2.appendChild(scrollRow);

    // Language Dropdown
    const langRow = el("div", "fr-settings-row");
    const langSelect = createCustomSelect({
      options: [
        { value: "auto", label: t("auto") },
        { value: "en", label: "English" },
        { value: "tr", label: "Türkçe" },
      ],
      value: Settings.get("language") || "auto",
      onChange: (val) => {
        Settings.set("language", val);
      },
    });
    langRow.append(el("label", null, t("language")), langSelect);
    sec2.appendChild(langRow);

    panel.appendChild(sec2);
    panel.appendChild(el("div", "fr-settings-divider"));

    // ================= Section 3: Track Info =================
    const sec3 = el("div", "fr-settings-section");
    sec3.appendChild(el("div", "fr-settings-title", t("trackInfo")));

    // Metadata Position Dropdown
    const metaPosRow = el("div", "fr-settings-row");
    const metaPosSelect = createCustomSelect({
      options: [
        { value: "left", label: t("left") },
        { value: "center", label: t("center") },
        { value: "right", label: t("right") },
      ],
      value: Settings.get("metaPosition") || "left",
      onChange: (val) => Settings.set("metaPosition", val),
    });
    metaPosRow.append(el("label", null, t("position")), metaPosSelect);
    sec3.appendChild(metaPosRow);

    // Toggle: Show Album Art
    const showArtRow = el("div", "fr-settings-row");
    const showArtToggle = toggle(Settings.get("showAlbumArt") !== false, (v) => Settings.set("showAlbumArt", v));
    showArtRow.append(el("label", null, t("albumArt")), showArtToggle);
    sec3.appendChild(showArtRow);

    // Toggle: Show Track Title
    const showTitleRow = el("div", "fr-settings-row");
    const showTitleToggle = toggle(Settings.get("showTitle") !== false, (v) => Settings.set("showTitle", v));
    showTitleRow.append(el("label", null, t("trackTitle")), showTitleToggle);
    sec3.appendChild(showTitleRow);

    // Toggle: Show Artists
    const showArtistRow = el("div", "fr-settings-row");
    const showArtistToggle = toggle(Settings.get("showArtist") !== false, (v) => Settings.set("showArtist", v));
    showArtistRow.append(el("label", null, t("artists")), showArtistToggle);
    sec3.appendChild(showArtistRow);

    // Toggle: Show Album Name
    const showAlbumRow = el("div", "fr-settings-row");
    const showAlbumToggle = toggle(Settings.get("showAlbum") !== false, (v) => Settings.set("showAlbum", v));
    showAlbumRow.append(el("label", null, t("albumName")), showAlbumToggle);
    sec3.appendChild(showAlbumRow);

    panel.appendChild(sec3);

    this.root = panel;
    return panel;
  },

  toggleOpen() {
    if (this.root) {
      this.root.classList.toggle("fr-show");
    }
  },

  close() {
    if (this.root) {
      this.root.classList.remove("fr-show");
    }
  },

  destroy() {
    this.root?.remove();
    this.root = null;
  },
};
