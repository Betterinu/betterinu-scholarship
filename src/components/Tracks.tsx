// Server component: everything here is static markup — the hover states are
// CSS, and the old pointer handlers fed a particle field that no longer exists.
// Keeping it on the server keeps its JSX out of the client bundle.
import { TRACKS } from '@/lib/site'
import { ArrowRight } from './icons'
import FlipFadeText from './FlipFadeText'
import SlideIn from './motion/SlideIn'
import Parallax from './motion/Parallax'

const BACKGROUNDS: Record<string, string> = {
  epic: '/images/epic-marketing.webp',
  coding: '/images/coding-ckit.webp',
}

export default function Tracks() {
  return (
    // `overflow-x-clip` contains the cards' off-screen start positions so the
    // slide-in cannot produce a horizontal scrollbar — clip rather than hidden,
    // because hidden would force the vertical axis to scroll and cut off the
    // cards' hover lift.
    <section
      id="tracks"
      className="mx-auto w-full max-w-6xl scroll-mt-20 overflow-x-clip px-6 py-16 md:py-20"
    >
      <div className="max-w-2xl">
        <FlipFadeText 
          text="Pick your track." 
          className="font-display text-[2rem] font-semibold tracking-[-0.01em] md:text-[2.6rem]" 
        />
        <p className="mt-3 text-lg text-ink-soft">
          Apply to the one you’d actually do at 11pm on a Tuesday.
        </p>
      </div>
      
      {/* The two cards converge from opposite edges — the same gesture the hero
          opens with, two things arriving from either side toward a meeting in
          the middle. They travel together rather than staggered, because the
          pairing is the point. */}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {TRACKS.map((track, index) => (
          <SlideIn
            key={track.id}
            from={index === 0 ? 'left' : 'right'}
            lift={4}
            className="group relative flex min-h-[440px] flex-col justify-between overflow-hidden rounded-2xl border border-line bg-card p-8 transition-colors duration-500 ease-out hover:border-line-strong md:p-10"
          >
            {/* The parallax transform lives on the wrapper and the hover
                transform on the image, so GSAP and CSS never drive the same
                node. `-inset-y-[10%]` is the overscan the 8% travel needs —
                without it the drift would expose an edge. */}
            <Parallax className="absolute inset-x-0 -inset-y-[10%]" amount={8}>
              {/* A real <img> rather than a CSS background so the browser can
                  defer it: these sit below the fold behind the hero, and as CSS
                  backgrounds they were fetched eagerly with the page. */}
              <img
                src={BACKGROUNDS[track.id]}
                alt=""
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            </Parallax>
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black/90 transition-opacity duration-500 group-hover:opacity-90" />

            {/* Top content */}
            <div className="relative flex items-start justify-between">
              <span className="font-display text-lg font-bold text-accent">
                {String(index + 1).padStart(2, '0')}
              </span>
              <a
                href="#apply"
                data-cta={`track-${track.id}-arrow`}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/20 text-white/70 backdrop-blur-sm transition-[color,border-color,transform] duration-200 hover:scale-110 hover:border-accent hover:text-accent group-hover:border-white/40 group-hover:text-white"
                aria-label={`Apply for ${track.name}`}
              >
                <ArrowRight className="h-4 w-4 -rotate-45 transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </div>

            {/* Bottom content */}
            <div className="relative mt-32">
              <h3 className="font-display text-4xl font-black uppercase tracking-wide md:text-[2.75rem] leading-[1.1]">
                {track.name}
              </h3>
              <p className="mt-4 max-w-[36ch] text-[15px] leading-relaxed text-white/80">
                {track.hook}
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
                <div className="flex flex-wrap gap-2">
                  {track.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/20 px-3.5 py-1.5 text-[11px] font-semibold tracking-widest text-white/90 uppercase backdrop-blur-md transition-colors duration-300 group-hover:border-white/30"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <a
                  href="#apply"
                  data-cta={`track-${track.id}`}
                  className="group/btn ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold uppercase tracking-widest text-black transition-transform hover:scale-105"
                >
                  Apply now
                  <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                </a>
              </div>
            </div>
          </SlideIn>
        ))}
      </div>
    </section>
  )
}
