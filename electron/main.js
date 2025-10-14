import { exec } from "child_process";
import { app, BrowserWindow, ipcMain } from "electron";
import { readFile, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

const buildAudioFilter = (velocity) => {
  if (velocity === 1.0) return "";

  const buildSteps = (factor, limit) =>
    Array.from(
      { length: Math.floor(Math.log(velocity) / Math.log(factor)) },
      () => `atempo=${factor.toFixed(1)}`
    );

  const higherSteps = velocity > 2.0 ? buildSteps(2.0, velocity) : [];
  const lowerSteps = velocity < 0.5 ? buildSteps(0.5, 1 / velocity) : [];
  const remaining =
    velocity > 2.0
      ? velocity / Math.pow(2.0, higherSteps.length)
      : velocity < 0.5
      ? velocity / Math.pow(0.5, lowerSteps.length)
      : velocity;

  const remainingFilter =
    remaining !== 1.0 ? [`atempo=${remaining.toFixed(2)}`] : [];

  return [...higherSteps, ...lowerSteps, ...remainingFilter].join(",");
};

const buildFFmpegCommand = (inputPath, outputPath, config) => {
  const baseVideoFilter = `scale=${config.resolution.replace("x", ":")}`;
  const speedVideoFilter =
    config.velocity !== 1.0
      ? `,setpts=${(1 / config.velocity).toFixed(2)}*PTS`
      : "";

  const videoFilter = `${baseVideoFilter}${speedVideoFilter}`;
  const audioFilter = buildAudioFilter(config.velocity);

  const baseCommand = [
    `/opt/homebrew/bin/ffmpeg`,
    `-i "${inputPath}"`,
    `-vf "${videoFilter}"`,
    `-c:v ${config.codec}`,
    `-crf ${config.quality}`,
    `-r ${config.fps}`,
  ];

  const bitrateCommand =
    config.bitrate !== "auto" ? [`-b:v ${config.bitrate}`] : [];

  const audioCommand =
    audioFilter !== ""
      ? [`-af "${audioFilter}"`, `-c:a aac`, `-b:a 128k`]
      : [`-c:a aac`, `-b:a 128k`];

  return [
    ...baseCommand,
    ...bitrateCommand,
    ...audioCommand,
    `"${outputPath}"`,
  ].join(" ");
};

const processVideo = async (fileBuffer, config) => {
  const timestamp = Date.now();
  const inputPath = path.join(tmpdir(), `input_${timestamp}.mp4`);
  const outputPath = path.join(
    tmpdir(),
    `output_${timestamp}.${config.format}`
  );

  await writeFile(inputPath, fileBuffer);
  const command = buildFFmpegCommand(inputPath, outputPath, config);

  try {
    await execAsync(command);
    const output = await readFile(outputPath);
    await Promise.all([unlink(inputPath), unlink(outputPath)]);
    return output;
  } catch (error) {
    await Promise.allSettled([unlink(inputPath), unlink(outputPath)]);
    throw new Error(`Error ejecutando FFmpeg: ${error.message}`);
  }
};

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1240,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: true,
    },
  });

  const indexHtmlPath = path.join(__dirname, "../out/index.html");
  win.loadFile(indexHtmlPath);
};

ipcMain.handle("optimize-video", (_, fileBuffer, config) =>
  processVideo(fileBuffer, config)
);

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
