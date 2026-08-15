import type { Metadata } from "next";
import { DM_Serif_Display, Courier_Prime } from "next/font/google";
import "./globals.css";

// Self-hosted via next/font — the design depends on these two faces and
// nothing else, so a hotlink that fails would break the whole identity.
const display = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-serif",
});

const mono = Courier_Prime({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-courier-prime",
});

export const metadata: Metadata = {
  title: "1043 AG · Creator performance",
  description: "Performance dos creators da 1043, em um só lugar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${mono.variable}`}>
      <body>
        <div className="bg-grid" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
