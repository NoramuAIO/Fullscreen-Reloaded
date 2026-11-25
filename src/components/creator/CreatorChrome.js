/**
 * FullLyrics Creator header, step bar, and saved library drawer.
 */
import { el } from "../../utils/dom.js";
import { Icons } from "../../utils/icons.js";
import { t } from "../../utils/i18n.js";
import {
  getCustomSync,
  hasCustomSync,
  listCustomSyncs,
  serializeDraftLinesToText,
  exportDraftAsJSON,
  exportDraftAsTTML,
  exportDraftAsLRC,
} from "../../services/CustomSyncStorage.js";
import { downloadFile, safeFileSlug } from "./CreatorUtils.js";

export const CreatorChrome = {
  // ==========================================================================
  // Main Render
  // ==========================================================================

  render() {
    if (!this.modal || !this.draft) return;

    // Keep fileInput & toastEl
    this.modal.innerHTML = "";
    this.modal.append(this.fileInputEl, this.toastEl);

    this.modal.appendChild(this.buildHeader());
    this.modal.appendChild(this.buildStepBar());

    if (this.libraryOpen) {
      this.modal.appendChild(this.buildLibraryDrawer());
    }

    const body = el("div", "fr-creator-body");
    this.bodyEl = body;
    this.renderStepContent(body);
    this.modal.appendChild(body);

    this.modal.appendChild(this.buildTransportFooter());
  },

  buildHeader() {
    const header = el("div", "fr-creator-header");

    // Left: Title & Track Meta
    const titleWrap = el("div", "fr-creator-title-wrap");
    const topRow = el("div", "fr-creator-title-row");
    const h2 = el("h2", "fr-creator-title", t("creatorTitle"));
    topRow.appendChild(h2);

    if (hasCustomSync(this.draft.trackUri || this.draft.trackId)) {
      const badge = el("span", "fr-creator-saved-pill", t("creatorSavedBadge"));
      topRow.appendChild(badge);
    }

    const sub = el(
      "div",
      "fr-creator-sub",
      `${this.draft.title || "—"} — ${this.draft.artist || "—"}`
    );
    titleWrap.append(topRow, sub);

    // Center: Mode Switcher (Block / Karaoke / Static)
    const modeSwitch = el("div", "fr-creator-mode-switch");
    const modes = [
      { id: "line", label: t("creatorModeBlock") },
      { id: "word", label: t("creatorModeKaraoke") },
      { id: "static", label: t("creatorModeStatic") },
    ];
    for (const m of modes) {
      const btn = el(
        "button",
        `fr-creator-mode-btn${this.draft.syncMode === m.id ? " fr-active" : ""}`,
        m.label
      );
      btn.type = "button";
      btn.addEventListener("click", () => this.setSyncMode(m.id));
      modeSwitch.appendChild(btn);
    }

    // Right: Pull Online, Library, More Menu, Save, Close
    const actions = el("div", "fr-creator-header-actions");

    const pullBtn = el("button", "fr-creator-btn fr-creator-btn-ghost");
    pullBtn.type = "button";
    pullBtn.innerHTML = `${Icons.wand}<span>${t("creatorLoadCurrent")}</span>`;
    pullBtn.addEventListener("click", () => this.pullOnlineLyrics());

    const libCount = listCustomSyncs().length;
    const libBtn = el(
      "button",
      `fr-creator-btn fr-creator-btn-ghost${this.libraryOpen ? " fr-active" : ""}`
    );
    libBtn.type = "button";
    libBtn.innerHTML = `${Icons.library}<span>${t("creatorLocalDbBtn", { count: libCount })}</span>`;
    libBtn.addEventListener("click", () => {
      this.libraryOpen = !this.libraryOpen;
      this.moreMenuOpen = false;
      this.render();
    });

    // More dropdown (Import / Export JSON, TTML, LRC / Delete)
    const moreWrap = el("div", "fr-creator-more-wrap");
    const moreBtn = el(
      "button",
      `fr-creator-icon-btn${this.moreMenuOpen ? " fr-active" : ""}`
    );
    moreBtn.type = "button";
    moreBtn.innerHTML = Icons.more;
    moreBtn.title = t("creatorImportExport");
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.moreMenuOpen = !this.moreMenuOpen;
      this.libraryOpen = false;
      this.render();
    });
    moreWrap.appendChild(moreBtn);

    if (this.moreMenuOpen) {
      const menu = el("div", "fr-creator-dropdown");
      const addMenuItem = (iconSvg, label, onClick, danger = false) => {
        const item = el(
          "button",
          `fr-creator-dropdown-item${danger ? " fr-danger" : ""}`
        );
        item.type = "button";
        item.innerHTML = `${iconSvg}<span>${label}</span>`;
        item.addEventListener("click", () => {
          this.moreMenuOpen = false;
          onClick();
        });
        menu.appendChild(item);
      };

      addMenuItem(Icons.upload, t("creatorImport"), () => this.fileInputEl.click());
      addMenuItem(Icons.download, t("creatorExportJson"), () => {
        this.syncRawTextToDraft();
        const slug = safeFileSlug(this.draft.title, this.draft.artist);
        downloadFile(`${slug}.liquid-lyrics.json`, exportDraftAsJSON(this.draft), "application/json");
      });
      addMenuItem(Icons.download, t("creatorExportTtml"), () => {
        this.syncRawTextToDraft();
        const slug = safeFileSlug(this.draft.title, this.draft.artist);
        downloadFile(`${slug}.ttml`, exportDraftAsTTML(this.draft), "application/xml");
      });
      addMenuItem(Icons.download, t("creatorExportLrc"), () => {
        this.syncRawTextToDraft();
        const slug = safeFileSlug(this.draft.title, this.draft.artist);
        downloadFile(`${slug}.lrc`, exportDraftAsLRC(this.draft), "text/plain");
      });

      if (hasCustomSync(this.draft.trackUri || this.draft.trackId)) {
        addMenuItem(
          Icons.trash,
          t("creatorDeleteSync"),
          () => this.handleDeleteFromLocalDB(),
          true
        );
      }

      moreWrap.appendChild(menu);
    }

    const saveBtn = el("button", "fr-creator-btn fr-creator-btn-primary");
    saveBtn.type = "button";
    saveBtn.innerHTML = `${Icons.check}<span>${t("creatorSaveBtn")}</span>`;
    saveBtn.addEventListener("click", () => this.handleSaveToLocalDB());

    const closeBtn = el("button", "fr-creator-icon-btn");
    closeBtn.type = "button";
    closeBtn.innerHTML = Icons.close;
    closeBtn.addEventListener("click", () => this.close());

    actions.append(pullBtn, libBtn, moreWrap, saveBtn, closeBtn);
    header.append(titleWrap, modeSwitch, actions);
    return header;
  },

  buildStepBar() {
    const bar = el("div", "fr-creator-steps");
    const steps = [
      { id: "text", label: t("creatorStepText") },
      { id: "sync", label: t("creatorStepSync") },
      { id: "preview", label: t("creatorStepPreview") },
    ];
    for (const s of steps) {
      const btn = el(
        "button",
        `fr-creator-step-btn${this.step === s.id ? " fr-active" : ""}`,
        s.label
      );
      btn.type = "button";
      btn.addEventListener("click", () => this.setStep(s.id));
      bar.appendChild(btn);
    }
    return bar;
  },

  buildLibraryDrawer() {
    const drawer = el("div", "fr-creator-library");
    const head = el("div", "fr-creator-library-head");
    head.appendChild(
      el(
        "span",
        "fr-creator-library-title",
        `${t("creatorSavedLibrary")} (liquid-lyrics-custom-sync)`
      )
    );

    const list = listCustomSyncs();
    const grid = el("div", "fr-creator-library-list");

    if (!list.length) {
      grid.appendChild(
        el(
          "div",
          "fr-creator-empty-hint",
          t("creatorLibraryEmpty")
        )
      );
    } else {
      for (const item of list) {
        const row = el("div", "fr-creator-library-item");
        const meta = el("div", "fr-creator-library-meta");
        meta.append(
          el("div", "fr-creator-library-song", item.title || item.trackId),
          el(
            "div",
            "fr-creator-library-artist",
            `${item.artist || "—"} · ${item.mode === "word" ? t("creatorModeKaraoke") : t("creatorModeBlock")}`
          )
        );

        const acts = el("div", "fr-creator-library-actions");
        const loadBtn = el("button", "fr-creator-mini-btn", t("creatorLoadEditor"));
        loadBtn.type = "button";
        loadBtn.addEventListener("click", () => {
          const rec = getCustomSync(item.trackUri || item.trackId);
          if (rec && rec.draft) {
            this.draft = {
              ...rec.draft,
              syncMode:
                rec.draft.syncMode ||
                (rec.lyrics?.Type === "Static"
                  ? "static"
                  : rec.mode === "word"
                  ? "word"
                  : "line"),
            };
            this.rawTextCache = serializeDraftLinesToText(this.draft.lines || []);
            this.libraryOpen = false;
            this.render();
            this.showToast(t("creatorLoadedToast", { title: item.title }));
          }
        });

        const expBtn = el("button", "fr-creator-mini-btn", ".json");
        expBtn.type = "button";
        expBtn.addEventListener("click", () => {
          const rec = getCustomSync(item.trackUri || item.trackId);
          if (rec) {
            const slug = safeFileSlug(rec.title, rec.artist);
            downloadFile(
              `${slug}.liquid-lyrics.json`,
              JSON.stringify(rec, null, 2),
              "application/json"
            );
          }
        });

        const delBtn = el("button", "fr-creator-mini-btn fr-danger", t("creatorDeleteBtn"));
        delBtn.type = "button";
        delBtn.addEventListener("click", () => {
          this.handleDeleteFromLocalDB(item.trackUri || item.trackId);
        });

        acts.append(loadBtn, expBtn, delBtn);
        row.append(meta, acts);
        grid.appendChild(row);
      }
    }

    drawer.append(head, grid);
    return drawer;
  },

  renderStepContent(container) {
    container.innerHTML = "";
    if (this.step === "text") {
      this.renderTextAndBuilderStep(container);
    } else if (this.step === "sync") {
      this.renderSyncStep(container);
    } else {
      this.renderPreviewStep(container);
    }
  },
};
