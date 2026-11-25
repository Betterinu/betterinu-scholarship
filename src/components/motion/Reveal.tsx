'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { DUR, EASE, REVEAL_START, REVEAL_Y, STAGGER_EACH, STAGGER_MAX } from '@/lib/motion'

gsap.registerPlugin(ScrollTrigger)

export interface RevealProps {
  children: ReactNode
  className?: string
  /**
   * Selector for the children to stagger, resolved inside this element. Omit to
   * animate the wrapper as a single unit. Use a list selector only where the
   * content genuinely reads as a list — staggering an arbitrary group is how
   * scroll reveals start to feel mechanical.
   */
  stagger?: string
  /** travel distance in px */
  y?: number
  delay?: number
  start?: string
}

/**
 * Scroll reveal for content that is otherwise static markup.
 *
 * Renders a plain div and takes the caller's className, so it replaces a
 * wrapper that already existed rather than adding depth to the DOM — and its
 * children can stay server components.
 */
export function Reveal({
  children,
  className,
  stagger,
  y = REVEAL_Y,
  delay = 0,
  start = REVEAL_START,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    // matchMedia is what makes reduced motion a genuine no-op rather than a
    // special case: under `reduce` nothing inside ever runs, so the markup
    // simply keeps the visible state it was server-rendered with.
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const targets: Element[] = stagger ? Array.from(el.querySelectorAll(stagger)) : [el]
      if (!targets.length) return

      // The hidden state is set here, not in CSS. A blocked or failed script
      // then leaves the content on screen instead of invisible — and because a
      // layout effect runs before paint, there is still no flash of the
      // un-animated state.
      gsap.set(targets, { opacity: 0, y })

      gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration: DUR.entrance,
        ease: EASE.out,
        delay,
        stagger:
          targets.length > 1
            ? { amount: Math.min(STAGGER_MAX, targets.length * STAGGER_EACH) }
            : 0,
        scrollTrigger: { trigger: el, start, once: true },
      })
    })

    return () => mm.revert()
  }, [stagger, y, delay, start])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

export default Reveal
