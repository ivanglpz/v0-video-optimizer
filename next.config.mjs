/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  output: "export",
  images: {
    unoptimized: true,
  },
  // IMPORTANTE: sin trailing slash
  trailingSlash: true,
  // Si usas tailwind o CSS modules, asegúrate de esto:
  assetPrefix: "",
};

export default nextConfig;
