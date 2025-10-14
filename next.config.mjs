/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // IMPORTANTE: sin trailing slash
  trailingSlash: false,

  // Si usas tailwind o CSS modules, asegúrate de esto:
  output: "export",
  basePath: "",
  assetPrefix: "./", // Hace que CSS/JS se carguen relativo al index.html
};

export default nextConfig;
