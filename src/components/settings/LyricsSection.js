/**
 * Settings Tab: Lyrics & Karaoke options.
 */
import { toggle } from "../../utils/dom.js";
import { t } from "../../utils/i18n.js";
import { Settings } from "../../utils/settings.js";
import { createCustomSelect } from "../CustomSelect.js";
import { createSettingCard, createSettingRow } from "./helpers.js";

export function buildLyricsSection() {
  const showLyricsRow = createSettingRow(
    t("showLyrics"),
    toggle(Settings.get("showLyrics"), (v) => Settings.set("showLyrics", v))
  );

  const idleLyricsRow = createSettingRow(
    t("idleLyrics"),
    toggle(Settings.get("idleLyrics"), (v) => Settings.set("idleLyrics", v))
  );

  const waterfallSelect = createCustomSelect({
    options: [
      { value: "normal", label: t("waterfallNormal"), shortLabel: t("waterfallNormal") },
      { value: "intense", label: t("waterfallIntense"), shortLabel: t("waterfallIntense") },
      { value: "off", label: t("waterfallOff"), shortLabel: t("waterfallOff") },
    ],
    value: Settings.get("waterfallMode") || "normal",
    onChange: (val) => Settings.set("waterfallMode", val),
  });
  const waterfallRow = createSettingRow(t("waterfallFlow"), waterfallSelect);

  const letterByLetterRow = createSettingRow(
    t("letterByLetter"),
    toggle(Settings.get("letterByLetter") !== false, (v) => Settings.set("letterByLetter", v))
  );

  const interludeRow = createSettingRow(
    t("interludeDots"),
    toggle(Settings.get("interludeDots") !== false, (v) => Settings.set("interludeDots", v))
  );

  const bgDuetRow = createSettingRow(
    t("bgVocalsDuet"),
    toggle(Settings.get("bgVocalsDuet") !== false, (v) => Settings.set("bgVocalsDuet", v))
  );

  const providerSelect = createCustomSelect({
    options: [
      {
        value: "auto",
        label: t("providerAuto"),
        shortLabel: t("providerAutoShort"),
        sublabel: t("providerAutoSub"),
        badge: t("badgeSmart"),
      },
      { value: "applemusic", label: t("providerApple"), shortLabel: "Apple Music", badge: t("badgeWordSync") },
      { value: "spicy", label: t("providerSpicy"), shortLabel: "Spicy Lyrics", badge: t("badgeWordSync") },
      { value: "lrclib", label: t("providerLrclib"), shortLabel: "LRCLIB", badge: t("badgeSynced") },
      { value: "genius", label: t("providerGenius"), shortLabel: "Genius", badge: t("badgeUnsynced") },
      { value: "spotify", label: t("providerSpotify"), shortLabel: "Spotify", badge: t("badgeOfficial") },
    ],
    value: Settings.get("lyricsProvider") || "auto",
    onChange: (val) => Settings.set("lyricsProvider", val),
  });
  const providerRow = createSettingRow(t("lyricsProvider"), providerSelect);

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
  const scrollRow = createSettingRow(t("unsyncedScroll"), scrollSelect);

  return [
    createSettingCard(t("tabLyrics"), [
      showLyricsRow,
      idleLyricsRow,
      letterByLetterRow,
      waterfallRow,
      interludeRow,
      bgDuetRow,
    ]),
    createSettingCard(t("lyricsProvider"), [providerRow, scrollRow]),
  ];
}
