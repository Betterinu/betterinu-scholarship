import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import MetaPixel from '@/components/MetaPixel'
import './globals.css'

export const metadata: Metadata = {
  title: 'Betterinu Talent Scholarship 2026 Your talent pays the fees',
  description:
    'Two full scholarships across EPIC Marketing and Coding C-Kit. Apply free in two minutes everyone who attends the offline round in Perinthalmanna gets 15% off.',
  openGraph: {
    title: 'Betterinu Talent Scholarship 2026',
    description:
      'Two full scholarships. 15% off for everyone who attends the offline round. Applying is free.',
    type: 'website',
    locale: 'en_IN',
  },
  twitter: { card: 'summary' },
  icons: { icon: '/favicon.ico' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
  colorScheme: 'dark',
}

/**
 * `class="dark"` is written server-side rather than by a pre-paint inline
 * script the Vite build had no HTML at request time, so it had to patch the
 * document from JS before first paint; here the markup ships with it and the
 * theme is correct in the very first byte. ThemeProvider takes over on hydrate.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* carried over from the Vite index.html: paints the page ground even
            if the stylesheet is still in flight */}
        <style
          dangerouslySetInnerHTML={{
            __html: 'html,html.dark{background-color:#000;color:#fff}',
          }}
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/clash-display-700.woff2"
          crossOrigin=""
          fetchPriority="high"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/satoshi-400.woff2"
          crossOrigin=""
        />
        {/* The hero's only visual is these two textures, fetched by JS that
            itself arrives late (dynamic import). Preloading lets them ride the
            first network round instead of queueing behind the whole JS chain. */}
        <link rel="preload" as="image" href="/images/hand10.webp" fetchPriority="high" />
        <link rel="preload" as="image" href="/images/hand20.webp" fetchPriority="high" />
        {/* Framer Motion serialises an element's `initial` state into the
            server HTML, so anything revealed on scroll ships hidden and depends
            on JS to ever appear. If the script never runs, this puts it back
            `!important` in a stylesheet outranks a non-important inline style. */}
        <noscript>
          <style
            dangerouslySetInnerHTML={{
              __html: '[data-slide-in]{opacity:1!important;transform:none!important}',
            }}
          />
        </noscript>
      </head>
      <body>
        {children}
        {/* Last in the body: the loader is `afterInteractive`, and the
            noscript pixel is a 1×1 that must not sit between the page and its
            content. Mounted here rather than per-page so a second route
            inherits tracking without being wired up for it. */}
        <MetaPixel />
      </body>
    </html>
  )
}
