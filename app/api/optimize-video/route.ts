import { exec } from "child_process";
import { readFile, unlink, writeFile } from "fs/promises";
import { type NextRequest, NextResponse } from "next/server";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

type VideoConfig = {
  format: string;
  resolution: string;
  velocity: number;
  codec: string;
  quality: number;
  fps: number;
  bitrate: string;
};

const buildAudioFilter = (velocity: number): string => {
  if (velocity === 1.0) return "";

  const buildSteps = (factor: number) =>
    Array.from(
      { length: Math.floor(Math.log(velocity) / Math.log(factor)) },
      () => `atempo=${factor.toFixed(1)}`
    );

  const higherSteps = velocity > 2.0 ? buildSteps(2.0) : [];
  const lowerSteps = velocity < 0.5 ? buildSteps(0.5) : [];
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

const buildFFmpegCommand = (
  inputPath: string,
  outputPath: string,
  config: VideoConfig
): string => {
  const baseVideoFilter = `scale=${config.resolution.replace("x", ":")}`;
  const speedVideoFilter =
    config.velocity !== 1.0
      ? `,setpts=${(1 / config.velocity).toFixed(2)}*PTS`
      : "";

  const videoFilter = `${baseVideoFilter}${speedVideoFilter}`;
  const audioFilter = buildAudioFilter(config.velocity);

  const baseCommand = [
    `ffmpeg`,
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

const processVideo = async (
  buffer: Buffer,
  inputExt: string,
  config: VideoConfig
): Promise<Buffer> => {
  const timestamp = Date.now();
  const inputPath = join(tmpdir(), `input_${timestamp}.${inputExt}`);
  const outputPath = join(tmpdir(), `output_${timestamp}.${config.format}`);

  await writeFile(inputPath, buffer);
  const command = buildFFmpegCommand(inputPath, outputPath, config);

  try {
    await execAsync(command);
    const output = await readFile(outputPath);
    await Promise.all([unlink(inputPath), unlink(outputPath)]);
    return output;
  } catch (error: any) {
    await Promise.allSettled([unlink(inputPath), unlink(outputPath)]);
    throw new Error(`Error ejecutando FFmpeg: ${error.message}`);
  }
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File | null;
    const configStr = formData.get("config") as string | null;

    if (!videoFile || !configStr) {
      return NextResponse.json(
        { error: "Archivo de video o configuración no proporcionados" },
        { status: 400 }
      );
    }

    const config: VideoConfig = JSON.parse(configStr);
    const inputExt = videoFile.name.split(".").pop() ?? "mp4";

    const bytes = await videoFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const outputBuffer = await processVideo(buffer, inputExt, config);

    return new NextResponse(outputBuffer as BodyInit, {
      headers: {
        "Content-Type": `video/${config.format}`,
        "Content-Disposition": `attachment; filename="optimized_${Date.now()}.${
          config.format
        }"`,
      },
    });
  } catch (error) {
    console.error("[optimize-video] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
