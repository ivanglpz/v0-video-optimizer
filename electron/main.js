const { app, BrowserWindow } = require("electron");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { promisify } = require("util");
const { writeFile, readFile, unlink, access, chmod } = require("fs/promises");
const { tmpdir } = require("os");
const { existsSync } = require("fs");
const execAsync = promisify(require("child_process").exec);

const upload = multer({ storage: multer.memoryStorage() });

// Función para obtener la ruta correcta de ffmpeg
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

function getFFmpegPath() {
  // 1. Prioriza ffmpeg del sistema en macOS
  const systemFFmpeg = "/opt/homebrew/bin/ffmpeg";
  if (existsSync(systemFFmpeg)) {
    console.log("✅ Using system ffmpeg:", systemFFmpeg);
    return systemFFmpeg;
  }

  // 2. Si está en modo desarrollo, usa el binario de node_modules
  if (!app.isPackaged) {
    console.log("✅ Using development ffmpeg:", ffmpegInstaller.path);
    return ffmpegInstaller.path;
  }

  // 3. Fallback al binario empaquetado
  const packagedFFmpeg = path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    "node_modules",
    "@ffmpeg-installer",
    "ffmpeg",
    "dist",
    "ffmpeg"
  );
  console.log("✅ Using packaged ffmpeg:", packagedFFmpeg);
  return packagedFFmpeg;
}

// Función para asegurar que ffmpeg tiene permisos de ejecución
async function ensureFFmpegExecutable(ffmpegPath) {
  try {
    await access(ffmpegPath);
    // Dar permisos de ejecución en Unix-like systems
    if (process.platform !== "win32") {
      await chmod(ffmpegPath, 0o755);
    }
    return true;
  } catch (error) {
    console.error("Error al verificar/dar permisos a ffmpeg:", error);
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1240,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  const server = express();
  const port = 3000;

  server.use(express.static(path.join(__dirname, "../out")));

  server.post(
    "/api/optimize-video",
    upload.single("video"),
    async (req, res) => {
      let inputPath = null;
      let outputPath = null;

      try {
        const videoFile = req.file;
        const config = JSON.parse(req.body.config);

        if (!videoFile)
          return res
            .status(400)
            .json({ error: "No se proporcionó ningún archivo de video" });

        // Obtener y verificar la ruta de ffmpeg
        const ffmpegPath = getFFmpegPath();

        if (!ffmpegPath) {
          console.error("FFmpeg path is null or undefined");
          return res.status(500).json({
            error: "FFmpeg no está disponible. Path: " + process.resourcesPath,
          });
        }

        console.log("FFmpeg path:", ffmpegPath);
        console.log("FFmpeg exists:", existsSync(ffmpegPath));

        // Asegurar permisos de ejecución
        const hasPermissions = await ensureFFmpegExecutable(ffmpegPath);
        if (!hasPermissions) {
          return res.status(500).json({
            error: "FFmpeg no tiene permisos de ejecución",
          });
        }

        const timestamp = Date.now();
        const inputExt = videoFile.originalname.split(".").pop();
        inputPath = path.join(tmpdir(), `input_${timestamp}.${inputExt}`);
        outputPath = path.join(
          tmpdir(),
          `output_${timestamp}.${config.format}`
        );

        await writeFile(inputPath, videoFile.buffer);
        console.log("Input file written:", inputPath);

        let videoFilter = `scale=${config.resolution.replace("x", ":")}`;
        if (config.velocity !== 1.0)
          videoFilter += `,setpts=${(1 / config.velocity).toFixed(2)}*PTS`;

        let ffmpegCommand = `"${ffmpegPath}" -i "${inputPath}" -vf "${videoFilter}" -c:v ${config.codec} -crf ${config.quality} -r ${config.fps}`;

        if (config.bitrate !== "auto")
          ffmpegCommand += ` -b:v ${config.bitrate}`;

        if (config.velocity !== 1.0) {
          let audioFilter = "";
          let remainingSpeed = config.velocity;
          while (remainingSpeed > 2.0) {
            audioFilter += audioFilter ? ",atempo=2.0" : "atempo=2.0";
            remainingSpeed /= 2.0;
          }
          while (remainingSpeed < 0.5) {
            audioFilter += audioFilter ? ",atempo=0.5" : "atempo=0.5";
            remainingSpeed /= 0.5;
          }
          audioFilter += audioFilter
            ? `,atempo=${remainingSpeed.toFixed(2)}`
            : `atempo=${remainingSpeed.toFixed(2)}`;
          ffmpegCommand += ` -af "${audioFilter}" -c:a aac -b:a 128k`;
        } else {
          ffmpegCommand += ` -c:a aac -b:a 128k`;
        }

        ffmpegCommand += ` -y "${outputPath}"`;

        console.log("Ejecutando comando FFmpeg:", ffmpegCommand);

        try {
          const { stdout, stderr } = await execAsync(ffmpegCommand, {
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          });
          console.log("ffmpeg completado");
          if (stdout) console.log("ffmpeg stdout:", stdout);
          if (stderr) console.log("ffmpeg stderr:", stderr);
        } catch (error) {
          console.error("❌ ffmpeg error completo:", error);
          console.error("Error message:", error.message);
          console.error("Error stdout:", error.stdout);
          console.error("Error stderr:", error.stderr);
          console.error("Error code:", error.code);

          await unlink(inputPath).catch(() => {});
          await unlink(outputPath).catch(() => {});

          return res.status(500).json({
            error: "Error al procesar el video con ffmpeg",
            details: error.message,
            stderr: error.stderr,
            command: ffmpegCommand,
          });
        }

        // Verificar que el archivo de salida existe
        if (!existsSync(outputPath)) {
          console.error("El archivo de salida no fue creado:", outputPath);
          await unlink(inputPath).catch(() => {});
          return res.status(500).json({
            error: "FFmpeg no generó el archivo de salida",
          });
        }

        const outputBuffer = await readFile(outputPath);
        console.log("Output file size:", outputBuffer.length, "bytes");

        await unlink(inputPath).catch(() => {});
        await unlink(outputPath).catch(() => {});

        res.setHeader("Content-Type", `video/${config.format}`);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="optimized_${timestamp}.${config.format}"`
        );
        res.send(outputBuffer);
      } catch (error) {
        console.error("❌ Error general en /api/optimize-video:", error);
        console.error("Stack trace:", error.stack);

        // Limpiar archivos temporales
        if (inputPath) await unlink(inputPath).catch(() => {});
        if (outputPath) await unlink(outputPath).catch(() => {});

        res.status(500).json({
          error: "Error interno del servidor",
          details: error.message,
        });
      }
    }
  );

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log("App is packaged:", app.isPackaged);
    console.log("Resources path:", process.resourcesPath);
    console.log("App path:", app.getAppPath());

    win.loadURL(`http://localhost:${port}`);
    win.webContents.openDevTools();
  });
}

app.whenReady().then(createWindow);
