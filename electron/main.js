const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { promisify } = require("util");
const { writeFile, readFile, unlink } = require("fs/promises");
const { tmpdir } = require("os");
const execAsync = promisify(require("child_process").exec);

function createWindow() {
  const win = new BrowserWindow({
    width: 1240,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  const indexHtmlPath = path.join(__dirname, "../out/index.html");
  win.loadFile(indexHtmlPath);
}
ipcMain.handle("optimize-video", async (_, fileBuffer, config) => {
  const timestamp = Date.now();
  const inputPath = path.join(tmpdir(), `input_${timestamp}.mp4`);
  const outputPath = path.join(
    tmpdir(),
    `output_${timestamp}.${config.format}`
  );

  await writeFile(inputPath, fileBuffer);

  let videoFilter = `scale=${config.resolution.replace("x", ":")}`;
  if (config.velocity !== 1.0)
    videoFilter += `,setpts=${(1 / config.velocity).toFixed(2)}*PTS`;

  let ffmpegCommand = `/opt/homebrew/bin/ffmpeg -i "${inputPath}" -vf "${videoFilter}" -c:v ${config.codec} -crf ${config.quality} -r ${config.fps}`;

  if (config.bitrate !== "auto") ffmpegCommand += ` -b:v ${config.bitrate}`;

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

  ffmpegCommand += ` "${outputPath}"`;

  try {
    await execAsync(ffmpegCommand);
  } catch (err) {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    throw new Error("Error ejecutando FFmpeg: " + err.message);
  }

  const output = await readFile(outputPath);
  await unlink(inputPath).catch(() => {});
  await unlink(outputPath).catch(() => {});
  return output;
});

app.whenReady().then(createWindow);
