/**
 * FullLyrics Creator Step 1: Visual sentence/word builder and raw text editor.
 */
import { el } from "../../utils/dom.js";
import { Icons } from "../../utils/icons.js";
import { t } from "../../utils/i18n.js";
import {
  splitTextIntoTokens,
  createLyricDraftLine,
  createInterludeDraftLine,
  createBackgroundDraftEntry,
  parsePlainTextToDraftLines,
  serializeDraftLinesToText,
} from "../../services/CustomSyncStorage.js";
import { formatCueTime } from "./CreatorUtils.js";

export const CreatorTextStep = {
  // ==========================================================================
  // STEP 1: Text & Visual Sentence / Word Builder
  // ==========================================================================

  renderTextAndBuilderStep(container) {
    const wrap = el("div", "fr-creator-text-step");

    // Sub-toolbar: Switch between Visual Builder & Raw Text + Quick Add Actions
    const toolbar = el("div", "fr-creator-subtoolbar");
    const subSwitch = el("div", "fr-creator-subswitch");

    const visBtn = el(
      "button",
      `fr-creator-subbtn${this.textSubMode === "visual" ? " fr-active" : ""}`,
      t("creatorVisualBuilder")
    );
    visBtn.type = "button";
    visBtn.addEventListener("click", () => {
      if (this.textSubMode === "raw") {
        this.draft.lines = parsePlainTextToDraftLines(this.rawTextCache, this.draft.lines);
      }
      this.textSubMode = "visual";
      this.renderStepContent(this.bodyEl);
    });

    const rawBtn = el(
      "button",
      `fr-creator-subbtn${this.textSubMode === "raw" ? " fr-active" : ""}`,
      t("creatorRawText")
    );
    rawBtn.type = "button";
    rawBtn.addEventListener("click", () => {
      this.rawTextCache = serializeDraftLinesToText(this.draft.lines);
      this.textSubMode = "raw";
      this.renderStepContent(this.bodyEl);
    });

    subSwitch.append(visBtn, rawBtn);

    const quickBtns = el("div", "fr-creator-quick-actions");
    if (this.textSubMode === "visual") {
      const addLineBtn = el("button", "fr-creator-chip-btn", t("creatorAddSentence"));
      addLineBtn.type = "button";
      addLineBtn.addEventListener("click", () => {
        this.draft.lines.push(createLyricDraftLine("Yeni söz satırı", false));
        this.renderStepContent(this.bodyEl);
      });

      const addWordLineBtn = el("button", "fr-creator-chip-btn", "+ Tek Kelime Ekle");
      addWordLineBtn.type = "button";
      addWordLineBtn.addEventListener("click", () => {
        const last = this.draft.lines[this.draft.lines.length - 1];
        if (last && last.kind === "lyric") {
          last.tokens.push({ text: "kelime", start: null, end: null });
          last.text = last.tokens.map((tok) => tok.text).join(" ");
        } else {
          this.draft.lines.push(createLyricDraftLine("kelime", false));
        }
        this.renderStepContent(this.bodyEl);
      });

      const addIntBtn = el("button", "fr-creator-chip-btn", t("creatorAddInterlude"));
      addIntBtn.type = "button";
      addIntBtn.addEventListener("click", () => {
        this.draft.lines.push(createInterludeDraftLine());
        this.renderStepContent(this.bodyEl);
      });

      quickBtns.append(addLineBtn, addWordLineBtn, addIntBtn);
    } else {
      const insInterlude = el("button", "fr-creator-chip-btn", "+ #interlude");
      insInterlude.type = "button";
      insInterlude.addEventListener("click", () => {
        this.rawTextCache = (this.rawTextCache ? this.rawTextCache + "\n" : "") + "#interlude";
        this.renderStepContent(this.bodyEl);
      });

      const insBg = el("button", "fr-creator-chip-btn", "+ [Arka Vokal]");
      insBg.type = "button";
      insBg.addEventListener("click", () => {
        this.rawTextCache = (this.rawTextCache ? this.rawTextCache + "\n" : "") + "[arka vokal]";
        this.renderStepContent(this.bodyEl);
      });

      const insDuet = el("button", "fr-creator-chip-btn", "+ v2: Düet Satırı");
      insDuet.type = "button";
      insDuet.addEventListener("click", () => {
        this.rawTextCache = (this.rawTextCache ? this.rawTextCache + "\n" : "") + "v2: ";
        this.renderStepContent(this.bodyEl);
      });

      quickBtns.append(insInterlude, insBg, insDuet);
    }

    toolbar.append(subSwitch, quickBtns);
    wrap.appendChild(toolbar);

    if (this.textSubMode === "raw") {
      const ta = document.createElement("textarea");
      ta.className = "fr-creator-textarea";
      ta.placeholder = t("creatorTextPlaceholder");
      ta.value = this.rawTextCache;
      ta.addEventListener("input", () => {
        this.rawTextCache = ta.value;
        this.draft.lines = parsePlainTextToDraftLines(this.rawTextCache, this.draft.lines);
      });
      wrap.appendChild(ta);
    } else {
      const builderList = el("div", "fr-creator-builder-list");
      if (!this.draft.lines.length) {
        const emptyBox = el("div", "fr-creator-empty-box");
        emptyBox.append(
          el(
            "p",
            null,
            "Henüz satır yok. Yukarıdan '+ Cümle Ekle'ye tıklayın, 'Aktif Sözleri Çek' ile şarkının mevcut sözlerini getirin veya 'Toplu Metin' sekmesinden yapıştırın."
          )
        );
        builderList.appendChild(emptyBox);
      } else {
        this.draft.lines.forEach((line, idx) => {
          builderList.appendChild(this.buildVisualLineCard(line, idx));
        });
      }
      wrap.appendChild(builderList);
    }

    // Credit input at bottom
    const creditRow = el("div", "fr-creator-credit-row");
    const creditInput = document.createElement("input");
    creditInput.type = "text";
    creditInput.className = "fr-creator-credit-input";
    creditInput.placeholder = t("creatorCreditPlaceholder");
    creditInput.value = this.draft.credit || "";
    creditInput.addEventListener("input", () => {
      this.draft.credit = creditInput.value;
    });
    creditRow.appendChild(creditInput);
    wrap.appendChild(creditRow);

    container.appendChild(wrap);
  },

  buildVisualLineCard(line, lineIdx) {
    const card = el(
      "div",
      `fr-creator-line-card${line.kind === "interlude" ? " fr-is-interlude" : ""}${
        line.isDuet ? " fr-is-duet" : ""
      }`
    );

    const top = el("div", "fr-creator-line-card-top");
    const badge = el("span", "fr-creator-line-num", `#${lineIdx + 1}`);
    top.appendChild(badge);

    if (line.kind === "interlude") {
      top.appendChild(
        el("span", "fr-creator-interlude-title", "♪ Enstrümantal Ara (#interlude • • •)")
      );
    } else {
      const sentenceInput = document.createElement("input");
      sentenceInput.type = "text";
      sentenceInput.className = "fr-creator-line-input";
      sentenceInput.placeholder = "Cümle veya söz satırı yazın...";
      sentenceInput.value = line.text || "";
      sentenceInput.addEventListener("change", () => {
        const clean = sentenceInput.value.trim();
        line.text = clean;
        line.tokens = splitTextIntoTokens(clean, line.tokens || []);
        this.renderStepContent(this.bodyEl);
      });
      top.appendChild(sentenceInput);
    }

    const controls = el("div", "fr-creator-line-card-controls");

    const lineStartMs = line.start ?? line.tokens?.[0]?.start ?? null;
    if (lineStartMs != null) {
      const playLineBtn = el("button", "fr-creator-mini-icon-btn");
      playLineBtn.type = "button";
      playLineBtn.innerHTML = Icons.play;
      playLineBtn.title = `Bu satırdan oynat (${formatCueTime(lineStartMs)})`;
      playLineBtn.addEventListener("click", () => this.seek(lineStartMs, true));
      controls.appendChild(playLineBtn);
    }

    if (line.kind === "lyric") {
      // Duet v2 toggle
      const duetBtn = el(
        "button",
        `fr-creator-mini-btn${line.isDuet ? " fr-active-duet" : ""}`,
        t("creatorDuetToggle")
      );
      duetBtn.type = "button";
      duetBtn.title = "Sağ hizalı Düet şarkıcı (OppositeAligned / v2)";
      duetBtn.addEventListener("click", () => {
        line.isDuet = !line.isDuet;
        this.renderStepContent(this.bodyEl);
      });

      // + Word button
      const addWordBtn = el("button", "fr-creator-mini-btn", t("creatorAddWord"));
      addWordBtn.type = "button";
      addWordBtn.addEventListener("click", () => {
        line.tokens.push({ text: "kelime", start: null, end: null });
        line.text = line.tokens.map((t) => t.text).join(" ");
        this.renderStepContent(this.bodyEl);
      });

      // + Background Vocal button
      const addBgBtn = el("button", "fr-creator-mini-btn", t("creatorAddBgVocal"));
      addBgBtn.type = "button";
      addBgBtn.addEventListener("click", () => {
        line.backgrounds = line.backgrounds || [];
        line.backgrounds.push(createBackgroundDraftEntry("arka vokal"));
        this.renderStepContent(this.bodyEl);
      });

      controls.append(duetBtn, addWordBtn, addBgBtn);
    }

    // Insert lyric line below
    const insBelowBtn = el("button", "fr-creator-mini-btn", "+ Altına Satır");
    insBelowBtn.type = "button";
    insBelowBtn.title = "Bu satırın hemen altına yeni söz satırı ekle";
    insBelowBtn.addEventListener("click", () => {
      this.draft.lines.splice(lineIdx + 1, 0, createLyricDraftLine("", false));
      this.renderStepContent(this.bodyEl);
    });

    // Insert interlude below
    const insIntBelowBtn = el("button", "fr-creator-mini-btn", "+ Altına İnterlude");
    insIntBelowBtn.type = "button";
    insIntBelowBtn.title = "Bu satırın hemen altına enstrümantal ara (• • •) ekle";
    insIntBelowBtn.addEventListener("click", () => {
      this.draft.lines.splice(lineIdx + 1, 0, createInterludeDraftLine());
      this.renderStepContent(this.bodyEl);
    });

    // Move Up / Down
    const upBtn = el("button", "fr-creator-mini-icon-btn");
    upBtn.type = "button";
    upBtn.innerHTML = Icons.up;
    upBtn.disabled = lineIdx === 0;
    upBtn.addEventListener("click", () => {
      if (lineIdx <= 0) return;
      const tmp = this.draft.lines[lineIdx - 1];
      this.draft.lines[lineIdx - 1] = this.draft.lines[lineIdx];
      this.draft.lines[lineIdx] = tmp;
      this.renderStepContent(this.bodyEl);
    });

    const downBtn = el("button", "fr-creator-mini-icon-btn");
    downBtn.type = "button";
    downBtn.innerHTML = Icons.down;
    downBtn.disabled = lineIdx >= this.draft.lines.length - 1;
    downBtn.addEventListener("click", () => {
      if (lineIdx >= this.draft.lines.length - 1) return;
      const tmp = this.draft.lines[lineIdx + 1];
      this.draft.lines[lineIdx + 1] = this.draft.lines[lineIdx];
      this.draft.lines[lineIdx] = tmp;
      this.renderStepContent(this.bodyEl);
    });

    // Delete line
    const delBtn = el("button", "fr-creator-mini-icon-btn fr-danger");
    delBtn.type = "button";
    delBtn.innerHTML = Icons.trash;
    delBtn.addEventListener("click", () => {
      this.draft.lines.splice(lineIdx, 1);
      this.renderStepContent(this.bodyEl);
    });

    controls.append(insBelowBtn, insIntBelowBtn, upBtn, downBtn, delBtn);
    top.appendChild(controls);
    card.appendChild(top);

    // Individual Word Pills Editor (for Lyric lines)
    if (line.kind === "lyric" && Array.isArray(line.tokens) && line.tokens.length > 0) {
      const wordsWrap = el("div", "fr-creator-word-pills");
      line.tokens.forEach((tok, tokIdx) => {
        const pill = el("div", "fr-creator-word-pill");
        const wInput = document.createElement("input");
        wInput.type = "text";
        wInput.className = "fr-creator-word-pill-input";
        wInput.value = tok.text;
        wInput.size = Math.max(2, tok.text.length);
        wInput.addEventListener("change", () => {
          const val = wInput.value.trim();
          if (!val) {
            line.tokens.splice(tokIdx, 1);
          } else if (val.includes(" ")) {
            // If user typed space inside a word pill, automatically split it into multiple words!
            const subParts = val.split(/\s+/).filter(Boolean);
            const newToks = subParts.map((sp, sIdx) => ({
              text: sp,
              start: sIdx === 0 ? tok.start : null,
              end: sIdx === subParts.length - 1 ? tok.end : null,
            }));
            line.tokens.splice(tokIdx, 1, ...newToks);
          } else {
            tok.text = val;
          }
          line.text = line.tokens.map((t) => t.text).join(" ");
          this.renderStepContent(this.bodyEl);
        });

        const delWordBtn = el("button", "fr-creator-word-pill-del", "×");
        delWordBtn.type = "button";
        delWordBtn.title = "Kelimeyi sil";
        delWordBtn.addEventListener("click", () => {
          line.tokens.splice(tokIdx, 1);
          line.text = line.tokens.map((t) => t.text).join(" ");
          this.renderStepContent(this.bodyEl);
        });

        pill.append(wInput, delWordBtn);
        wordsWrap.appendChild(pill);
      });
      card.appendChild(wordsWrap);
    }

    // Background Vocals Editor inside the card
    if (line.kind === "lyric" && Array.isArray(line.backgrounds) && line.backgrounds.length > 0) {
      const bgContainer = el("div", "fr-creator-bg-list");
      line.backgrounds.forEach((bg, bgIdx) => {
        const bgRow = el("div", "fr-creator-bg-edit-row");
        const bgTag = el("span", "fr-creator-bg-badge", "[Arka Vokal]");
        const bgInput = document.createElement("input");
        bgInput.type = "text";
        bgInput.className = "fr-creator-bg-input";
        bgInput.value = bg.text || "";
        bgInput.placeholder = "Arka vokal sözleri...";
        bgInput.addEventListener("change", () => {
          const cleanBg = bgInput.value.trim();
          if (!cleanBg) {
            line.backgrounds.splice(bgIdx, 1);
          } else {
            bg.text = cleanBg;
            bg.tokens = splitTextIntoTokens(cleanBg, bg.tokens || []);
          }
          this.renderStepContent(this.bodyEl);
        });

        const delBg = el("button", "fr-creator-mini-btn fr-danger", "×");
        delBg.type = "button";
        delBg.addEventListener("click", () => {
          line.backgrounds.splice(bgIdx, 1);
          this.renderStepContent(this.bodyEl);
        });

        bgRow.append(bgTag, bgInput, delBg);
        bgContainer.appendChild(bgRow);
      });
      card.appendChild(bgContainer);
    }

    return card;
  },
};
