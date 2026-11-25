'use client'

export default function Header() {
  return (
    <header className="relative z-20">
      <div className="mx-auto flex h-[76px] w-full max-w-6xl items-center justify-between gap-4 px-6">
        <a href="#top" className="font-display text-[19px] font-semibold tracking-tight">
          Betterinu
        </a>

        <div className="flex items-center gap-3">
          <a
            href="#apply"
            data-cta="header"
            className="inline-flex h-10 items-center rounded-full bg-cta px-5 text-sm font-semibold text-cta-ink transition-transform hover:-translate-y-0.5"
          >
            Apply free
          </a>
        </div>
      </div>
    </header>
  )
}
