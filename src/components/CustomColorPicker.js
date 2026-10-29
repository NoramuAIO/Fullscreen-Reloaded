/**
 * Custom Liquid Glass Color Picker component.
 * Replaces ugly native OS color popups with Apple TV / visionOS aesthetic presets,
 * an interactive rainbow hue slider, hex input, and native color wheel trigger.
 */
import { el } from "../utils/dom.js";

// Vibrant & distinguishable presets + elegant atmospheric darks
const VIBRANT_PRESETS = [
  { name: "Spotify Green", hex: "#1ed760" },
  { name: "Cyan Sky", hex: "#06b6d4" },
  { name: "Electric Blue", hex: "#3b82f6" },
  { name: "Royal Violet", hex: "#8b5cf6" },
  { name: "Neon Fuchsia", hex: "#d946ef" },
  { name: "Coral Red", hex: "#ef4444" },
  { name: "Sunset Orange", hex: "#f97316" },
  { name: "Warm Amber", hex: "#f59e0b" },
];

const DARK_PRESETS = [
  { name: "OLED Siyah", hex: "#000000" },
  { name: "Gece Mavisi", hex: "#0f172a" },
  { name: "Derin İndigo", hex: "#1e1b4b" },
  { name: "Koyu Mürdüm", hex: "#3b0764" },
  { name: "Bordo Noir", hex: "#450a0a" },
  { name: "Zümrüt Gece", hex: "#064e3b" },
  { name: "Duman Grisi", hex: "#1e293b" },
  { name: "Saf Beyaz", hex: "#ffffff" },
];

let initializedGlobalColorListener = false;
const activeColorPickers = new Set();

