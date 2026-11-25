/**
 * Settings Tab: Player (Switch to New Player + conditional Show Old Player),
 * Artwork presentation, and Track Info visibility.
 */
import { toggle } from "../../utils/dom.js";
import { t } from "../../utils/i18n.js";
import { Settings } from "../../utils/settings.js";
import { createCustomSelect } from "../CustomSelect.js";
import { createSettingCard, createSettingRow } from "./helpers.js";

export function buildPlayerSection() {
  const isNewPlayerOn = Boolean(Settings.get("newPlayerMode"));

  // Conditional sub-row: Show Old Player (only visible when Switch to New Player is ON)
  const legacyPlayerRow = createSettingRow(
    t("showLegacyPlayer"),
    toggle(Boolean(Settings.get("showLegacyPlayer")), (v) => Settings.set("showLegacyPlayer", v)),
    t("showLegacyPlayerDesc"),
    isNewPlayerOn ? "fr-settings-subrow" : "fr-settings-subrow fr-hidden"
  );

  const newPlayerRow = createSettingRow(
    t("switchToNewPlayer"),
    toggle(isNewPlayerOn, (v) => {
      Settings.set("newPlayerMode", v);
      legacyPlayerRow.classList.toggle("fr-hidden", !v);
    }),
    t("switchToNewPlayerDesc")
  );

  // Artwork appearance
  const glowRow = createSettingRow(
    t("ambientGlow"),
    toggle(Settings.get("albumArtGlow"), (v) => Settings.set("albumArtGlow", v))
  );
  const shadowRow = createSettingRow(
    t("glowShadow"),
    toggle(Settings.get("albumArtShadow"), (v) => Settings.set("albumArtShadow", v))
  );
  const sizeSelect = createCustomSelect({
    options: [
      { value: "small", label: t("small") },
      { value: "medium", label: t("medium") },
      { value: "large", label: t("large") },
    ],
    value: Settings.get("albumArtSize") || "large",
    onChange: (val) => Settings.set("albumArtSize", val),
  });
  const sizeRow = createSettingRow(t("artworkSize"), sizeSelect);

  const clockSelect = createCustomSelect({
    options: [
      { value: "top", label: t("top") },
      { value: "bottom", label: t("bottom") },
      { value: "none", label: t("none") },
    ],
    value: Settings.get("clockPosition") || "top",
    onChange: (val) => Settings.set("clockPosition", val),
  });
  const clockRow = createSettingRow(t("idleClockPos"), clockSelect);

  // Track Info
  const metaPosSelect = createCustomSelect({
    options: [
      { value: "left", label: t("left") },
      { value: "center", label: t("center") },
      { value: "right", label: t("right") },
    ],
    value: Settings.get("metaPosition") || "left",
    onChange: (val) => Settings.set("metaPosition", val),
  });
  const metaPosRow = createSettingRow(t("position"), metaPosSelect);

  const showArtRow = createSettingRow(
    t("albumArt"),
    toggle(Settings.get("showAlbumArt") !== false, (v) => Settings.set("showAlbumArt", v))
  );
  const showTitleRow = createSettingRow(
    t("trackTitle"),
    toggle(Settings.get("showTitle") !== false, (v) => Settings.set("showTitle", v))
  );
  const showArtistRow = createSettingRow(
    t("artists"),
    toggle(Settings.get("showArtist") !== false, (v) => Settings.set("showArtist", v))
  );
  const showAlbumRow = createSettingRow(
    t("albumName"),
    toggle(Settings.get("showAlbum") !== false, (v) => Settings.set("showAlbum", v))
  );

  return [
    createSettingCard(t("tabPlayer"), [newPlayerRow, legacyPlayerRow]),
    createSettingCard(t("appearance"), [sizeRow, glowRow, shadowRow, clockRow]),
    createSettingCard(t("trackInfo"), [metaPosRow, showArtRow, showTitleRow, showArtistRow, showAlbumRow]),
  ];
}
