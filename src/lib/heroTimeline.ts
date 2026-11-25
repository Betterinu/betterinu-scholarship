/**
 * One scroll position, several readers.
 *
 * `ScrollTransition` owns the GSAP timeline that maps scroll onto the hero
 * choreography; the hand canvas owns the uniforms that render it. Neither should
 * measure scroll itself — anything that reads `window.scrollY` directly breaks
 * the moment the page is pinned, because scrollY keeps climbing while the view
 * is frozen in place. So GSAP writes here and everyone else reads here.
 *
 * Deliberately not React state: these change every scrubbed frame, and a
 * re-render per frame would cost far more than writing two floats.
 */
export interface HeroProgress {
  /** 0 = hands apart at rest, 1 = fingertips touching at the centre of the screen */
  converge: number
  /** 0 = hero intact, 1 = fully burnt away from the contact point outward */
  dissolve: number
  /**
   * Where the burn starts, as top-down fractions of the viewport — the same
   * point the shader seeds from, published so the DOM layer above the canvas
   * can be consumed by the same front instead of guessing at its origin.
   */
  contactX: number
  contactY: number
}

const progress: HeroProgress = {
  converge: 0,
  dissolve: 0,
  contactX: 0.5,
  contactY: 0.5,
}

type Listener = (p: HeroProgress) => void
const listeners = new Set<Listener>()

export function getHeroProgress(): Readonly<HeroProgress> {
  return progress
}

/**
 * Dev-only console handle. The scene is entirely scroll-driven and Lenis owns
 * the scroll position, so without this there is no way to step the choreography
 * to a known frame from outside — which is exactly what automated verification
 * needs. Dead-code-eliminated from production builds.
 */
export function exposeHeroDebug(extra: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return
  Object.assign(
    ((window as unknown as Record<string, unknown>).__hero ??= {}) as Record<string, unknown>,
    { progress, ...extra },
  )
}

export function setHeroProgress(patch: Partial<HeroProgress>): void {
  let changed = false
  if (patch.converge !== undefined && patch.converge !== progress.converge) {
    progress.converge = patch.converge
    changed = true
  }
  if (patch.dissolve !== undefined && patch.dissolve !== progress.dissolve) {
    progress.dissolve = patch.dissolve
    changed = true
  }
  // The contact point is written by the renderer, which already runs on its own
  // frames — it must not by itself wake the demand loop, or the two would keep
  // re-triggering each other. It rides along with the next real change.
  if (patch.contactX !== undefined) progress.contactX = patch.contactX
  if (patch.contactY !== undefined) progress.contactY = patch.contactY

  // The canvas runs a demand frameloop, so a no-op write must not wake it.
  if (!changed) return
  for (const fn of listeners) fn(progress)
}

export function onHeroProgress(fn: Listener): () => void {
  listeners.add(fn)
  fn(progress)
  return () => {
    listeners.delete(fn)
  }
}

/** A remount must not inherit the scroll state of the previous mount. */
export function resetHeroProgress(): void {
  progress.converge = 0
  progress.dissolve = 0
}

/**
 * The shader's own normalisation, in pixels: how far the burn front has
 * travelled from the contact point at a given dissolve value.
 *
 * Kept here rather than in either consumer because both the canvas and the DOM
 * mask above it have to agree exactly — the 1.04 overshoot and the 0.30 noise
 * headroom are the same constants the fragment shader uses to guarantee the
 * far corner clears at dissolve = 1.
 */
export function burnRadiusPx(
  dissolve: number,
  viewportWidth: number,
  viewportHeight: number,
  contactX: number,
  contactY: number,
): { radius: number; feather: number } {
  const cx = contactX * viewportWidth
  const cy = contactY * viewportHeight
  const farCorner = Math.hypot(
    Math.max(cx, viewportWidth - cx),
    Math.max(cy, viewportHeight - cy),
  )
  const maxDist = farCorner + 0.3 * viewportHeight
  
  // The shader evaluates `dist + noise < threshold`. Since noise is positive
  // (up to 0.3), the actual physical hole is smaller than the threshold. 
  // We reduce the DOM mask radius so it tightly matches the visual fire.
  return {
    radius: Math.max(0, dissolve * 1.04 * maxDist - 0.22 * maxDist),
    // A much tighter feather so the text vanishes exactly as the fire hits it,
    // rather than fading away prematurely.
    feather: 0.05 * maxDist,
  }
}

/**
 * How much of the hero's copy is still there at a given dissolve.
 *
 * The mask alone consumes the type strictly radially, so a corner of the
 * headline survives at full strength until the front physically arrives — which
 * looks like the text outlasting the fire that is supposed to be taking it.
 * Fading it out across the middle of the burn means it is gone well before the
 * front finishes, while the hole still governs *where* it goes first.
 */
export function burnOpacity(dissolve: number): number {
  const t = (dissolve - 0.12) / (0.72 - 0.12)
  if (t <= 0) return 1
  if (t >= 1) return 0
  // smoothstep, so it leaves and arrives without a visible corner
  return 1 - t * t * (3 - 2 * t)
}
