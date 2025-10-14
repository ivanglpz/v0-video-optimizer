// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  optimizeVideo: (fileBuffer, config) => {
    // Convertir ArrayBuffer a Buffer de Node.js
    const buffer = Buffer.from(fileBuffer);
    return ipcRenderer.invoke("optimize-video", buffer, config);
  },
});
