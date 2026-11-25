/**
 * Settings Tab: Spotify Right Sidebar Lyrics, PiP Live Lyrics, and Language.
 */
import { toggle } from "../../utils/dom.js";
import { t } from "../../utils/i18n.js";
import { Settings } from "../../utils/settings.js";
import { createCustomSelect } from "../CustomSelect.js";
import { createCustomColorPicker } from "../CustomColorPicker.js";
import { createSettingCard, createSettingRow } from "./helpers.js";

export function buildSidebarPipSection() {
  const sidebarEnabled = Settings.get("sidebarLyrics") !== false;
  const panelBgMode = Settings.get("sidebarPanelBg") || "liquid-aurora";

  const sidebarPanelBgColorPicker = createCustomColorPicker({
    value: Settings.get("sidebarPanelBgColor") || "#1b1433",
    onChange: (hex) => Settings.set("sidebarPanelBgColor", hex),
  });
  const sidebarPanelBgColorRow = createSettingRow(
    t("sidebarPanelBgColor"),
    sidebarPanelBgColorPicker,
    null,
    panelBgMode === "custom-color" ? "fr-settings-subrow" : "fr-settings-subrow fr-hidden"
  );

  const sidebarPanelBgSelect = createCustomSelect({
    options: [
      {
        value: "liquid-aurora",
        label: t("sidebarBgLiquidAurora"),
        shortLabel: t("sidebarBgLiquidAurora"),
        sublabel: t("sidebarBgLiquidAuroraSub"),
        badge: t("badgeSmart"),
      },
      { value: "song-mesh", label: t("sidebarBgSongMesh"), shortLabel: t("sidebarBgSongMesh") },
      { value: "frosted-art", label: t("sidebarBgFrostedArt"), shortLabel: t("sidebarBgFrostedArt") },
      { value: "custom-color", label: t("sidebarBgCustomColor"), shortLabel: t("sidebarBgCustomColor") },
      { value: "off", label: t("off"), shortLabel: t("off") },
    ],
    value: panelBgMode,
    onChange: (val) => {
      Settings.set("sidebarPanelBg", val);
      sidebarPanelBgColorRow.classList.toggle("fr-hidden", val !== "custom-color");
    },
  });
  const sidebarPanelBgRow = createSettingRow(
    t("sidebarPanelBg"),
    sidebarPanelBgSelect,
    t("sidebarPanelBgDesc")
  );

  const sidebarBgRow = createSettingRow(
    t("sidebarLyricsBg"),
    toggle(Settings.get("sidebarLyricsBg") !== false, (v) => Settings.set("sidebarLyricsBg", v)),
    t("sidebarLyricsBgDesc"),
    sidebarEnabled ? "fr-settings-subrow" : "fr-settings-subrow fr-hidden"
  );

  const sidebarAnimRow = createSettingRow(
    t("sidebarLyricsAnim"),
    toggle(Settings.get("sidebarLyricsAnim") !== false, (v) => Settings.set("sidebarLyricsAnim", v)),
    t("sidebarLyricsAnimDesc"),
    sidebarEnabled ? "fr-settings-subrow" : "fr-settings-subrow fr-hidden"
  );

  const sidebarLyricsRow = createSettingRow(
    t("sidebarLyrics"),
    toggle(sidebarEnabled, (v) => {
      Settings.set("sidebarLyrics", v);
      sidebarBgRow.classList.toggle("fr-hidden", !v);
      sidebarAnimRow.classList.toggle("fr-hidden", !v);
    }),
    t("sidebarLyricsDesc")
  );

  const pipLyricsRow = createSettingRow(
    t("pipLyrics"),
    toggle(Settings.get("pipLyrics") !== false, (v) => Settings.set("pipLyrics", v)),
    t("pipLyricsDesc")
  );

  const langSelect = createCustomSelect({
    options: [
      { value: "auto", label: t("auto") },
      { value: "en", label: "English" },
      { value: "tr", label: "Türkçe" },
    ],
    value: Settings.get("language") || "auto",
    onChange: (val) => Settings.set("language", val),
  });
  const langRow = createSettingRow(t("language"), langSelect);

  return [
    createSettingCard(t("tabSidebarPip"), [
      sidebarPanelBgRow,
      sidebarPanelBgColorRow,
      sidebarLyricsRow,
      sidebarBgRow,
      sidebarAnimRow,
      pipLyricsRow,
    ]),
    createSettingCard(t("language"), [langRow]),
  ];
}
