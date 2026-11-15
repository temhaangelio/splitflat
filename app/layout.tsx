import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Split-Flap Ev Panosu",
  description:
    "Ev için retro bir split-flap pano: notların, saat ve hava durumu. A retro split-flap board for your home.",
  applicationName: "Split-Flap",
};

export const viewport: Viewport = {
  themeColor: "#cbcbcb",
  // Çentikli telefonlarda duvar ekranın kenarlarına kadar uzansın.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
