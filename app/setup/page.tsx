import type { Metadata } from "next";
import Setup from "@/components/Setup";

export const metadata: Metadata = {
  title: "İnternet kurulumu · Split Flap",
  robots: { index: false, follow: false },
};

export default function SetupPage() {
  return <Setup />;
}
