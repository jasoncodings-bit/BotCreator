"use strict";
/* ============================================================
   Appearance & accessibility settings: text size, compact
   message spacing, accent color, bubble style, high contrast.
   Each setting maps to a data-attribute/class on <html>/<body>
   that css/appearance.css reacts to — no inline styles.
   ============================================================ */

function applyAppearance() {
  const root = document.documentElement;
  root.setAttribute("data-textsize", DB.settings.textSize || "normal");
  root.setAttribute("data-accent", DB.settings.accentColor || "orange");
  document.body.classList.toggle("compact-messages", !!DB.settings.compactMessages);
  document.body.classList.toggle("bubble-rounded", DB.settings.bubbleStyle === "rounded");
  document.body.classList.toggle("high-contrast", !!DB.settings.highContrast);
}
