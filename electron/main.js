const { app, BrowserWindow } = require("electron");
const path = require("path");
const express = require("express");

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // si lo tienes
    },
  });

  // Servidor Express
  const server = express();
  const port = 3000;

  server.use(express.static(path.join(__dirname, "../out")));

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    // Carga la app de Next export en Electron
    win.loadURL(`http://localhost:${port}`);
  });
}

app.whenReady().then(createWindow);
