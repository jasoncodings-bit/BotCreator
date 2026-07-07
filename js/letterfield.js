"use strict";
/* ============================================================
   Idle ambient letter-grid background for the boot loader,
   reimplemented from css/Vendors/Letters/Letters.js (vanilla canvas,
   no Tweakpane/wtc-math/esm.sh imports — see house rules). Tiles the
   letter "B", cycling slowly through Ripple/Gradient/Wave patterns.
   Colors interpolate between --accent-hover and --accent only — the
   same two stops the boot spinner's own SVG gradient uses — so the
   background reads as part of the same loader. No mouse interaction —
   purely idle.
   ============================================================ */

const LETTERFIELD_CHAR = ".";
const LETTERFIELD_FONT_SIZE = 34;
const LETTERFIELD_GAP = 60;
const LETTERFIELD_CYCLE_MS = 20000; // one full pass through all 3 patterns
const LETTERFIELD_TIME_SCALE = 0.35; // slow, idle pace
const LETTERFIELD_PATTERNS = ["Ripple", "Gradient", "Wave"];

let lfCanvas = null;
let lfCtx = null;
let lfGridItems = [];
let lfDims = { x: 0, y: 0 };
let lfHDims = { x: 0, y: 0 };
let lfRaf = null;
let lfLastFrame = 0;
let lfDpr = 1;

function lfLerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

function lfHexToRgb(hex) {
  const h = hex.replace("#", "").trim();
  const n = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const int = parseInt(n, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function lfThemeColors() {
  const cs = getComputedStyle(document.documentElement);
  const from = cs.getPropertyValue("--accent-hover").trim() || "#ffb266";
  const to = cs.getPropertyValue("--accent").trim() || "#ff9f40";
  try {
    return [lfHexToRgb(from), lfHexToRgb(to)];
  } catch {
    return [[255, 178, 102], [255, 159, 64]];
  }
}

function initLetterfield() {
  lfCanvas = $("letterfield");
  if (!lfCanvas) return;
  lfCtx = lfCanvas.getContext("2d");

  lfDims = { x: window.innerWidth, y: window.innerHeight };
  lfHDims = { x: lfDims.x / 2, y: lfDims.y / 2 };

  lfDpr = window.devicePixelRatio || 1;
  lfCanvas.width = lfDims.x * lfDpr;
  lfCanvas.height = lfDims.y * lfDpr;
  lfCtx.setTransform(lfDpr, 0, 0, lfDpr, 0, 0);
  lfCtx.font = `900 ${LETTERFIELD_FONT_SIZE}px "Segoe UI Variable", "Segoe UI", system-ui, sans-serif`;
  lfCtx.textAlign = "center";
  lfCtx.textBaseline = "middle";

  const cols = Math.ceil(lfDims.x / LETTERFIELD_GAP) + 1;
  const rows = Math.ceil(lfDims.y / LETTERFIELD_GAP) + 1;

  lfGridItems = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      lfGridItems.push({
        x: col * LETTERFIELD_GAP + LETTERFIELD_GAP / 2,
        y: row * LETTERFIELD_GAP + LETTERFIELD_GAP / 2,
      });
    }
  }
}

function lfStateVal(pattern, item, time) {
  const dx = item.x - lfHDims.x;
  const dy = item.y - lfHDims.y;
  if (pattern === "Wave") {
    return (dy + Math.cos(dx * 0.002 + time * 0.0015) * 150) * 0.004 + 0.5;
  } else if (pattern === "Gradient") {
    const angle = time * 0.0003;
    const v = (Math.cos(angle) * item.x + Math.sin(angle) * item.y) * 0.002;
    return Math.cos(v * 2) * 0.5 + 0.5;
  }
  // Ripple
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.sin(dist * 0.01 - time * 0.0025) * 0.5 + 0.5;
}

function lfAnimate(time) {
  lfRaf = requestAnimationFrame(lfAnimate);
  const scaled = time * LETTERFIELD_TIME_SCALE;
  if (scaled - lfLastFrame < 80) return; // throttle redraws
  lfLastFrame = scaled;
  if (!lfCtx) return;

  const progress = (scaled % LETTERFIELD_CYCLE_MS) / (LETTERFIELD_CYCLE_MS / LETTERFIELD_PATTERNS.length);
  const pattern = LETTERFIELD_PATTERNS[Math.floor(progress) % LETTERFIELD_PATTERNS.length];
  const [from, to] = lfThemeColors();

  lfCtx.clearRect(0, 0, lfDims.x, lfDims.y);
  for (const item of lfGridItems) {
    const val = Math.min(1, Math.max(0, lfStateVal(pattern, item, scaled)));
    const [r, g, b] = lfLerpColor(from, to, val);
    lfCtx.fillStyle = `rgba(${r},${g},${b},${(0.08 + val * 0.18).toFixed(3)})`;
    lfCtx.fillText(LETTERFIELD_CHAR, item.x, item.y);
  }
}

function startLetterfield() {
  if (!$("letterfield")) return;
  initLetterfield();
  lfRaf = requestAnimationFrame(lfAnimate);
}

function stopLetterfield() {
  if (lfRaf) cancelAnimationFrame(lfRaf);
  lfRaf = null;
  lfCtx = null;
}
