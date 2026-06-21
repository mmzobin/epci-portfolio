/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "127.0.0.1:3000"]
    }
  }
};

export default nextConfig;
