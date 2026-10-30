import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { PresenceHost } from "@/components/presence/presence-host";
import { AppShell } from "@/components/shell/app-shell";
import { readPresenceTiming } from "@/lib/presence/timing";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "The Unclaimed",
    template: "%s · The Unclaimed",
  },
  description: "A research workspace for abandoned websites and missing digital records.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
        <Suspense fallback={null}>
          <PresenceHost timing={readPresenceTiming()} />
        </Suspense>
      </body>
    </html>
  );
}
