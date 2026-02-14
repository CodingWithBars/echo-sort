import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import InstallPWA from "@/components/InstallPWA";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 1. Define Viewport (Theme color is vital for the mobile status bar)
export const viewport: Viewport = {
  themeColor: "#10b981", // Using an "Eco" Green hex
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// 2. Updated Metadata with PWA links
export const metadata: Metadata = {
  title: "EcoRoute",
  description: "Route Optimization for Efficient Waste Collection",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EcoRoute",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Recommended for iOS support */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <InstallPWA />
      </body>
    </html>
  );
}