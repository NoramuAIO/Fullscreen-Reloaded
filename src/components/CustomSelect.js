/**
 * Custom Liquid Glass Select Dropdown component.
 * Replaces ugly native HTML <select> popups with Apple TV / visionOS frosted glass styling.
 */
import { el } from "../utils/dom.js";

// Global document click listener to close all dropdowns when clicking outside
let initializedGlobalListener = false;
const activeSelects = new Set();

function initGlobalListener() {
  if (initializedGlobalListener) return;
  initializedGlobalListener = true;

  document.addEventListener("click", (e) => {
    for (const closeMenu of activeSelects) {
      closeMenu(e);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      for (const closeMenu of activeSelects) {
        closeMenu(null, true);
      }
    }
  });
}

/**
 * Creates a custom dropdown element.
 * @param {Object} config
 * @param {Array<{value: string, label: string}>} config.options
 * @param {string} config.value
 * @param {(val: string) => void} config.onChange
 * @returns {HTMLElement}
 */
export function createCustomSelect({ options, value, onChange }) {
  initGlobalListener();

  const wrap = el("div", "fr-select-wrap");
  let currentValue = value;

  // Selected label lookup (prefers shortLabel for the compact trigger button)
  const getButtonLabel = (v) => {
    const found = options.find((o) => o.value === v);
    return found ? found.shortLabel || found.label : v;
  };

  // Button trigger
  const btn = document.createElement("button");
  btn.setAttribute("type", "button");
  btn.className = "fr-select-btn";

  const labelSpan = el("span", "fr-select-label", getButtonLabel(currentValue));
  const arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  arrowSvg.setAttribute("class", "fr-select-arrow");
  arrowSvg.setAttribute("viewBox", "0 0 24 24");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z");
  arrowSvg.appendChild(path);

  btn.append(labelSpan, arrowSvg);

  // Menu popup
  const menu = el("div", "fr-select-menu");

  const close = (e, force = false) => {
    if (force || (e && !wrap.contains(e.target))) {
      wrap.classList.remove("fr-open");
    }
  };
  activeSelects.add(close);

  // Render items
  const renderItems = () => {
    menu.innerHTML = "";
    options.forEach((opt) => {
      const isSelected = opt.value === currentValue;
      const item = el("div", "fr-select-item" + (isSelected ? " fr-selected" : ""));

      const leftCol = el("div", "fr-select-item-left");
      const text = el("span", "fr-select-item-title", opt.label);
      leftCol.appendChild(text);
      if (opt.sublabel) {
        leftCol.appendChild(el("span", "fr-select-item-sub", opt.sublabel));
      }

      const rightCol = el("div", "fr-select-item-right");
      if (opt.badge) {
        rightCol.appendChild(el("span", "fr-select-item-badge", opt.badge));
      }

      // Checkmark icon
      const checkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      checkSvg.setAttribute("class", "fr-check");
      checkSvg.setAttribute("viewBox", "0 0 24 24");
      const checkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      checkPath.setAttribute("d", "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z");
      checkSvg.appendChild(checkPath);
      rightCol.appendChild(checkSvg);

      item.append(leftCol, rightCol);

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        currentValue = opt.value;
        labelSpan.textContent = getButtonLabel(opt.value);
        wrap.classList.remove("fr-open");
        renderItems();
        if (onChange) onChange(opt.value);
      });

      menu.appendChild(item);
    });
  };

  renderItems();

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !wrap.classList.contains("fr-open");
    // Close other open selects
    for (const closeOther of activeSelects) {
      closeOther(null, true);
    }
    if (willOpen) {
      wrap.classList.add("fr-open");
    }
  });

  wrap.append(btn, menu);

  // Method to programmatically set value
  wrap.setValue = (newVal) => {
    currentValue = newVal;
    labelSpan.textContent = getButtonLabel(newVal);
    renderItems();
  };

  return wrap;
}
