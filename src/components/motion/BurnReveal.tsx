'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { DUR, EASE } from '@/lib/motion'
import { onHeroProgress } from '@/lib/heroTimeline'

/** the slice of the burn this reveal occupies — it starts once the front has real area */
const FROM = 0.45
const TO = 0.95

export interface BurnRevealProps {
  children: ReactNode
  className?: string
  /** selector for the children to stagger, resolved inside this element */
  stagger: string
}

/**
 * The payoff of the hero's burn, and the one place the supporting motion is
 * allowed to be authored rather than quiet.
 *
 * Deliberately not a ScrollTrigger reveal. This content sits inside the pinned
 * container, revealed by the dissolve rather than by arriving in the viewport,
 * so a scroll-position trigger would fire against a position that no longer
 * means anything. Driving a paused timeline straight from the burn's own
 * progress instead makes the arrival *caused by* the fire: items radiate
 * outward from the centre — the same point the fingertips met and the burn
 * started — as the front clears them.
 */
export function BurnReveal({ children, className, stagger }: BurnRevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const mm = gsap.matchMedia()

    // Under `reduce` the hero choreography never runs at all, so `dissolve`
    // would stay at 0 forever. Guarding the whole effect means the content is
    // simply never hidden in the first place.
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const targets = Array.from(el.querySelectorAll(stagger))
      if (!targets.length) return

      gsap.set(targets, { opacity: 0, y: 18, scale: 0.96 })

      const tl = gsap.timeline({ paused: true }).to(targets, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: DUR.entrance,
        ease: EASE.out,
        stagger: { amount: 0.5, from: 'center' },
      })

      const unsubscribe = onHeroProgress((p) => {
        tl.progress(gsap.utils.clamp(0, 1, (p.dissolve - FROM) / (TO - FROM)))
      })

      return () => {
        unsubscribe()
        tl.kill()
      }
    })

    return () => mm.revert()
  }, [stagger])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

export default BurnReveal
