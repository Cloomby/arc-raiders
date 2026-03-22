import type { Metadata } from 'next'
import { Geist, Geist_Mono, Barlow } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const barlow = Barlow({
  weight: ['500'],
  variable: '--font-barlow',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'ARC Raiders — Stella Montis Callouts',
  description: 'Tactical callout map for ARC Raiders — Stella Montis',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${barlow.variable} h-full`}
    >
      <body className="h-full">
        <Analytics />
        <SpeedInsights />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
