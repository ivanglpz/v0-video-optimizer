import VideoOptimizer from "@/components/video-optimizer";

export default function Home() {
  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Video Optimizer
          </h1>
          <p className="mt-2 text-muted-foreground">
            Upload and optimize your videos with ffmpeg directly from your
            browser
          </p>
        </div>
        <VideoOptimizer />
      </div>
    </main>
  );
}
