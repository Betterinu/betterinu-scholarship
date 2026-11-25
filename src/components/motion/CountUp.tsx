'use client'

import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export interface CountUpProps {
  value: number
  prefix?: string
  suffix?: string
  className?: string
}

/**
 * A figure that counts to its value when it arrives.
 *
 * The real number is what renders on the server, so no-JS and reduced-motion
 * visitors read the actual figure — the zero is written in a layout effect and
 * only when the count is actually going to run. A value of 0 is left alone
 * rather than "counted" from 0 to 0, which would be motion that says nothing.
 */
export function CountUp({ value, prefix = '', suffix = '', className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || value === 0) return

    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const state = { n: 0 }
      el.textContent = '0'

      gsap.to(state, {
        n: value,
        duration: 1.1,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = String(Math.round(state.n))
        },
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      })

      // matchMedia's revert restores the tweened object, not the DOM text it
      // wrote, so the real figure is put back by hand.
      return () => {
        el.textContent = String(value)
      }
    })

    return () => mm.revert()
  }, [value])

  return (
    <span className={className}>
      {prefix}
      <span ref={ref}>{value}</span>
      {suffix}
    </span>
  )
}

export default CountUp
