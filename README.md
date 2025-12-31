# Video Optimizer

## Overview

Video Optimizer is a desktop and web-based application built with Next.js, React, and Electron that allows users to optimize video files using FFmpeg through a graphical interface. The application focuses on providing a clear, deterministic pipeline for video processing while exposing commonly used FFmpeg parameters in a controlled and user-friendly way.

The project combines a static Next.js frontend with an Electron shell, enabling local video processing without uploading files to external servers.

---

## Core Goals

- Provide a simple UI for video optimization tasks.
- Expose FFmpeg configuration in a safe, constrained manner.
- Perform all video processing locally.
- Maintain a clear separation between UI, orchestration, and processing logic.

---

## Architecture

The application is composed of four main layers:

1. **UI Layer (React + Next.js)**
2. **Application Shell (Electron)**
3. **IPC Bridge (Preload Layer)**
4. **Processing Layer (FFmpeg Execution)**

### High-Level Flow

1. The user selects a video file and optimization settings in the UI.
2. The frontend sends the raw video buffer and configuration to Electron via IPC.
3. Electron writes the file to a temporary directory and executes FFmpeg.
4. The optimized video is returned as a buffer.
5. The frontend triggers a download of the processed file.

All operations occur locally on the user’s machine.

---

## Frontend

### Technology Stack

- Next.js (App Router)
- React (Client Components)
- Tailwind CSS
- Radix UI primitives

### Main Components

- `VideoOptimizer`
  - Handles file input, drag-and-drop, and user configuration.
  - Manages processing state (`idle`, `processing`, `success`, `error`).
  - Generates a preview of the FFmpeg command based on the current configuration.

- UI Components (`components/ui`)
  - Reusable, composable primitives such as `Button`, `Select`, `Slider`, `Card`, and `Alert`.
  - Styled with Tailwind and controlled via class-variance-authority.

### State Management

- Local React state is used for:
  - Selected file
  - Video configuration
  - Processing status and errors

No global state or external state libraries are required for this scope.

---

## Video Configuration Model

The video processing pipeline is driven by a single configuration object:

- `resolution`: Output resolution (e.g. `1920x1080`)
- `codec`: Video codec (`libx264`, `libx265`, `vp9`, `av1`)
- `quality`: CRF value (0–51)
- `format`: Output container format (`mp4`, `webm`, `mkv`, etc.)
- `fps`: Frames per second
- `bitrate`: Target bitrate or automatic
- `velocity`: Playback speed multiplier

This configuration is shared between the frontend and the processing layer.

---

## Electron Integration

### Electron Main Process

- Creates a desktop window that loads the statically exported Next.js app.
- Registers an IPC handler (`optimize-video`).
- Orchestrates file system access and FFmpeg execution.

### Preload Script

The preload layer exposes a minimal API to the renderer:

- `optimizeVideo(fileBuffer, config)`

This design ensures:

- Context isolation remains enabled.
- The renderer never accesses Node.js APIs directly.

---

## FFmpeg Processing

### Command Construction

The FFmpeg command is generated dynamically based on user input:

- Video scaling is applied using `scale=width:height`.
- Playback speed is adjusted using:
  - `setpts` for video
  - Chained `atempo` filters for audio
- Codec, CRF, FPS, and bitrate are applied explicitly.

### Audio Speed Handling

Because FFmpeg’s `atempo` filter only supports values between `0.5` and `2.0`, the application:

- Decomposes extreme speed values into multiple chained filters.
- Ensures audio remains synchronized with video.

### Temporary Files

- Input and output files are written to the OS temporary directory.
- Files are removed after processing, regardless of success or failure.

---

## API Route (Optional Web Mode)

The repository also includes a Next.js API route for video optimization:

- `POST /api/optimize-video`

This route:

- Accepts multipart form data.
- Executes FFmpeg on the server.
- Returns the optimized video as a binary response.

This is useful for non-Electron deployments but is not required for the desktop build.

---

## Build and Run

### Development

```bash
npm install
npm run dev
npm run electron
```

### Production Build

```bash
npm run electron:build
```

This generates a distributable desktop application using `electron-builder`.

---

## Security Considerations

- No user data is uploaded to external servers.
- IPC surface is minimal and explicit.
- File system access is limited to temporary files.

---

## Project Status

This project is functional and stable, serving as a reference implementation for:

- FFmpeg integration in Electron
- Static Next.js + Electron workflows
- Deterministic media processing pipelines

Future improvements may include progress reporting from FFmpeg, batch processing, and preset management.

---

## License

Open source. Attribution to the original author is required.

