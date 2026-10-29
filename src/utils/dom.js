/**
 * DOM utility helpers for creating and manipulating elements.
 */

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

export function iconBtn(svg, onClick, extraClass) {
  const btn = document.createElement("button");
  btn.className = "fr-btn" + (extraClass ? " " + extraClass : "");
  btn.innerHTML = svg;
  btn.setAttribute("type", "button");
  if (onClick) {
    btn.addEventListener("click", onClick);
  }
  return btn;
}

export function toggle(initial, onChange) {
  const btn = document.createElement("button");
  btn.setAttribute("type", "button");
  btn.className = "fr-toggle" + (initial ? " fr-on" : "");
  btn.addEventListener("click", () => {
    const next = !btn.classList.contains("fr-on");
    btn.classList.toggle("fr-on", next);
    if (onChange) onChange(next);
  });
  return btn;
}
