import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EcoEdge - Eco-Smart Telemetry Grid",
  description: "AI-powered ecological telemetry and grid analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
  }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col relative overflow-x-hidden">
        {children}

        {/* Subtle Renewable Energy Background Image Watermark */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.035] md:opacity-[0.045] select-none z-0">
          <Image
            src="/renewable_watermark.jpg"
            alt="Renewable Energy Watermark"
            fill
            priority
            className="object-cover saturate-[0.85]"
          />
        </div>
      </body>
    </html>
  );
}
