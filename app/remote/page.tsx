import type { Metadata } from "next";
import Remote from "@/components/Remote";

export const metadata: Metadata = {
  title: "Pano kumandası · Splitflat",
  // Eşleştirme bağlantıları arama motorlarına girmesin.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function RemotePage() {
  return <Remote />;
}
