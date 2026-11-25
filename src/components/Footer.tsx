import { CONTACT_EMAIL, waLink, WHATSAPP_NUMBER } from '@/lib/site'
import { ChatIcon } from './icons'
import Reveal from './motion/Reveal'

function prettyNumber(n: string): string {
  // 918138802562 → +91 81388 02562
  return `+${n.slice(0, 2)} ${n.slice(2, 7)} ${n.slice(7)}`
}

export default function Footer() {
  return (
    <footer className="tfade border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-6 py-14">
        <Reveal className="flex flex-col justify-between gap-10 md:flex-row md:items-end">
          <div>
            <p className="font-display text-xl font-semibold">Betterinu</p>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-ink-soft">
              Practical, personal, and AI-powered learning built for the next generation of
              developers.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 md:items-end">
            <a
              href={waLink()}
              data-cta="footer-whatsapp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[15px] font-medium transition-colors hover:text-accent"
            >
              <ChatIcon className="h-[18px] w-[18px] text-accent" />
              {prettyNumber(WHATSAPP_NUMBER)}
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              data-cta="footer-email"
              className="text-[15px] font-medium transition-colors hover:text-accent"
            >
              {CONTACT_EMAIL}
            </a>
            <p className="text-sm text-ink-faint">Kerala, India</p>
          </div>
        </Reveal>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-[13px] text-ink-faint">
          <p>© 2026 Betterinu</p>
          <p>Talent Scholarship 2026 — two full rides, one free application.</p>
        </div>
      </div>
    </footer>
  )
}
