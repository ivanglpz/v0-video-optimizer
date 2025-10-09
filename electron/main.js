const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // Optional, for security
    },
  });

  win.loadFile(path.join(__dirname, "../out/index.html"));
}

app.whenReady().then(createWindow);
