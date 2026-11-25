/**
 * Settings Tab: Spotify Right Sidebar Lyrics, PiP Live Lyrics, and Language.
 */
import { toggle } from "../../utils/dom.js";
import { t } from "../../utils/i18n.js";
import { Settings } from "../../utils/settings.js";
import { createCustomSelect } from "../CustomSelect.js";
import { createSettingCard, createSettingRow } from "./helpers.js";

export function buildSidebarPipSection() {
  const sidebarEnabled = Settings.get("sidebarLyrics") !== false;

  const sidebarBgRow = createSettingRow(
    t("sidebarLyricsBg"),
    toggle(Settings.get("sidebarLyricsBg") !== false, (v) => Settings.set("sidebarLyricsBg", v)),
    t("sidebarLyricsBgDesc"),
    sidebarEnabled ? "fr-settings-subrow" : "fr-settings-subrow fr-hidden"
  );

  const sidebarLyricsRow = createSettingRow(
    t("sidebarLyrics"),
    toggle(sidebarEnabled, (v) => {
      Settings.set("sidebarLyrics", v);
      sidebarBgRow.classList.toggle("fr-hidden", !v);
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
    createSettingCard(t("tabSidebarPip"), [sidebarLyricsRow, sidebarBgRow, pipLyricsRow]),
    createSettingCard(t("language"), [langRow]),
  ];
}
