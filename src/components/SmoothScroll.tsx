'use client'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { useEffect, type ReactNode } from 'react'
import { exposeHeroDebug } from '@/lib/heroTimeline'

gsap.registerPlugin(ScrollTrigger)

export default function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 1.5,
    })

    // Lenis and ScrollTrigger have to share one clock. Left on separate loops,
    // Lenis writes the scroll position on its own rAF while ScrollTrigger reads
    // whatever it cached on the last native scroll event — so every scrubbed
    // timeline trails the real position by a frame or more, which is exactly
    // what reads as stutter. Driving `lenis.raf` from the gsap ticker and
    // updating ScrollTrigger from Lenis' own scroll event puts both on the same
    // tick, in the right order.
    const update = () => ScrollTrigger.update()
    lenis.on('scroll', update)

    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)

    // Lenis rewrites the scroll position every frame, so window.scrollTo is
    // stomped — the scene can't be stepped from the console without a handle.
    exposeHeroDebug({ lenis })
    // gsap's lag smoothing freezes the ticker delta after a long frame, which
    // makes Lenis jump when the main thread hitches. Scrubbing wants raw time.
    gsap.ticker.lagSmoothing(0)

    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const anchor = target?.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (href && href.startsWith('#')) {
        const targetEl = href === '#top' || href === '#' ? document.body : document.querySelector(href)
        if (targetEl) {
          e.preventDefault()
          lenis.scrollTo(targetEl as HTMLElement, { offset: -20 })
        }
      }
    }

    document.addEventListener('click', handleAnchorClick)

    return () => {
      document.removeEventListener('click', handleAnchorClick)
      lenis.off('scroll', update)
      gsap.ticker.remove(raf)
      gsap.ticker.lagSmoothing(500, 33)
      lenis.destroy()
    }
  }, [])

  return <>{children}</>
}
