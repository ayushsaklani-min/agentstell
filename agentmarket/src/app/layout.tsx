import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
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
  title: "AgentMarket — API Marketplace for AI Agents",
  description: "The first API marketplace where payment is authentication. Built for AI agents using x402 micropayments on Stellar. No accounts, no API keys, no subscriptions.",
  keywords: ["API", "marketplace", "AI agents", "Stellar", "x402", "micropayments", "USDC"],
  authors: [{ name: "AgentMarket" }],
  openGraph: {
    title: "AgentMarket — Payment IS Authentication",
    description: "Every API on the internet was built assuming a human would set it up. We built the first one assuming nobody will.",
    type: "website",
  },
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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
