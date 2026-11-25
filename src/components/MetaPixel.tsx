'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { META_PIXEL_ID, PIXEL_ENABLED, trackCustom, trackEvent } from '@/lib/pixel'

/**
 * Meta Pixel: the loader, the automatic PageView, and the interaction events
 * this campaign actually cares about.
 *
 * The CTAs it reports on are plain `<a>` tags spread across Hero, Header,
 * StickyBar, Tracks, Footer and FloatingWhatsApp — most of them server
 * components that ship no JavaScript. Rather than make six of them client
 * components just to hang an onClick on each, one delegated listener on the
 * document reads the clicks as they bubble. Every one of them carries a
 * `data-cta` naming the placement, which is what turns "someone clicked apply"
 * into "the hero converts, the sticky bar doesn't".
 *
 * SmoothScroll installs its own document click listener for in-page anchors.
 * That one consumes the click (preventDefault + Lenis scroll); this one only
 * observes it. Keeping them apart is deliberate — merging would put analytics
 * inside the scroll engine, and the listener itself costs nothing.
 *
 * `afterInteractive` keeps the loader off the critical path — it starts once
 * the page is usable, so the pixel never competes with the hero's textures or
 * the WebGL bundle for the first network round.
 */
export default function MetaPixel() {
  const pathname = usePathname()
  const lastPath = useRef(pathname)

  // The init snippet below fires the first PageView itself. This covers the
  // ones a client-side route change would otherwise swallow — today the site
  // is a single page, so this is dormant until a second route exists.
  //
  // Compares the path rather than tripping a "first run" flag: reactStrictMode
  // is on, so in dev React mounts, runs this, simulates an unmount and runs it
  // again on the same instance. A one-way flag would already be spent by the
  // second pass and report a PageView nobody navigated to; re-reading the same
  // pathname is idempotent however many times it runs.
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    trackEvent('PageView')
  }, [pathname])

  useEffect(() => {
    if (!PIXEL_ENABLED) return

    function onClick(e: MouseEvent) {
      const target = e.target
      if (!(target instanceof Element)) return
      // `[data-cta]` first so a CTA that is a <button> — or any element that
      // isn't an anchor — is still reported.
      const el = target.closest('[data-cta], a')
      if (!el) return

      const placement = (el as HTMLElement).dataset.cta ?? 'unlabelled'
      // The raw attribute, never the resolved `.href`. An in-page link reads
      // as "#apply" here but as "https://…/#apply" there, and a substring test
      // against a resolved URL would also match a wa.me inside a redirect
      // wrapper or a UTM value.
      const href = el instanceof HTMLAnchorElement ? (el.getAttribute('href') ?? '') : ''

      if (href.startsWith('mailto:')) {
        trackEvent('Contact', { method: 'email', placement })
        return
      }
      // Every WhatsApp CTA is built by waLink(), which always yields exactly
      // this prefix — so an exact prefix test is both safe and precise.
      if (href.startsWith('https://wa.me/')) {
        trackEvent('Contact', { method: 'whatsapp', placement })
        return
      }
      // Not a Lead — nobody has applied yet. It is the top of the funnel, and
      // knowing which CTA carries the traffic is the point of tracking it.
      // Keyed on the marker, not the href, so a CTA that points somewhere new
      // is still counted; the href is the fallback that catches an #apply link
      // added without a tag, which surfaces as 'unlabelled' rather than
      // vanishing.
      if (el.hasAttribute('data-cta') || href === '#apply') {
        trackCustom('ApplyCTAClick', { placement })
      }
    }

    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  if (!PIXEL_ENABLED) return null

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  )
}
