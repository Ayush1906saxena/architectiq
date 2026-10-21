/** @type {import('next').NextConfig} */
const nextConfig = {
  // A self-contained server in .next/standalone, so the container image carries only what it runs.
  output: "standalone",
  async rewrites() {
    return [
      {
        // Proxy /api/* to the backend so OAuth callbacks work. Inside Docker the server reaches the backend by its
        // service name (API_INTERNAL_URL); the browser uses NEXT_PUBLIC_API_URL.
        source: "/api/:path*",
        destination: `${process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
