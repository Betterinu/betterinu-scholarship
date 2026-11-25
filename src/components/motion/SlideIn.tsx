'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * How far off to the side each card starts, in px rather than viewport units.
 * `whileInView` needs the element to actually overlap the browser window before
 * it will ever fire — that's how IntersectionObserver works, and `once: true`
 * means it only gets that one chance. A `vw`-based offset scales with the
 * window, but the card's own width doesn't grow past its `max-w-6xl` column,
 * so past a certain window width the offset outruns the card and pushes it
 * fully outside the window's bounds — at which point the observer has nothing
 * to intersect and the card never arrives. Keeping this comfortably under the
 * card's rendered width, at every breakpoint, keeps some part of it inside the
 * window at all times, however wide the screen gets.
 */
const DISTANCE = 120

export interface SlideInProps {
  children: ReactNode
  className?: string
  /** which edge the element arrives from */
  from: 'left' | 'right'
  /** hover lift in px; 0 leaves hover alone */
  lift?: number
}

/**
 * An element that arrives from one side when it scrolls into view.
 *
 * Renders the caller's className on the motion element itself rather than
 * wrapping it, so it replaces an existing node instead of adding depth — which
 * matters here because the node is a grid item and carries the `group` class
 * its descendants' hover states key off.
 *
 * The hover lift lives here too rather than in a Tailwind `hover:-translate-y`.
 * Framer Motion drives `transform` on this element, and a second source of
 * transform on the same node is exactly the conflict worth avoiding — so one
 * system owns it.
 */
export function SlideIn({ children, className, from, lift = 0 }: SlideInProps) {
  return (
    <motion.div
      // Hook for the no-JS safety net in the document head: Framer Motion
      // serialises `initial` into the SSR markup, so without it a failed script
      // would leave this content permanently invisible.
      data-slide-in=""
      className={className}
      initial={{ opacity: 0, x: from === 'left' ? -DISTANCE : DISTANCE }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      whileHover={
        lift ? { y: -lift, transition: { duration: 0.25, ease: 'easeOut' } } : undefined
      }
      transition={{ duration: 1, type: "spring", bounce: 0.2 }}
    >
      {children}
    </motion.div>
  )
}

export default SlideIn
