import type { Metadata } from "next";
import About from "@/components/About";

export const metadata: Metadata = {
  title: "Hakkında · About · Split Flap",
  description:
    "Split Flap nedir, nasıl kullanılır ve verileriniz nerede durur. What Split Flap is, how to use it and where your data lives.",
};

export default function AboutPage() {
  return <About />;
}
