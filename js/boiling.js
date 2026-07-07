"use strict";
/* ============================================================
   "Boiling" sketchy-redraw wordmark — vanilla canvas reimplementation
   of css/Vendors/Boiling (which used React + roughjs + esm.sh CDN
   imports; not usable here per house rules: no frameworks, no build
   step, no external network calls). Same visual idea — a hand-drawn
   line redrawn with tiny random jitter every ~150ms — done with plain
   Canvas2D strokes instead of roughjs.
   ============================================================ */

function initBoilingBrand() {
  const canvas = $("brand-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 132;
  const cssH = canvas.clientHeight || 40;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;

  const text = canvas.getAttribute("aria-label") || "Botivo";
  const passes = 3;
  const jitter = 1.1;
  let lastDraw = 0;
  let raf = null;

  function strokeColor() {
    return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#d97a06";
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.font = "italic 700 30px 'Segoe Script', 'Bickham Script MT', 'Brush Script MT', cursive, 'Segoe UI Variable', sans-serif";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = strokeColor();
    ctx.lineWidth = 1.3;

    const y = cssH / 2;
    for (let p = 0; p < passes; p++) {
      const dx = (Math.random() - 0.5) * jitter;
      const dy = (Math.random() - 0.5) * jitter;
      ctx.save();
      ctx.translate(dx, y + dy);
      ctx.globalAlpha = 0.55;
      ctx.strokeText(text, 0, 0);
      ctx.restore();
    }
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (t - lastDraw < 150) return;
    lastDraw = t;
    draw();
  }
  raf = requestAnimationFrame(loop);

  window.addEventListener("beforeunload", () => cancelAnimationFrame(raf));
}
