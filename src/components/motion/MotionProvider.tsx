'use client'

import { MotionConfig } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Reduced motion, handled by the library rather than by branching on a hook.
 *
 * Branching the render on `useReducedMotion()` is a hydration bug waiting to
 * happen: the server has no media query, so it always takes the full-motion
 * path, and a `reduce` client then renders something different and React throws
 * the tree away. `reducedMotion="user"` keeps the markup identical on both
 * sides and drops transform and layout animation at the animation layer — while
 * still allowing opacity, which is the fade that reduced-motion guidance
 * explicitly permits.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

export default MotionProvider
