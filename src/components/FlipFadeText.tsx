'use client'

import { Fragment, memo, useMemo, type ElementType } from 'react'
import { motion } from 'framer-motion'

interface FlipFadeTextProps {
  text: string
  className?: string
  /**
   * The element this renders as. Defaults to `h2` because every caller is a
   * section heading — rendering a `div` would silently strip the page's heading
   * outline, which is how screen-reader and keyboard users navigate it.
   */
  as?: ElementType
  letterDuration?: number
  staggerDelay?: number
}

const Letter = memo(function Letter({
  char,
  letterDuration,
}: {
  char: string
  letterDuration: number
}) {
  return (
    <motion.span
      style={{ transformStyle: 'preserve-3d' }}
      variants={{
        initial: { rotateX: 90, y: 20, opacity: 0, filter: 'blur(8px)' },
        animate: {
          rotateX: 0,
          y: 0,
          opacity: 1,
          filter: 'blur(0px)',
          transition: { duration: letterDuration, ease: [0.2, 0.65, 0.3, 0.9] },
        },
      }}
      className="inline-block"
    >
      {char}
    </motion.span>
  )
})

export function FlipFadeText({
  text,
  className,
  as: Tag = 'h2',
  letterDuration = 0.6,
  staggerDelay = 0.03,
}: FlipFadeTextProps) {
  // Split into words and explicit newlines, stripping spaces.
  const words = useMemo(
    () => text.split(/( |\n)/).filter((w) => w !== '' && w !== ' '),
    [text]
  )

  // `motion()` returns a new component type each call, so building it during
  // render would remount the whole heading on every render.
  const MotionTag = useMemo(() => motion(Tag), [Tag])

  // No branch on `useReducedMotion()` here on purpose — that differs between
  // server and client and detonates hydration. MotionProvider sets
  // `reducedMotion="user"` globally, which drops the rotate and translate at
  // the animation layer while the markup stays identical.
  return (
    <MotionTag
      className={className}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: '-10%' }}
      variants={{
        initial: { opacity: 1 },
        animate: { opacity: 1, transition: { staggerChildren: staggerDelay } },
      }}
      style={{ perspective: '1000px' }}
      // The letters are decorative fragments to assistive tech; the whole
      // string is announced once from here rather than character by character.
      aria-label={text}
    >
      {words.map((word, wordIndex) => {
        if (word === '\n') {
          return <br key={wordIndex} aria-hidden="true" />
        }
        return (
          <Fragment key={wordIndex}>
            {/* A real space, not a margin. Spacing the words with `mr-[0.25em]`
                looks identical but leaves the heading's text content as
                "Whoit'sfor" — which breaks find-in-page and copy-paste. Normal
                inline flow also means the heading wraps like text again instead
                of like a flex row. */}
            {wordIndex > 0 && words[wordIndex - 1] !== '\n' ? ' ' : null}
            <span aria-hidden="true" className="inline-block whitespace-nowrap uppercase">
              {word.split('').map((char, i) => (
                <Letter key={`${char}-${i}`} char={char} letterDuration={letterDuration} />
              ))}
            </span>
          </Fragment>
        )
      })}
    </MotionTag>
  )
}

export default FlipFadeText
