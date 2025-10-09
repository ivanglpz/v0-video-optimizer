const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");

const execPromise = promisify(exec);
const isDev = process.env.NODE_ENV === "development";

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    titleBarStyle: "hiddenInset",
    backgroundColor: "#ffffff",
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    // Cargar desde el directorio out con el protocolo file://
    const startUrl = `file://${path.join(__dirname, "../out/index.html")}`;
    mainWindow.loadURL(startUrl);

    // Abre DevTools para debug (quítalo después)
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Maneja la optimización de video (reemplaza tu API route)
ipcMain.handle("optimize-video", async (event, filePath, options) => {
  try {
    console.log("Optimizando video:", filePath, options);

    // Aquí va tu lógica de optimización
    // Por ejemplo, usando ffmpeg:
    // const outputPath = filePath.replace(/\.[^/.]+$/, '_optimized.mp4');
    // const command = `ffmpeg -i "${filePath}" -c:v libx264 -crf ${options.quality || 23} "${outputPath}"`;
    // const { stdout, stderr } = await execPromise(command);

    return {
      success: true,
      message: "Video optimizado correctamente",
      // outputPath: outputPath
    };
  } catch (error) {
    console.error("Error optimizando video:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Maneja el cierre de la aplicación
app.on("before-quit", () => {
  // Limpieza si es necesaria
});
