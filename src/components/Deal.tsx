'use client'

import FlipFadeText from './FlipFadeText'
import Reveal from './motion/Reveal'
import CountUp from './motion/CountUp'

/**
 * `value` is the countable quantity and `prefix`/`suffix` the parts that are
 * notation rather than number. ₹0 carries a 0 deliberately: its point is that
 * there is nothing to count, so it arrives rather than ticks.
 */
const ROWS = [
  {
    value: 2,
    prefix: '',
    suffix: '',
    lead: 'Full scholarships on the table.',
    sub: 'Complete fee waivers, awarded across the two tracks at the offline round.',
  },
  {
    value: 15,
    prefix: '',
    suffix: '%',
    lead: 'Off for everyone who attends the offline round.',
    sub: 'Not just the winners — every applicant who shows up walks out with it.',
  },
  {
    value: 0,
    prefix: '₹',
    suffix: '',
    lead: 'To apply. Free at every stage.',
    sub: 'Two minutes online, then we take it from there on WhatsApp.',
  },
]

import { motion, type Variants } from 'framer-motion'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -100 },
  visible: { 
    opacity: 1, 
    x: 0, 
    transition: { type: "spring", bounce: 0.2, duration: 1 }
  }
}

export default function Deal() {
  return (
    <section id="deal" className="tfade scroll-mt-20 bg-bg-soft">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <Reveal y={40} className="max-w-2xl">
          <FlipFadeText
            text="THE DEAL."
            className="uppercase font-display text-[2rem] font-black tracking-tight md:text-[2.6rem]"
          />
          <p className="mt-3 text-lg text-ink-soft transition-opacity">
            No entry fee, no catch showing up already puts you ahead.
          </p>
        </Reveal>
        
        {/* Three rows staggered in from the left */}
        <motion.div 
          className="mt-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-10% 0px' }}
        >
          {ROWS.map((r) => (
            <motion.div
              variants={itemVariants}
              key={r.prefix + r.value + r.suffix}
              className="grid items-baseline gap-x-10 gap-y-2 border-t border-line py-8 md:grid-cols-[200px_1fr] md:py-10"
            >
              <CountUp
                value={r.value}
                prefix={r.prefix}
                suffix={r.suffix}
                className="font-display text-[3.4rem] font-bold leading-none text-accent md:text-[4.2rem]"
              />
              <div>
                <p className="text-xl font-medium leading-snug md:text-2xl">{r.lead}</p>
                <p className="mt-2 max-w-[58ch] text-[15.5px] leading-relaxed text-ink-soft md:text-base">
                  {r.sub}
                </p>
              </div>
            </motion.div>
          ))}
          <motion.div variants={itemVariants} className="border-t border-line" />
        </motion.div>
      </div>
    </section>
  )
}
