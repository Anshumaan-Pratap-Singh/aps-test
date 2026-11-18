import type { NextConfig } from "next";
import path from "node:path";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const apiOrigin = process.env.APS_API_ORIGIN ?? "http://localhost:8000";

// APS_PAGES=1 builds a fully static site for GitHub Pages (no backend, no headers/rewrites).
const pages = !!process.env.APS_PAGES;
const basePath = process.env.APS_BASE_PATH ?? (pages ? "/aps-test" : "");

const config: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  turbopack: { root: path.join(import.meta.dirname, "../..") },
  output: pages ? "export" : process.env.APS_STANDALONE ? "standalone" : undefined,
  basePath: basePath || undefined,
  trailingSlash: pages,
  images: { unoptimized: pages },
  env: { NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_STATIC: pages ? "1" : "" },
  ...(pages ? {} : { headers, rewrites }),
};

async function headers() {
  return [{ source: "/:path*", headers: securityHeaders }];
}

// Same-origin proxy to the FastAPI service so auth cookies stay first-party.
async function rewrites() {
  return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
}

export default config;
