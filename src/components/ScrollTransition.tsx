'use client'

import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { resetHeroProgress, setHeroProgress } from '@/lib/heroTimeline'

gsap.registerPlugin(ScrollTrigger)

/**
 * Scroll length of the approach, as a multiple of the viewport. The hero sticks
 * for this whole block while the hands close, so the surplus over 100svh is
 * exactly how much scrolling the convergence is spread over.
 */
const APPROACH_SVH = 190
/**
 * Scroll length of the pinned burn. This is the single knob for how slowly the
 * hero dissolves: the burn is scrubbed across this whole distance, so more
 * viewports of scroll = a slower, more deliberate clear.
 */
const DISSOLVE = '+=340%'

export default function ScrollTransition({
  hero,
  reveal,
}: {
  hero: React.ReactNode
  /** the section the hero burns away to expose */
  reveal: React.ReactNode
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const approachRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const revealRef = useRef<HTMLDivElement>(null)

  // Reduced motion opts out of the whole choreography, not just the smoothing:
  // no pin, no scrub, no burn — the hero is one ordinary screen that scrolls
  // away and Tracks follows as normal flow. SSR renders the full-motion layout
  // and this collapses it at hydrate, before the user has scrolled anywhere.
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  useEffect(() => {
    resetHeroProgress()
    if (reduced) return

    const ctx = gsap.context(() => {
      /* ---------------------------------------------------------------- */
      /*  phase 1 — the approach                                          */
      /* ---------------------------------------------------------------- */
      // No pin here on purpose. The hero is held on screen by `position:
      // sticky`, and this trigger only reads the scroll position, so nothing
      // swaps to `position: fixed` mid-motion — which is where pinned scenes
      // usually show a one-frame jump. It ends at `bottom bottom`: the exact
      // offset at which the sticky hero runs out of block to stick to, which is
      // the frame the fingertips meet at the centre of the screen.
      ScrollTrigger.create({
        trigger: approachRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => setHeroProgress({ converge: self.progress }),
      })

      // The whole hero is the held composition: header, title, buttons and the
      // step ribbon all stay exactly where they are while the hands close. The
      // only motion during the approach is the hands themselves.

      /* ---------------------------------------------------------------- */
      /*  phase 2 — the pin and the burn                                  */
      /* ---------------------------------------------------------------- */
      // Starts precisely where phase 1 ended, so the hands lock the instant they
      // touch. Pinning the root freezes hero and reveal together; because the reveal
      // is pulled up by exactly one viewport it is already sitting behind the
      // hero, filling the screen, so the reveal needs no movement at all — the
      // hero simply stops being opaque.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: approachRef.current,
          start: 'bottom bottom',
          end: DISSOLVE,
          pin: rootRef.current,
          pinSpacing: true,
          scrub: 1,
          // Without this, the very first pin engagement can render one frame in
          // the old unpinned layout before ScrollTrigger swaps it to fixed —
          // a one-frame snap. That engagement happens at exactly this trigger's
          // start, which is the instant the hands touch, so the snap reads as
          // the whole hero jumping right when they collide. anticipatePin makes
          // ScrollTrigger reserve the pinned layout ahead of time so there is
          // nothing to snap to.
          anticipatePin: 1,
        },
      })

      // A beat of stillness at 0 → 0.1 before anything burns: the hands have
      // just met and the contact wants a moment to land.
      const burn = { value: 0 }
      tl.to(
        burn,
        {
          value: 1,
          // sine.inOut, not an ease-out: an ease-out front-loads the burn so
          // nearly half of it happens in the first quarter of the scroll, which
          // reads as the hero vanishing the moment it catches. Starting gentle
          // lets the ember take hold before the front picks up speed — and the
          // radius maps to area quadratically, so the late half accelerates
          // perceptually on its own without any help from the curve.
          ease: 'sine.inOut',
          onUpdate: () => setHeroProgress({ dissolve: burn.value }),
        },
        0.1,
      )

      // Nothing here animates the hero's copy. It is masked by BurnMask, which
      // reads the burn's radius straight from the same progress this timeline
      // writes — driving it from a second tween here would give it its own
      // easing and duration, and the text would drift out of step with the fire
      // it is supposed to be consumed by.

      // The reveal is already in position; this is only the faintest settle so
      // it does not read as a flat cut-out sitting behind a hole.
      tl.fromTo(
        revealRef.current,
        { opacity: 0.55, scale: 0.94 },
        { opacity: 1, scale: 1, duration: 0.45, ease: 'power2.out' },
        0.1,
      )

      // Once the hero is gone it must stop swallowing clicks meant for the
      // section it revealed.
      tl.set(heroRef.current, { pointerEvents: 'none' }, 0.6)
    }, rootRef)

    return () => {
      ctx.revert()
      resetHeroProgress()
    }
  }, [reduced])

  return (
    <div ref={rootRef} className="relative w-full">
      {/* Taller than the viewport; its sticky child is what is actually seen and
          the surplus height is the scroll budget the hands close over. */}
      <div
        ref={approachRef}
        className="relative z-10 w-full"
        style={{ height: reduced ? '100svh' : `${APPROACH_SVH}svh` }}
      >
        {/* `svh`, not `dvh`. `dvh` tracks the visible viewport, so the moment a
            phone's URL bar collapses mid-scroll this box grew and every element
            measured against it moved — the shift was the layout following the
            browser chrome. `svh` is the small viewport: the height with the
            chrome *showing*, which is a constant for the whole scroll.

            It also makes this box agree with the rest of the scene, which was
            already in `svh` — the approach block below, and the reveal pulled
            up by exactly `-100svh`. While this was `dvh` the hero was taller
            than the distance the reveal was raised by, so on a phone with the
            bar hidden they were never quite aligned.

            The trade is that when the bar does hide, the viewport grows past
            this box and leaves a strip beneath it. That strip is the page
            ground, `--bg: #000000` — black, which is what the hero is anyway. */}
        <div ref={heroRef} className="sticky top-0 h-svh w-full overflow-hidden">
          {hero}
        </div>
      </div>

      {/* Pulled up by exactly one viewport so it sits directly beneath the
          hero's final screen. At the moment the hands touch this is already
          centred and full-bleed behind them, so the dissolve reveals it in
          place rather than sliding it in. */}
      <div
        ref={revealRef}
        className="relative z-0 flex w-full items-center"
        style={reduced ? undefined : { marginTop: '-100svh', minHeight: '100svh' }}
      >
        {reveal}
      </div>
    </div>
  )
}
