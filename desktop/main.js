"use strict";
/* ============================================================
   Botivo desktop wrapper (Electron main process).

   This is ONLY a thin shell around the existing static web app
   in the repo root — it loads ../index.html into a browser
   window. The app itself has no build step and no Electron-
   specific code; it still runs fine served over HTTP or opened
   as file://. This file (and everything in desktop/) is the sole
   Electron-specific surface, kept out of the root so the core
   app stays a pure static site.

   It does NOT start the local model server (llama-server) — that
   is still launched separately (see launch.bat), exactly as when
   running the app in a browser.
   ============================================================ */
const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");
const fs = require("fs");

// in a shipped build there's no reason for end users to open DevTools;
// dev mode (`npm start`) keeps it so we can still debug.
const DEVTOOLS_ALLOWED = !app.isPackaged;

/* Where the static web app lives:
   - dev (`npm start`): the repo root, one level up from desktop/.
   - packaged: electron-builder copies the root into resources/app
     (see extraResources in package.json), reachable via
     process.resourcesPath. */
function appIndexPath() {
  if (app.isPackaged) {
    // the web app is copied in as an extra resource at build time; support
    // both electron-builder ("app/") and @electron/packager ("webapp/") layouts.
    const candidates = [
      path.join(process.resourcesPath, "webapp", "index.html"),
      path.join(process.resourcesPath, "app", "index.html")
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return candidates[0];
  }
  return path.join(__dirname, "..", "index.html");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: "#12151d",
    autoHideMenuBar: true,
    title: "Botivo",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      // the app is trusted local code, but it also renders bot output;
      // it already sandboxes bot HTML in its own opaque-origin iframe.
      // no nodeIntegration / no preload — the UI needs no Node access.
      nodeIntegration: false,
      contextIsolation: true,
      // the app fetches http://127.0.0.1:8081 (the local model server);
      // that is a normal cross-origin fetch from a file:// page, allowed.
      spellcheck: true
    }
  });

  win.loadFile(appIndexPath());

  if (!DEVTOOLS_ALLOWED) {
    // block the built-in DevTools shortcuts (Ctrl+Shift+I / Ctrl+Shift+J /
    // Ctrl+Shift+C / F12) that Electron's default menu registers, plus
    // reload shortcuts, so the shipped app can't be popped open by end users.
    win.webContents.on("before-input-event", (event, input) => {
      const key = (input.key || "").toLowerCase();
      const devCombo = input.control && input.shift && ["i", "j", "c"].includes(key);
      if (devCombo || key === "f12") event.preventDefault();
    });
    // belt-and-braces: if DevTools ever opens anyway, immediately close it.
    win.webContents.on("devtools-opened", () => win.webContents.closeDevTools());
  }

  // open real external links (http/https to elsewhere) in the user's
  // browser, not inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
}

app.whenReady().then(() => {
  // no native menu bar in the shipped app — also removes the default
  // DevTools/reload accelerators. (autoHideMenuBar already hides it visually.)
  if (!DEVTOOLS_ALLOWED) Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
