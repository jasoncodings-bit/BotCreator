"use strict";
/* ============================================================
   Themed confirm dialog — replaces window.confirm() everywhere
   so destructive actions match the app's own look instead of
   popping the OS-native dialog. Returns a Promise<boolean>,
   so call sites need `if (!await appConfirm(...)) return;`.
   ============================================================ */

let _confirmResolve = null;

function appConfirm(message, opts) {
  opts = opts || {};
  $("confirm-title").textContent = opts.title || "Are you sure?";
  $("confirm-message").textContent = message;
  $("confirm-ok-btn").textContent = opts.okLabel || "Delete";
  $("confirm-modal").classList.add("open");
  $("confirm-cancel-btn").focus();

  return new Promise(resolve => {
    _confirmResolve = resolve;
  });
}

function _settleConfirm(result) {
  $("confirm-modal").classList.remove("open");
  if (_confirmResolve) {
    const resolve = _confirmResolve;
    _confirmResolve = null;
    resolve(result);
  }
}

function wireConfirmModal() {
  $("confirm-ok-btn").onclick = () => _settleConfirm(true);
  $("confirm-cancel-btn").onclick = () => _settleConfirm(false);
  $("confirm-modal").addEventListener("mousedown", e => {
    if (e.target === $("confirm-modal")) _settleConfirm(false);
  });
}
