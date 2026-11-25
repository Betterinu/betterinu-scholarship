import { waLink } from '@/lib/site'
import { WhatsAppIcon } from './icons'

export default function FloatingWhatsApp() {
  return (
    <a
      href={waLink('Hi Betterinu! I have a question about the Talent Scholarship 2026.')}
      data-cta="floating-bubble"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="group float-idle fixed bottom-6 right-6 z-50 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#25D366] text-black shadow-lg shadow-[#25D366]/30 transition-all duration-300 hover:scale-110 hover:bg-[#20bd5a] hover:shadow-xl hover:shadow-[#25D366]/40 active:scale-95"
    >
      <WhatsAppIcon className="h-10 w-10 fill-current stroke-black stroke-[0.5px]" />
    </a>
  )
}
