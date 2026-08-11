import type { Metadata } from "next";
import { Lora, Manrope } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const lora = Lora({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-lora", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Bookelas — Reserve your practice",
  description: "Simple class booking for mindful movement studios."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${lora.variable} ${manrope.variable}`}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
