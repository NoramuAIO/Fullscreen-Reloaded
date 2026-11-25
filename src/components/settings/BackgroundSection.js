/**
 * Settings Tab: Background, Custom Color, Mood Atmosphere, and Beat Pulse.
 */
import { t } from "../../utils/i18n.js";
import { Settings } from "../../utils/settings.js";
import { createCustomSelect } from "../CustomSelect.js";
import { createCustomColorPicker } from "../CustomColorPicker.js";
import { createSettingCard, createSettingRow } from "./helpers.js";

export function buildBackgroundSection() {
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
  const bgRow = createSettingRow(t("mode"), bgSelect);

  const colorPicker = createCustomColorPicker({
    value: Settings.get("customColor") || "#101014",
    onChange: (hex) => Settings.set("customColor", hex),
  });
  const colorRow = createSettingRow(t("customColor"), colorPicker);

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
  const moodRow = createSettingRow(t("moodAtmosphere"), moodSelect);

  const beatSelect = createCustomSelect({
    options: [
      { value: "normal", label: t("beatNormal"), shortLabel: t("beatNormal") },
      { value: "intense", label: t("beatIntense"), shortLabel: t("beatIntense") },
      { value: "off", label: t("beatOff"), shortLabel: t("beatOff") },
    ],
    value: Settings.get("beatReactive") || "normal",
    onChange: (val) => Settings.set("beatReactive", val),
  });
  const beatRow = createSettingRow(t("beatReactive"), beatSelect);

  return [
    createSettingCard(t("background"), [bgRow, colorRow]),
    createSettingCard(t("moodAtmosphere"), [moodRow, beatRow]),
  ];
}
