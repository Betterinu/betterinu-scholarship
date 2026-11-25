/**
 * Meta (Facebook) Pixel. The ID is not a secret — it ships in the page source
 * of every site that runs a pixel — so it lives here as a constant alongside
 * the other campaign constants rather than in an env var that has to be set
 * again on every host. Swap it here if the campaign moves to another pixel.
 */
export const META_PIXEL_ID = '2082833452603329'

/**
 * The live campaign only. The form fires a real `Lead`, so anywhere that isn't
 * the production site would otherwise write fake conversions into the dataset
 * the ad set optimises delivery on — the one number the campaign is judged by.
 *
 * Two environments have to be excluded, not one. `next dev` is the obvious
 * one. The other is Vercel's preview deployments: they build with
 * NODE_ENV=production like the real thing, so every PR URL would carry a live
 * pixel. NEXT_PUBLIC_VERCEL_ENV is injected by Vercel itself and tells them
 * apart — nothing to configure in the dashboard.
 *
 * The preview test is written as `!== 'preview'` rather than `=== 'production'`
 * deliberately. If that variable ever goes missing, this fails towards
 * tracking: a few stray preview events are a far cheaper mistake than a live
 * campaign silently recording nothing.
 *
 * Set NEXT_PUBLIC_META_PIXEL_DEBUG=1 in .env.local to load it anyway, which is
 * how you verify with Meta Pixel Helper against Events Manager → Test Events.
 */
export const PIXEL_ENABLED =
  (process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_VERCEL_ENV !== 'preview') ||
  process.env.NEXT_PUBLIC_META_PIXEL_DEBUG === '1'

/**
 * The subset of the fbq signature this site uses. `fbq` is installed by the
 * loader snippet in MetaPixel.tsx; until that script arrives it exists as a
 * queueing stub, and if an ad blocker eats the script it never exists at all.
 */
type Fbq = (
  command: 'init' | 'track' | 'trackCustom',
  target: string,
  params?: Record<string, unknown>,
) => void

declare global {
  interface Window {
    fbq?: Fbq
  }
}

/**
 * A standard Meta event (`Lead`, `Contact`, `PageView`, …).
 *
 * `typeof window` rather than `window.fbq?.()` — this module has no
 * 'use client' and sits in @/lib next to site.ts, which server components
 * import freely, so a bare `window` here is a ReferenceError at render rather
 * than the no-op this is meant to be.
 *
 * Every call is guarded twice over: blocking trackers is common enough that an
 * unguarded call on the submit path would turn a blocked pixel into a broken
 * application form. Tracking is allowed to fail; the funnel is not.
 *
 * Named `trackEvent`, not `track`, because `track` is already a domain noun
 * here — Tracks.tsx maps over `TRACKS` with `track` as the loop variable, and
 * an import by that name would be shadowed inside the very callback that wants
 * to report on the click.
 */
export function trackEvent(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  window.fbq?.('track', event, params)
}

/** A custom event — anything outside Meta's standard vocabulary. */
export function trackCustom(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  window.fbq?.('trackCustom', event, params)
}
