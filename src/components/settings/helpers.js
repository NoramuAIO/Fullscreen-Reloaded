/**
 * Shared builders for Apple Music Liquid categorized Settings Panel rows and cards.
 */
import { el } from "../../utils/dom.js";

export function createSettingRow(labelText, controlEl, descText = "", extraClass = "") {
  const row = el("div", extraClass ? `fr-settings-row ${extraClass}` : "fr-settings-row");
  if (descText) {
    const labelGroup = el("div", "fr-settings-label-group");
    labelGroup.append(el("label", null, labelText), el("span", "fr-settings-desc", descText));
    row.append(labelGroup, controlEl);
  } else {
    row.append(el("label", null, labelText), controlEl);
  }
  return row;
}

export function createSettingCard(titleText, rows = []) {
  const card = el("div", "fr-settings-card");
  if (titleText) {
    card.appendChild(el("div", "fr-settings-title", titleText));
  }
  const body = el("div", "fr-settings-card-body");
  for (const row of rows) {
    if (row) body.appendChild(row);
  }
  card.appendChild(body);
  return card;
}
