'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export interface ParallaxProps {
  children: ReactNode
  className?: string
  /**
   * Travel as a percentage of the layer's own height. Small on purpose: the
   * caller must provide matching overscan, and anything larger reads as the
   * image sliding rather than as depth.
   */
  amount?: number
}

/**
 * Scrubbed depth for an image inside a cropping frame.
 *
 * The transform lives on this wrapper, never on the image, so a CSS hover
 * transform on the image itself cannot fight a GSAP transform on the same
 * element — the two motion systems stay on separate nodes.
 *
 * The caller is responsible for overscan: this layer must be taller than its
 * frame by at least `amount`, or the travel exposes an edge.
 */
export function Parallax({ children, className, amount = 8 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        el,
        { yPercent: -amount },
        {
          yPercent: amount,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      )
    })

    return () => mm.revert()
  }, [amount])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

export default Parallax
