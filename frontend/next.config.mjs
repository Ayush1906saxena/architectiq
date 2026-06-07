/** @type {import('next').NextConfig} */

// The browser talks to the frontend origin and Next proxies /api/* to the backend,
// so the auth cookie stays first-party (SameSite=Lax "just works"). The proxy
// destination is a SERVER-SIDE var (BACKEND_INTERNAL_URL) — never exposed to the
// client — falling back to NEXT_PUBLIC_API_URL and then localhost for dev.
const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
