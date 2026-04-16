import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OffLearn — Offline-first learning in your browser",
  description:
    "Offline curriculum and SAT/ACT prep in your browser (static PWA). Optional lesson help: local Gemma via MediaPipe/WebGPU, Transformers.js embeddings, Voy RAG — no backend, no data to third parties. Desktop only; mobile not supported.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0D1117",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${inter.className} antialiased`}>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
