"use client";

import type React from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Settings,
  Upload,
  Video,
} from "lucide-react";
import { useRef, useState } from "react";

interface VideoConfig {
  resolution: string;
  codec: string;
  quality: number;
  format: string;
  fps: string;
  bitrate: string;
  velocity: number;
}

export default function VideoOptimizer() {
  const [file, setFile] = useState<File | null>(null);
  const [config, setConfig] = useState<VideoConfig>({
    resolution: "1920x1080",
    codec: "libx264",
    quality: 25,
    format: "mp4",
    fps: "60",
    bitrate: "auto",
    velocity: 1.0,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith("video/")) {
      setFile(selectedFile);
      setStatus("idle");
      setProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith("video/")) {
      setFile(droppedFile);
      setStatus("idle");
      setProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleOptimize = async () => {
    if (!file) return;

    setIsProcessing(true);
    setStatus("processing");
    setProgress(0);
    setErrorMessage("");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const optimizedBuffer = await window.electronAPI.optimizeVideo(
        arrayBuffer,
        config
      );

      // Descargar el video optimizado
      const url = URL.createObjectURL(
        new Blob([optimizedBuffer], { type: `video/${config.format}` })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `optimized_${file.name.split(".")[0]}.${config.format}`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setProgress(100);
      setStatus("success");
    } catch (error) {
      console.error("Error optimizing video:", error);
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Error desconocido"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Upload Section */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Subir Video
          </CardTitle>
          <CardDescription>
            Selecciona o arrastra un archivo de video
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 p-8 transition-colors hover:bg-muted"
          >
            <Video className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">
              {file ? file.name : "Haz clic o arrastra un video aquí"}
            </p>
            {file && (
              <p className="mt-2 text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {status === "processing" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Procesando...</span>
                <span className="font-mono text-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {status === "success" && (
            <Alert className="border-primary/50 bg-primary/10">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                Video optimizado y descargado exitosamente
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {errorMessage || "Error al procesar el video"}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Configuration Section */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración de Optimización
          </CardTitle>
          <CardDescription>
            Ajusta los parámetros de ffmpeg para optimizar tu video
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Resolution */}
            <div className="space-y-2">
              <Label htmlFor="resolution">Resolución</Label>
              <Select
                value={config.resolution}
                onValueChange={(value) =>
                  setConfig({ ...config, resolution: value })
                }
              >
                <SelectTrigger id="resolution">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3840x2160">4K (3840x2160)</SelectItem>
                  <SelectItem value="2560x1440">2K (2560x1440)</SelectItem>
                  <SelectItem value="1920x1080">Full HD (1920x1080)</SelectItem>
                  <SelectItem value="1280x720">HD (1280x720)</SelectItem>
                  <SelectItem value="854x480">SD (854x480)</SelectItem>
                  <SelectItem value="640x360">360p (640x360)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Codec */}
            <div className="space-y-2">
              <Label htmlFor="codec">Codec</Label>
              <Select
                value={config.codec}
                onValueChange={(value) =>
                  setConfig({ ...config, codec: value })
                }
              >
                <SelectTrigger id="codec">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="libx264">H.264 (libx264)</SelectItem>
                  <SelectItem value="libx265">H.265 (libx265)</SelectItem>
                  <SelectItem value="libvpx-vp9">VP9 (libvpx-vp9)</SelectItem>
                  <SelectItem value="libaom-av1">AV1 (libaom-av1)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <Label htmlFor="format">Formato de Salida</Label>
              <Select
                value={config.format}
                onValueChange={(value) =>
                  setConfig({ ...config, format: value })
                }
              >
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp4">MP4</SelectItem>
                  <SelectItem value="webm">WebM</SelectItem>
                  <SelectItem value="mkv">MKV</SelectItem>
                  <SelectItem value="avi">AVI</SelectItem>
                  <SelectItem value="mov">MOV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* FPS */}
            <div className="space-y-2">
              <Label htmlFor="fps">FPS (Cuadros por segundo)</Label>
              <Select
                value={config.fps}
                onValueChange={(value) => setConfig({ ...config, fps: value })}
              >
                <SelectTrigger id="fps">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 fps</SelectItem>
                  <SelectItem value="30">30 fps</SelectItem>
                  <SelectItem value="60">60 fps</SelectItem>
                  <SelectItem value="120">120 fps</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bitrate */}
            <div className="space-y-2">
              <Label htmlFor="bitrate">Bitrate</Label>
              <Select
                value={config.bitrate}
                onValueChange={(value) =>
                  setConfig({ ...config, bitrate: value })
                }
              >
                <SelectTrigger id="bitrate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático</SelectItem>
                  <SelectItem value="500k">500 kbps</SelectItem>
                  <SelectItem value="1M">1 Mbps</SelectItem>
                  <SelectItem value="2M">2 Mbps</SelectItem>
                  <SelectItem value="5M">5 Mbps</SelectItem>
                  <SelectItem value="10M">10 Mbps</SelectItem>
                  <SelectItem value="20M">20 Mbps</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Velocity Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="velocity">Velocidad del Video</Label>
              <span className="font-mono text-sm text-muted-foreground">
                {config.velocity}x
              </span>
            </div>
            <Slider
              id="velocity"
              min={0.25}
              max={4}
              step={0.25}
              value={[config.velocity]}
              onValueChange={(value) =>
                setConfig({ ...config, velocity: value[0] })
              }
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              0.25x = Muy lento, 1.0x = Normal, 4.0x = Muy rápido
            </p>
          </div>

          {/* Quality Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="quality">Calidad (CRF)</Label>
              <span className="font-mono text-sm text-muted-foreground">
                {config.quality}
              </span>
            </div>
            <Slider
              id="quality"
              min={0}
              max={51}
              step={1}
              value={[config.quality]}
              onValueChange={(value) =>
                setConfig({ ...config, quality: value[0] })
              }
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              0 = Sin pérdida, 23 = Recomendado, 51 = Peor calidad
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleOptimize}
              disabled={!file || isProcessing}
              className="flex-1"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Optimizar Video
                </>
              )}
            </Button>
          </div>

          {/* Info Box */}
          <div className="rounded-lg bg-muted p-4">
            <h4 className="mb-2 text-sm font-medium text-foreground">
              Comando ffmpeg generado:
            </h4>
            <code className="block overflow-x-auto text-xs text-muted-foreground font-mono">
              ffmpeg -i input.{file?.name.split(".").pop() || "mp4"} -vf scale=
              {config.resolution.replace("x", ":")}
              {config.velocity !== 1.0
                ? `,setpts=${(1 / config.velocity).toFixed(2)}*PTS`
                : ""}
              -c:v {config.codec} -crf {config.quality} -r {config.fps}{" "}
              {config.bitrate !== "auto" ? `-b:v ${config.bitrate}` : ""}
              {config.velocity !== 1.0 ? `-af atempo=${config.velocity}` : ""}
              output.{config.format}
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
