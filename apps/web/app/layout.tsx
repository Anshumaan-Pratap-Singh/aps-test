import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { MobileNav, Sidebar } from "@/components/Nav";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: "APS · Quant Training Terminal", template: "%s · APS" },
  description: "Training for quantitative trading, research and development: mental maths, probability, market games, cognitive drills, curriculum and research lab.",
};

export const viewport: Viewport = { themeColor: "#050B14", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-bg text-text">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-elevated focus:px-3 focus:py-2">Skip to content</a>
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 min-w-0">
              <MobileNav />
              <main id="main" className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
