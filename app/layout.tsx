import type { Metadata } from "next";
import { readBuildId } from "@/lib/buildId";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hermest Clinic Visual Consent Sheet",
  description: "Hermest Clinic pre-procedure visual consent sheet",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-image-preview": "none",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Sayfayla birlikte giden kimlik. Tarayicidaki kod bunu okuyup /api/version
  // ile karsilastirir; eski (cache'ten gelen) HTML eski kimligi tasidigi icin
  // fark aninda goruluyor.
  const buildId = readBuildId();

  return (
    <html lang="en">
      <head>
        <meta name="x-build-id" content={buildId} />
      </head>
      <body>{children}</body>
    </html>
  );
}
