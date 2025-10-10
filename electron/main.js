const { app, BrowserWindow } = require("electron");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const { promisify } = require("util");
const { writeFile, readFile, unlink } = require("fs/promises");
const { tmpdir } = require("os");

const execAsync = promisify(exec);
const upload = multer({ storage: multer.memoryStorage() }); // almacenar archivos en memoria

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

  // Endpoint de optimización de video
  server.post(
    "/api/optimize-video",
    upload.single("video"),
    async (req, res) => {
      try {
        const videoFile = req.file;
        const configStr = req.body.config;
        const config = JSON.parse(configStr);

        if (!videoFile) {
          return res
            .status(400)
            .json({ error: "No se proporcionó ningún archivo de video" });
        }

        const timestamp = Date.now();
        const inputExt = videoFile.originalname.split(".").pop();
        const inputPath = path.join(tmpdir(), `input_${timestamp}.${inputExt}`);
        const outputPath = path.join(
          tmpdir(),
          `output_${timestamp}.${config.format}`
        );

        await writeFile(inputPath, videoFile.buffer);

        let videoFilter = `scale=${config.resolution.replace("x", ":")}`;

        if (config.velocity !== 1.0) {
          videoFilter += `,setpts=${(1 / config.velocity).toFixed(2)}*PTS`;
        }

        let ffmpegCommand = `ffmpeg -i "${inputPath}" -vf ${videoFilter} -c:v ${config.codec} -crf ${config.quality} -r ${config.fps}`;

        if (config.bitrate !== "auto") {
          ffmpegCommand += ` -b:v ${config.bitrate}`;
        }

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

          ffmpegCommand += ` -af ${audioFilter} -c:a aac -b:a 128k`;
        } else {
          ffmpegCommand += ` -c:a aac -b:a 128k`;
        }

        ffmpegCommand += ` "${outputPath}"`;

        try {
          const { stdout, stderr } = await execAsync(ffmpegCommand);
          console.log("ffmpeg stdout:", stdout);
          console.log("ffmpeg stderr:", stderr);
        } catch (error) {
          console.error("ffmpeg error:", error);
          await unlink(inputPath).catch(() => {});
          await unlink(outputPath).catch(() => {});
          return res.status(500).json({
            error:
              "Error al procesar el video con ffmpeg. Asegúrate de que ffmpeg esté instalado.",
          });
        }

        const outputBuffer = await readFile(outputPath);
        await unlink(inputPath).catch(() => {});
        await unlink(outputPath).catch(() => {});

        res.setHeader("Content-Type", `video/${config.format}`);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="optimized_${timestamp}.${config.format}"`
        );
        res.send(outputBuffer);
      } catch (error) {
        console.error("Error en /api/optimize-video:", error);
        res.status(500).json({ error: "Error interno del servidor" });
      }
    }
  );

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    win.loadURL(`http://localhost:${port}`);
  });
}

app.whenReady().then(createWindow);
