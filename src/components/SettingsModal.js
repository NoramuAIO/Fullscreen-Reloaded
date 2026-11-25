/**
 * Categorized Apple Music Liquid Settings Panel coordinator.
 * Delegates section construction to modular files under `src/components/settings/`.
 */
import { el, iconBtn } from "../utils/dom.js";
import { Icons } from "../utils/icons.js";
import { t } from "../utils/i18n.js";
import { buildLyricsSection } from "./settings/LyricsSection.js";
import { buildPlayerSection } from "./settings/PlayerSection.js";
import { buildSidebarPipSection } from "./settings/SidebarPipSection.js";
import { buildBackgroundSection } from "./settings/BackgroundSection.js";

export const SettingsModal = {
  root: null,
  _activeTab: "lyrics",

  build() {
    const panel = el("div", "fr-settings-panel");

    // Header bar
    const header = el("div", "fr-settings-header");
    const heading = el("div", "fr-settings-heading", t("settingsTitle"));
    const closeBtn = iconBtn(Icons.close, () => this.close(), "fr-settings-close");
    header.append(heading, closeBtn);
    panel.appendChild(header);

    // Category tabs
    const tabs = [
      { id: "lyrics", label: t("tabLyrics"), build: buildLyricsSection },
      { id: "player", label: t("tabPlayer"), build: buildPlayerSection },
      { id: "sidebar", label: t("tabSidebarPip"), build: buildSidebarPipSection },
      { id: "atmosphere", label: t("tabBackground"), build: buildBackgroundSection },
    ];

    const nav = el("div", "fr-settings-tabs");
    const body = el("div", "fr-settings-body");
    const tabBtns = new Map();
    const panes = new Map();

    const setActiveTab = (tabId) => {
      this._activeTab = tabId;
      for (const [id, btn] of tabBtns) {
        btn.classList.toggle("fr-tab-active", id === tabId);
      }
      for (const [id, pane] of panes) {
        pane.classList.toggle("fr-pane-active", id === tabId);
      }
    };

    for (const tab of tabs) {
      const btn = el("button", "fr-settings-tab", tab.label);
      btn.setAttribute("type", "button");
      btn.addEventListener("click", () => setActiveTab(tab.id));
      nav.appendChild(btn);
      tabBtns.set(tab.id, btn);

      const pane = el("div", "fr-settings-pane");
      const cards = tab.build();
      for (const card of cards) {
        pane.appendChild(card);
      }
      body.appendChild(pane);
      panes.set(tab.id, pane);
    }

    setActiveTab(panes.has(this._activeTab) ? this._activeTab : "lyrics");

    panel.append(nav, body);
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
