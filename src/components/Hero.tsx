'use client'

import { useRef } from 'react'
import Header from './Header'
import HandDissolve from './ScrollDissolve'
import FlipFadeText from './FlipFadeText'
import BurnMask from './motion/BurnMask'
import { waLink } from '@/lib/site'
import { ArrowRight, WhatsAppIcon } from './icons'
import { motion } from 'framer-motion'

// Imported statically on purpose. The canvas used to sit behind a dynamic
// `ssr: false` import because it dragged three + drei (~230 KB gz) with it; on
// raw WebGL the whole component is a few KB, and the extra request-waterfall of
// a lazy chunk would cost more than the code it defers.

const STEPS = [
  ['01', 'Apply online — free'],
  ['02', 'Offline round in Perinthalmanna'],
  ['03', 'Two full scholarships awarded'],
] as const

export default function Hero() {
  const ctaRef = useRef<HTMLDivElement>(null)
  // The gap reserved between the title and the CTA buttons on mobile — passed
  // down so the canvas can fit the hands into its live rect every frame
  // instead of guessing a vertical position that only matches some devices.
  const handsGapRef = useRef<HTMLDivElement>(null)

  return (
    // No `bg-black` on the section: the black is painted by the canvas so the
    // dissolve can burn through it. A CSS background would sit behind the canvas
    // and survive as an opaque sheet however much alpha the shader opened up.
    <section id="top" className="relative flex h-full min-h-svh flex-col overflow-hidden">
      {/* Both hands live inside this canvas: the dissolve consumes the hands
          themselves, so the shader needs them as pixels it can sample. Their
          framing is the constants at the top of the component. */}
      <HandDissolve mobileGapRef={handsGapRef} />

      {/* Everything the shader cannot reach. BurnMask cuts a hole in this whole
          layer that tracks the fire's actual radius from its actual origin, so
          the copy is consumed by the burn instead of fading out beside it. */}
      <BurnMask className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        <div className="relative z-20 pointer-events-auto">
          <Header />
        </div>

        {/* Anchored to the top on mobile rather than centred. This used to be
            load-bearing: the hero box was `dvh`, so it grew when the URL bar
            collapsed and a centred column split that growth and drifted. The
            box is `svh` now (see ScrollTransition) and no longer moves, so
            this is a composition choice — the copy reads from the top edge
            down, the same way the hands are anchored to the floor.
            The breakpoint is `md` (768px), matching MOBILE_BREAKPOINT in
            ScrollDissolve — the layout and the canvas have to agree on which
            regime they're in, or there's a band of widths where one thinks
            it's mobile and the other doesn't. */}
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-start md:justify-center px-6 pb-4 sm:pb-10 pt-6 md:pt-15 pointer-events-none">
          {/* `h-full` + `flex-col` only below `md`: filling the column gives
              the hands-gap spacer below a real height to flex-grow into. Auto
              height would make it a zero-content flex item with nothing to
              grow against. Desktop reverts to plain block flow, unchanged. */}
          <div className="pointer-events-auto flex h-full flex-col md:block md:h-auto">
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-[11px] text-white font-semibold uppercase tracking-[0.16em]  sm:text-[13px] sm:tracking-[0.18em]"
            >
              Your Talent Pays The Fees
            </motion.p>
            <FlipFadeText
              as="h1"
              text={"BETTERINU\nTALENT\nSCHOLARSHIP\n2026"}
              className="mt-4 max-w-[16ch] font-display text-[clamp(2.75rem,10vw,7rem)] font-black uppercase leading-[0.8] tracking-tigt [word-spacing:0.15em]"
            />
            {/* Kept as an invisible spacer on desktop, where it holds the gap
                the copy used to occupy. */}
            <p className="invisible mt-6 hidden max-w-[52ch] text-lg leading-relaxed text-ink-soft md:block md:text-xl">
              Two full scholarships across two tracks —{' '}
              <strong className="font-semibold text-ink">EPIC Marketing</strong> and{' '}
              <strong className="font-semibold text-ink">Coding C-Kit</strong>. Applying is free, takes
              two minutes, and everyone who attends the offline round gets 15% off. Win or lose.
            </p>
            {/* The hands live in this exact box. `flex-1` claims whatever
                space is actually left after the title and buttons, on
                whatever device this is — never a guessed height, so it can
                never be the thing that pushes the CTAs or the ribbon off
                screen. ScrollDissolve reads its live rect every frame and
                fits the hand pair to it, bottom-anchored, so the CTAs always
                render directly below wherever the hands end up. */}
            <div ref={handsGapRef} aria-hidden className="min-h-0 flex-1 md:hidden" />
            <motion.div
              ref={ctaRef as any}
              className="mt-8 sm:mt-8 flex flex-wrap items-center gap-3.5"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              <a
                href="#apply"
                data-cta="hero"
                className="group inline-flex w-full sm:w-[240px] justify-center h-[52px] items-center gap-2.5 rounded-full bg-cta px-7 text-[16.5px] font-semibold text-cta-ink transition-transform hover:-translate-y-0.5"
              >
                Apply free
                <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-0.5" />
              </a>
              <a
                href={waLink()}
                data-cta="hero-whatsapp"
                target="_blank"
                rel="noopener noreferrer"
                className="tfade inline-flex w-full sm:w-[240px] justify-center h-[52px] items-center gap-2.5 rounded-full border border-line-strong px-7 text-[16.5px] font-semibold transition-colors hover:border-accent"
              >
                <WhatsAppIcon className="h-[22px] w-[22px] text-accent fill-current" />
                Chat on WhatsApp
              </a>
            </motion.div>
          </div>
        </div>

        <div className="relative z-10 mt-auto border-t border-line pointer-events-auto pb-4 sm:pb-8">
          <ol className="mx-auto grid w-full max-w-6xl gap-x-8 gap-y-2.5 px-6 pt-5 pb-2 sm:grid-cols-3">
            {STEPS.map(([n, label]) => (
              <li key={n} className="flex items-baseline gap-3">
                <span className="font-display text-sm font-semibold text-accent">{n}</span>
                <span className="text-sm text-ink-soft">{label}</span>
              </li>
            ))}
          </ol>
        </div>
      </BurnMask>
    </section>
  )
}
