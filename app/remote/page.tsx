import type { Metadata } from "next";
import Remote from "@/components/Remote";

export const metadata: Metadata = {
  title: "Pano kumandası · Split Flap",
  // Eşleştirme bağlantıları arama motorlarına girmesin.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  // Ana ekrana eklenince adres çubuğu olmadan, "Split Flap" adıyla açılır.
  appleWebApp: { capable: true, title: "Split Flap", statusBarStyle: "black" },
};

export default function RemotePage() {
  return <Remote />;
}
