'use client'

import { useEffect, useState } from 'react'
import { onHeroProgress } from '@/lib/heroTimeline'

/** Slim apply bar once the hero is gone — solid background, no blur (blur over
 *  a live canvas is a compositing tax mid-range phones pay every frame). */
export default function StickyBar() {
  const [visible, setVisible] = useState(false)

  // Gated on the hero transition rather than on a raw scroll offset. The old
  // `scrollY > 0.88vh` test fired partway through the pinned burn, dropping the
  // bar on top of the hero mid-dissolve — while pinned, scroll distance no
  // longer corresponds to anything on screen.
  //
  // Under reduced motion the choreography never runs, so `dissolve` never
  // advances — there the plain scroll offset is the honest signal again.
  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return onHeroProgress((p) => setVisible(p.dissolve > 0.75))
    }
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setVisible(window.scrollY > window.innerHeight * 0.88)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null
  return (
    <div className="tfade bar-in fixed inset-x-0 top-0 z-40 border-b border-line bg-bg">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <a href="#top" className="font-display font-semibold tracking-tight">
          Betterinu
        </a>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-ink-faint sm:block">
            2 full scholarships · 15% off for showing up
          </span>
          <a
            href="#apply"
            data-cta="sticky-bar"
            className="inline-flex h-9 items-center rounded-full bg-cta px-4.5 text-sm font-semibold text-cta-ink transition-transform hover:-translate-y-0.5"
          >
            Apply free
          </a>
        </div>
      </div>
    </div>
  )
}
