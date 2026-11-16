import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // Tarayıcı çeviri önermesin: pano metni çevrilirse hücreler bozulur ve
  // kiosk ekranında kapatılamayan bir çeviri balonu çıkar.
  other: { google: "notranslate" },
  title: "Split Flap",
  description:
    "Ev için split-flap pano: notları telefondan gönderin, ekran dönerek göstersin. A split-flap board for your home, controlled from your phone.",
  applicationName: "Split Flap",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
  // Çentikli telefonlarda pano ekranın kenarlarına kadar uzansın.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Hafif görünüm sayfa çizilmeden önce belirlenir ki zayıf cihaz ağır
    // katmanları bir kez bile çizmesin: kayıtlı tercih, yoksa adresteki ?lite
    // ya da tarayıcının bildirdiği bellek 1 GB ve altındaysa açılır.
    <html lang="tr" translate="no" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=localStorage.getItem("splitflat:lite");if(s?s==="on":(/[?&]lite\\b/.test(location.search)||(navigator.deviceMemory||8)<=1))document.documentElement.setAttribute("data-lite","")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
