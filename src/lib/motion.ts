/**
 * One source of truth for motion, so every animation on the page reads as the
 * same hand rather than a pile of individually-tuned effects.
 *
 * The page has exactly one authored sequence: two hands meeting, and the
 * contact igniting a burn that consumes the hero. Everything below is the quiet
 * supporting vocabulary for that idea — arrivals that settle rather than bounce,
 * and light that spreads from a point.
 */

export const EASE = {
  /**
   * Confident arrival. GSAP's expo.out is the curve equivalent of
   * cubic-bezier(0.16, 1, 0.3, 1): most of the distance is covered immediately,
   * then it settles. Deliberately not a bounce or elastic — those read as toys.
   */
  out: 'expo.out',
  /** softer than expo for shorter travel, where expo looks like a snap */
  outSoft: 'power3.out',
  /** scrubbed motion tied to scroll position must not editorialise the timing */
  linear: 'none',
} as const

/**
 * Durations express distance and consequence. Anything longer than ~800ms stops
 * reading as motion and starts reading as latency.
 */
export const DUR = {
  /** immediate feedback: hover, press */
  feedback: 0.15,
  /** routine state change */
  state: 0.3,
  /** layout, overlay, view change */
  layout: 0.45,
  /** a deliberately authored entrance */
  entrance: 0.7,
} as const

/** default travel for a reveal — far enough to read as arrival, near enough not to lurch */
export const REVEAL_Y = 26

/**
 * Per-item stagger, and the ceiling on the total. Without a cap, a long list
 * turns into a queue the visitor waits through; `amount` spreads the whole
 * group across a fixed budget however many items there are.
 */
export const STAGGER_EACH = 0.07
export const STAGGER_MAX = 0.45

/** where a section starts revealing, as a ScrollTrigger start string */
export const REVEAL_START = 'top 85%'
