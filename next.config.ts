import type { NextConfig } from "next";

// HTML dokumanlari icin cache kurali. /_next/static disarida birakiliyor: oradaki
// dosya adlari icerik hash'i tasiyor, "immutable" kalmalari dogru. Sorun HTML
// tarafindaydi — tarayici eski HTML'i saklayinca icindeki chunk adlari yeni
// yayinla birlikte kayboluyor ve kullanici eski surumde takili kaliyor.
const DOCUMENT_PATHS = "/((?!_next/static|_next/image).*)";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value:
              "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate",
          },
        ],
      },
      {
        source: DOCUMENT_PATHS,
        headers: [
          {
            // no-cache = "sakla ama her seferinde sunucuya sor". Degismediyse
            // ETag sayesinde 304 doner, yani ucuz.
            key: "Cache-Control",
            value: "no-cache, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
