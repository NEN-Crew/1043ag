import type { Metadata } from "next";
import { DM_Serif_Display } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

// Three faces, all self-hosted. The Figma uses PP Kyoto (serif), PP Neue
// Montreal (sans) and PP Neue Montreal Mono / Geist Mono; these are the
// closest open equivalents and the rest of the system is built on them.
const display = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-serif",
});

export const metadata: Metadata = {
  title: "1043 AG · Creator performance",
  description: "Performance dos creators da 1043, em um só lugar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
