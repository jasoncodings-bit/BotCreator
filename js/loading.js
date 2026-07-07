"use strict";
/* ============================================================
   Boot loader — shows #boot-loader for a minimum duration on
   page load, then fades it out once the app has initialized.
   ============================================================ */

const BOOT_LOADER_MS = 4000;
const BOOT_LOADER_STATUSES = [
  "Waking up the bots…",
  "Connecting locally…",
  "Loading your chats…"
];

function hideBootLoader() {
  const el = $("boot-loader");
  if (!el) return;
  el.classList.add("hide");
  stopLetterfield();
  setTimeout(() => el.remove(), 400);
}

function cycleBootLoaderStatus() {
  const el = $("boot-loader-status");
  if (!el) return;
  const stepMs = BOOT_LOADER_MS / BOOT_LOADER_STATUSES.length;
  let i = 0;
  el.textContent = BOOT_LOADER_STATUSES[i];
  const timer = setInterval(() => {
    i++;
    if (i >= BOOT_LOADER_STATUSES.length) { clearInterval(timer); return; }
    el.textContent = BOOT_LOADER_STATUSES[i];
  }, stepMs);
}

function scheduleBootLoaderHide() {
  startLetterfield();
  cycleBootLoaderStatus();
  setTimeout(hideBootLoader, BOOT_LOADER_MS);
}
