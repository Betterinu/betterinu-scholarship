import ApplyForm from '@/components/ApplyForm'
import Audience from '@/components/Audience'
import Deal from '@/components/Deal'
import FloatingWhatsApp from '@/components/FloatingWhatsApp'
import Footer from '@/components/Footer'
import Hero from '@/components/Hero'
import SmoothScroll from '@/components/SmoothScroll'
import StickyBar from '@/components/StickyBar'
import Tracks from '@/components/Tracks'
import UnleashFire from '@/components/UnleashFire'
import ScrollTransition from '@/components/ScrollTransition'
import MotionProvider from '@/components/motion/MotionProvider'
import { ThemeProvider } from '@/theme'

// Audience, Deal, Footer, FloatingWhatsApp and Tracks are server
// components — they hold no state and ship no JavaScript. Only Hero, ApplyForm,
// StickyBar, the scroll pair and the theme provider cross into the client
// bundle. The hero burns away to reveal Audience; Tracks follows in normal flow.
export default function Page() {
  return (
    <ThemeProvider>
      <MotionProvider>
        <SmoothScroll>
          <div className="tfade min-h-screen bg-bg text-ink">
            <StickyBar />
            <main>
              <ScrollTransition hero={<Hero />} reveal={<Audience />} />
              <Tracks />
              <Deal />
              <ApplyForm />
              <UnleashFire />
            </main>
            <Footer />
            <FloatingWhatsApp />
          </div>
        </SmoothScroll>
      </MotionProvider>
    </ThemeProvider>
  )
}
