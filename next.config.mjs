import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const siteHost = (() => {
  try {
    return new URL(siteUrl).host;
  } catch {
    return "localhost:3000";
  }
})();

const nextConfig = {
  reactStrictMode: true,
  optimizeFonts: false,
  experimental: {
    serverActions: {
      allowedOrigins: Array.from(new Set(["localhost:3000", siteHost])),
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "retouch-members.com" },
    ],
  },
};

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
})(nextConfig);
