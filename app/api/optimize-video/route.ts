import { exec } from "child_process";
import { readFile, unlink, writeFile } from "fs/promises";
import { type NextRequest, NextResponse } from "next/server";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File;
    const configStr = formData.get("config") as string;
    const config = JSON.parse(configStr);

    if (!videoFile) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo de video" },
        { status: 400 }
      );
    }

    // Crear nombres de archivo únicos
    const timestamp = Date.now();
    const inputExt = videoFile.name.split(".").pop();
    const inputPath = join(tmpdir(), `input_${timestamp}.${inputExt}`);
    const outputPath = join(tmpdir(), `output_${timestamp}.${config.format}`);

    // Guardar el archivo de entrada
    const bytes = await videoFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(inputPath, buffer);

    console.log("[v0] Processing video with config:", config);

    // Construir el filtro de video con escala y velocidad
    let videoFilter = `scale=${config.resolution.replace("x", ":")}`;

    if (config.velocity !== 1.0) {
      // setpts ajusta la velocidad del video (1/velocity para acelerar o desacelerar)
      videoFilter += `,setpts=${(1 / config.velocity).toFixed(2)}*PTS`;
    }

    let ffmpegCommand = `ffmpeg -i "${inputPath}" -vf ${videoFilter} -c:v ${config.codec} -crf ${config.quality} -r ${config.fps}`;

    if (config.bitrate !== "auto") {
      ffmpegCommand += ` -b:v ${config.bitrate}`;
    }

    if (config.velocity !== 1.0) {
      // atempo ajusta la velocidad del audio (debe estar entre 0.5 y 2.0)
      // Para velocidades fuera de ese rango, encadenamos múltiples filtros atempo
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

    console.log("[v0] Executing ffmpeg command:", ffmpegCommand);

    // Ejecutar ffmpeg
    try {
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      console.log("[v0] ffmpeg stdout:", stdout);
      console.log("[v0] ffmpeg stderr:", stderr);
    } catch (error) {
      console.error("[v0] ffmpeg error:", error);
      // Limpiar archivos temporales
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});

      return NextResponse.json(
        {
          error:
            "Error al procesar el video con ffmpeg. Asegúrate de que ffmpeg esté instalado en tu sistema.",
        },
        { status: 500 }
      );
    }

    // Leer el archivo de salida
    const outputBuffer = await readFile(outputPath);

    // Limpiar archivos temporales
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});

    // Devolver el video optimizado
    return new NextResponse(outputBuffer, {
      headers: {
        "Content-Type": `video/${config.format}`,
        "Content-Disposition": `attachment; filename="optimized_${timestamp}.${config.format}"`,
      },
    });
  } catch (error) {
    console.error("[v0] Error in optimize-video API:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
