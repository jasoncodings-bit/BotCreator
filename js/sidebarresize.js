"use strict";
/* ============================================================
   Draggable sidebar resize (desktop only). Drag #sidebar-resize-handle
   to resize #sidebar; width is clamped and persisted to DB.settings.
   ============================================================ */

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 480;

function applySidebarWidth() {
  const w = DB.settings.sidebarWidth || 300;
  document.documentElement.style.setProperty("--sidebar-width", w + "px");
}

function wireSidebarResize() {
  const handle = $("sidebar-resize-handle");
  handle.addEventListener("mousedown", e => {
    e.preventDefault();
    document.body.classList.add("sidebar-resizing");

    const onMove = ev => {
      const w = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, ev.clientX));
      document.documentElement.style.setProperty("--sidebar-width", w + "px");
    };
    const onUp = () => {
      document.body.classList.remove("sidebar-resizing");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const w = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width"), 10);
      DB.settings.sidebarWidth = w || 300;
      DB.saveSettings();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}
