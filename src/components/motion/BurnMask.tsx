'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { burnOpacity, burnRadiusPx, onHeroProgress } from '@/lib/heroTimeline'


/**
 * The lobes the burn hole is assembled from. Fixed rather than random so the
 * shape is stable frame to frame — regenerating it per frame would make the
 * edge boil.
 *
 * `scale` stays at or above 0.95 while `offset` peaks at 0.12, so the least
 * covered direction still reaches 0.83 of the nominal radius. That matters at
 * the end of the burn: the radius is sized to clear the farthest corner exactly,
 * and lobes that pulled in further than that would leave slivers of the hero
 * behind at dissolve = 1.
 */
const LOBES = [
  { angle: 0.0, scale: 1.02, offset: 0.05 },
  { angle: 1.31, scale: 0.95, offset: 0.06 },
  { angle: 2.42, scale: 1.04, offset: 0.04 },
  { angle: 3.56, scale: 0.93, offset: 0.05 },
  { angle: 4.71, scale: 1.0, offset: 0.03 },
  { angle: 5.62, scale: 0.97, offset: 0.06 },
] as const

/** the lobe offset is a fraction of the radius, expressed against each axis */
const radiusPct = (radius: number, el: HTMLElement, axis: 'x' | 'y'): number => {
  const size =
    axis === 'x'
      ? el.clientWidth || window.innerWidth
      : el.clientHeight || window.innerHeight
  return (radius / size) * 100
}

export interface BurnMaskProps {
  children: ReactNode
  className?: string
}

/**
 * Hands the hero's DOM to the burn.
 *
 * The shader can only consume what it renders, so the title, buttons, header
 * and ribbon — which sit in the DOM above the canvas — used to just fade out on
 * their own schedule and visibly outlive the fire. This masks them with a hole
 * that opens from the very point the fingertips met, at the radius the shader
 * has actually cleared, so the text is eaten by the same front at the same
 * moment rather than dissolving alongside it.
 *
 * Both the origin and the radius come from the renderer through the shared
 * store — nothing here re-derives them, so the two cannot drift apart.
 */
export function BurnMask({ children, className }: BurnMaskProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let frame = 0
    let last = -1

    const apply = (dissolve: number, cx: number, cy: number) => {
      // A circle's radius in `radial-gradient` must be a length — a percentage
      // is only valid for `ellipse`, and an invalid gradient drops the mask
      // entirely, which is why the text used to survive the burn untouched.
      const { radius, feather } = burnRadiusPx(
        dissolve,
        el.clientWidth || window.innerWidth,
        el.clientHeight || window.innerHeight,
        cx,
        cy,
      )
      // Below the first pixel of burn there is no hole to cut, and masking a
      // full-screen text layer forces it to re-rasterise — so while the hero is
      // simply sitting there, it carries no mask at all.
      if (dissolve <= 0) {
        el.style.removeProperty('-webkit-mask-image')
        el.style.removeProperty('mask-image')
        el.style.removeProperty('-webkit-mask-composite')
        el.style.removeProperty('mask-composite')
        el.style.removeProperty('opacity')
        return
      }

      // One circle reads as a circle, because the fire's edge is broken up by
      // noise the shader evaluates per pixel and a CSS mask has no way to reach
      // that. So the hole is built from several overlapping lobes instead:
      // offset around the contact point at varying radii, they union into a
      // lumpy front that stops the boundary announcing itself as a stamped
      // round. `intersect` multiplies the layers' alpha, and each layer is
      // opaque outside its own lobe — so a pixel clears as soon as *any* lobe
      // has reached it, which is the union.
      const gradient = LOBES.map(({ angle, scale, offset }) => {
        const ox = cx * 100 + Math.cos(angle) * offset * radiusPct(radius, el, 'x')
        const oy = cy * 100 + Math.sin(angle) * offset * radiusPct(radius, el, 'y')
        const r = radius * scale
        return (
          `radial-gradient(circle at ${ox.toFixed(2)}% ${oy.toFixed(2)}%,` +
          ` transparent ${r.toFixed(1)}px,` +
          ` rgba(0,0,0,0.45) ${(r + feather * 0.42).toFixed(1)}px,` +
          ` #000 ${(r + feather).toFixed(1)}px)`
        )
      }).join(', ')

      el.style.setProperty('-webkit-mask-image', gradient)
      el.style.setProperty('mask-image', gradient)
      el.style.setProperty('-webkit-mask-composite', 'source-in')
      el.style.setProperty('mask-composite', 'intersect')
      el.style.setProperty('opacity', burnOpacity(dissolve).toFixed(3))
    }

    // Coalesced into a frame: the store fires on every scrubbed update, and the
    // mask only needs to be correct once per painted frame.
    const unsubscribe = onHeroProgress((p) => {
      if (p.dissolve === last && p.dissolve === 0) return
      last = p.dissolve
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        apply(p.dissolve, p.contactX, p.contactY)
      })
    })

    return () => {
      unsubscribe()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

export default BurnMask
