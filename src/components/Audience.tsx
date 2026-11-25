import { CheckIcon } from './icons'
import FlipFadeText from './FlipFadeText'
import BurnReveal from './motion/BurnReveal'

const AUDIENCES = [
  '+2 students',
  'Degree students',
  'Graduates',
  'Diploma students',
  'Job seekers',
  'Career switchers',
  'Freelancers',
  'Tech Aspirants',
] as const

/**
 * The section the hero burns away to reveal. Server component — static markup,
 * no JavaScript shipped. It fills the viewport it is revealed into, so the list
 * is sized as content, not as metadata chips.
 */
export default function Audience() {
  return (
    <section id="who-its-for" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-16 md:py-20">
      <div className="max-w-2xl">
        <FlipFadeText
          text="Who it’s for."
          className="font-display text-[2rem] font-semibold tracking-[-0.01em] md:text-[2.6rem]"
        />
        <p className="mt-3 text-lg text-ink-soft">
          No prerequisites, no gatekeeping — if one of these is you, this round is yours.
        </p>
      </div>
      {/* Driven by the burn rather than by scroll position: these arrive as the
          front clears them, radiating from the centre it started at. */}
      <BurnReveal stagger="li" className="mt-10 w-full flex justify-center md:justify-start">
        <ul className="grid grid-cols-2 gap-2 sm:gap-3.5 w-full sm:w-fit">
          {AUDIENCES.map((label) => (
            <li
              key={label}
              className="group tfade flex w-full items-center gap-1.5 sm:gap-2.5 rounded-full border border-line-strong px-2.5 py-2.5 sm:px-5 sm:py-3 text-[12.5px] sm:text-[15.5px] font-medium transition-[border-color,transform,background-color] duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/5"
            >
              <CheckIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-accent transition-transform duration-200 group-hover:scale-110" />
              <span className="truncate">{label}</span>
            </li>
          ))}
        </ul>
      </BurnReveal>
      <p className="mt-10 text-sm text-ink-faint">
        Two tracks, two full scholarships pick yours below.
      </p>
    </section>
  )
}
