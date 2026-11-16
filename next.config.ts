import type { NextConfig } from "next";

// Site hazır dosyalar olarak derlenir (`out/`). Onları ve not deposunu
// Raspberry Pi'deki küçük sunucu sağlar: raspberry-pi/server.ts.
//
// Geliştirirken `next dev` yalnızca sayfaları sunar; /api istekleri, ayrı bir
// terminalde çalışan aynı sunucuya yönlendirilir (bkz. README).
const dev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  output: "export",
  ...(dev
    ? {
        async rewrites() {
          return [{ source: "/api/:path*", destination: "http://127.0.0.1:8080/api/:path*" }];
        },
      }
    : {}),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