function initGlobalListener() {
  if (initializedGlobalColorListener) return;
  initializedGlobalColorListener = true;

  document.addEventListener("click", (e) => {
    for (const close of activeColorPickers) {
      close(e);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      for (const close of activeColorPickers) {
        close(null, true);
      }
    }
  });
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex) {
  let c = (hex || "#101014").replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  if (c.length !== 6) return { h: 0, s: 70, l: 50 };

  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h = Math.round(h * 60);
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Creates a custom Liquid Glass Color Picker element.
 * @param {Object} config
 * @param {string} config.value Initial hex color (e.g. "#1ed760")
 * @param {(hex: string) => void} config.onChange Callback on color change
 * @returns {HTMLElement}
 */
export function createCustomColorPicker({ value = "#101014", onChange }) {
  initGlobalListener();

  const wrap = el("div", "fr-color-picker-wrap");
  let currentColor = (value || "#101014").toLowerCase();
  if (!currentColor.startsWith("#")) currentColor = "#" + currentColor;

  // Swatch trigger button
  const triggerBtn = document.createElement("button");
  triggerBtn.setAttribute("type", "button");
  triggerBtn.className = "fr-color-swatch-btn";

  const swatchInner = el("span", "fr-color-swatch-inner");
  swatchInner.style.backgroundColor = currentColor;

  const hexLabel = el("span", "fr-color-hex-label", currentColor.toUpperCase());

  triggerBtn.append(swatchInner, hexLabel);

  // Popup dialog
  const popup = el("div", "fr-color-popup");

  const close = (e, force = false) => {
    if (force || (e && !wrap.contains(e.target))) {
      wrap.classList.remove("fr-open");
    }
  };
  activeColorPickers.add(close);

  // Preset container
  const createPresetGroup = (titleText, presets) => {
    const title = el("div", "fr-color-popup-title", titleText);
    const grid = el("div", "fr-color-preset-grid");

    presets.forEach((p) => {
      const item = el("button", "fr-color-preset-item");
      item.setAttribute("type", "button");
      item.setAttribute("title", p.name);
      item.setAttribute("data-hex", p.hex);
      item.style.backgroundColor = p.hex;

      // Checkmark icon
      const checkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      checkSvg.setAttribute("class", "fr-check-sm");
      checkSvg.setAttribute("viewBox", "0 0 24 24");
      const checkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      checkPath.setAttribute("d", "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z");
      checkSvg.appendChild(checkPath);
      item.appendChild(checkSvg);

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        setColor(p.hex);
      });

      grid.appendChild(item);
    });

    return [title, grid];
  };

  const [vibrantTitle, vibrantGrid] = createPresetGroup("Canlı Renkler", VIBRANT_PRESETS);
  const [darkTitle, darkGrid] = createPresetGroup("Koyu & Zarif", DARK_PRESETS);

  popup.append(vibrantTitle, vibrantGrid, darkTitle, darkGrid);

  // Rainbow Hue Slider
  const sliderWrap = el("div", "fr-hue-slider-wrap");
  const sliderTitle = el("div", "fr-color-popup-title", "Renk Skalası");
  const hueSlider = document.createElement("input");
  hueSlider.type = "range";
  hueSlider.min = "0";
  hueSlider.max = "360";
  hueSlider.value = String(hexToHsl(currentColor).h);
  hueSlider.className = "fr-hue-slider";

  hueSlider.addEventListener("input", (e) => {
    const h = parseInt(e.target.value, 10);
    const currentHsl = hexToHsl(currentColor);
    const s = currentHsl.s < 20 ? 80 : currentHsl.s;
    const l = currentHsl.l < 15 || currentHsl.l > 85 ? 50 : currentHsl.l;
    setColor(hslToHex(h, s, l), false);
  });

  sliderWrap.append(sliderTitle, hueSlider);
  popup.appendChild(sliderWrap);

  // Custom Hex Input row with hidden native color picker trigger
  const hexRow = el("div", "fr-color-custom-row");

  const previewBtn = el("button", "fr-color-wheel-btn");
  previewBtn.setAttribute("type", "button");
  previewBtn.setAttribute("title", "Renk Çarkı / Damlalık Aç");

  const preview = el("span", "fr-color-preview-circle");
  preview.style.backgroundColor = currentColor;

  const nativePicker = document.createElement("input");
  nativePicker.type = "color";
  nativePicker.className = "fr-hidden-native-picker";
  nativePicker.value = currentColor;
  nativePicker.style.display = "none";

  previewBtn.appendChild(preview);

  previewBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    nativePicker.click();
  });

  nativePicker.addEventListener("input", (e) => {
    setColor(e.target.value);
  });

  const hexInput = document.createElement("input");
  hexInput.type = "text";
  hexInput.className = "fr-color-text-input";
  hexInput.maxLength = 7;
  hexInput.value = currentColor.toUpperCase();

  hexInput.addEventListener("input", (e) => {
    let val = e.target.value.trim();
    if (!val.startsWith("#")) val = "#" + val;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setColor(val, false);
    }
  });

  hexRow.append(previewBtn, nativePicker, hexInput);
  popup.appendChild(hexRow);

  const updateSwatches = () => {
    swatchInner.style.backgroundColor = currentColor;
    hexLabel.textContent = currentColor.toUpperCase();
    preview.style.backgroundColor = currentColor;
    nativePicker.value = currentColor;

    if (document.activeElement !== hexInput) {
      hexInput.value = currentColor.toUpperCase();
    }
    if (document.activeElement !== hueSlider) {
      hueSlider.value = String(hexToHsl(currentColor).h);
    }

    popup.querySelectorAll(".fr-color-preset-item").forEach((item) => {
      const itemHex = item.getAttribute("data-hex");
      const isSelected = itemHex.toLowerCase() === currentColor.toLowerCase();
      item.classList.toggle("fr-selected", isSelected);
    });
  };

  const setColor = (hex, updateSlider = true) => {
    currentColor = hex.toLowerCase();
    updateSwatches();
    if (onChange) onChange(currentColor);
  };

  // Toggle popup on click
  triggerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !wrap.classList.contains("fr-open");
    for (const other of activeColorPickers) {
      other(null, true);
    }
    if (willOpen) {
      wrap.classList.add("fr-open");
      updateSwatches();
    }
  });

  wrap.append(triggerBtn, popup);

  return wrap;
}
