'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { onHeroProgress, setHeroProgress } from '@/lib/heroTimeline'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*                          the framing, as numbers                           */
/* -------------------------------------------------------------------------- */

/**
 * Both hands live in one full-screen shader rather than as two `<img>` and a
 * separate dissolve layer. They have to, really: the dissolve consumes the
 * hands themselves, so it needs them as pixels it can sample.
 *
 * This used to run on three + react-three-fiber + drei — ~230 KB of gzipped
 * JavaScript to draw one quad with two textures. It is now ~150 lines of raw
 * WebGL: one program, one triangle strip, the same shader. The constants below
 * mirror the CSS the hands once carried, so the framing is unchanged and still
 * tunable — just expressed in screen-UV instead of Tailwind.
 */

/** natural size of each source image, used to hold its aspect ratio */
const HAND_L = { src: '/images/hand10.webp', aspect: 841 / 509 }
const HAND_R = { src: '/images/hand20.webp', aspect: 889 / 509 }

/** width of each image before scale, as a fraction of the viewport — was `w-[45vw]` */
const WIDTH_VW = 0.45
/** was `scale-125` / `scale-110`, now zoomed in further */
const SCALE_DESKTOP = 1.6
const SCALE_MOBILE = 1.4
/** how far each hand starts pushed outward — was `x: ∓4vw` */
const GAP_VW = 0.04
const MOBILE_BREAKPOINT = 768

/** desktop keeps the hands just above the true centre of the canvas */
const CY_DESKTOP = 0.46

/**
 * Mobile has no fixed slot for the hands the way desktop's wide canvas does —
 * the title wraps to five lines and the CTA buttons stack, so where "the
 * middle" is depends on the device. Rather than guess a height, Hero.tsx
 * reserves a real spacer element between the title and the buttons and passes
 * its ref down; every frame the hands are measured against *that* element's
 * live rect and scaled/positioned to fill it exactly. That makes "between the
 * title and the buttons" true by construction on any screen, instead of by a
 * constant tuned against one device and wrong on the next.
 *
 * Used only if the gap ref hasn't mounted yet (first frame / SSR).
 */
const MOBILE_FLOOR_FALLBACK_PX = 118

/**
 * Where the fingertips sit inside each image, as a fraction of its height from
 * the top — the luminance-weighted centroid of the columns nearest each inner
 * edge. The burn is seeded at the midpoint of the two, so it starts where the
 * fingers actually meet rather than at the middle of the canvas.
 */
const TIP_L_FROM_TOP = 0.49
const TIP_R_FROM_TOP = 0.42

/**
 * Fill cost is quadratic in device pixel ratio, and this scene is a soft glow
 * behind noise — it carries a lower ratio far better than type would. The text
 * over it is DOM and stays crisp at whatever the device's real ratio is, so all
 * that softens here is the hands and the burn edge.
 *
 * The tiers are deliberately conservative rather than clever: `deviceMemory`
 * is Chromium-only and `hardwareConcurrency` lies on some Android skins, so a
 * missing signal falls back to the middle tier rather than the cheap one.
 */
function maxDprFor(width: number): number {
  if (typeof navigator === 'undefined') return 2

  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const cores = navigator.hardwareConcurrency
  const lowEnd = (memory !== undefined && memory <= 4) || (cores !== undefined && cores <= 4)

  if (width < MOBILE_BREAKPOINT) return lowEnd ? 1.25 : 1.5
  return lowEnd ? 1.5 : 2
}

/**
 * Backstop for the tier table: a large tablet at ratio 2 can still ask for
 * more pixels than any of these GPUs want to fill every frame.
 */
const MAX_PIXELS = 1.6e6

/* -------------------------------------------------------------------------- */
/*                                 the shader                                 */
/* -------------------------------------------------------------------------- */

const VERT = /* glsl */ `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`

/**
 * The quad spans the canvas, so vUv is exactly screen UV and everything is done
 * in one space. Sampling converts sRGB to linear so the additive compositing
 * and the black-floor subtraction behave like light, then the result is encoded
 * back at the end — the same round trip the three renderer performed.
 */
const FRAG = /* glsl */ `
  precision highp float;

  uniform sampler2D uHandL;
  uniform sampler2D uHandR;
  /**
   * The two noise fields, baked. Neither depends on uDissolve — the block
   * field is a function of screen position alone and the angular field of the
   * angle from the contact point alone — so evaluating fbm per pixel per frame
   * was recomputing a constant. They are generated once on resize (see
   * buildBlockNoise / buildAngularNoise) and read back here as two fetches
   * instead of forty sin() calls.
   */
  uniform sampler2D uBlockNoise;
  uniform sampler2D uAngNoise;
  /** each hand's rectangle in screen UV, as (x0, y0, x1, y1) */
  uniform vec4  uRectL;
  uniform vec4  uRectR;
  uniform vec2  uResolution;
  uniform float uDissolve;
  uniform vec2  uCenter;
  varying vec2 vUv;

  /** the two baked fields below contribute at most 0.15 each */
  const float MAX_NOISE = 0.30;
  /** 1 / (2 * PI), to map an atan result onto the angular lookup */
  const float INV_TAU = 0.15915494;

  /**
   * Black pedestal baked into the source images, in linear light — their
   * "black" runs up to rgb(9,19,3), which would show as a faint lit rectangle
   * on a true-black ground.
   */
  const vec3 BLACK_FLOOR = vec3(0.007);

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  /**
   * The sources are opaque rectangles of glow on near-black, so they are added
   * rather than alpha-composited: black adds nothing, and where the two overlap
   * at the contact their light sums — the flare at the moment they touch. The
   * floor removes the baked-in pedestal; the feather covers the outer edges
   * where the streaks run off the artboard. Only the outer edges are feathered:
   * the inner ones carry the fingertips and must stay crisp to touch.
   * outerAtOne picks the outside edge — 0 for the left hand, 1 for the right.
   */
  vec3 sampleHand(sampler2D tex, vec4 rect, vec2 uv, float outerAtOne) {
    vec2 t = (uv - rect.xy) / (rect.zw - rect.xy);
    if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) return vec3(0.0);

    vec3 srgb = texture2D(tex, vec2(t.x, 1.0 - t.y)).rgb;
    vec3 c = max(pow(srgb, vec3(2.2)) - BLACK_FLOOR, vec3(0.0));

    float fx = outerAtOne > 0.5 ? smoothstep(1.0, 0.90, t.x) : smoothstep(0.0, 0.10, t.x);
    float fy = smoothstep(0.0, 0.07, t.y) * smoothstep(1.0, 0.93, t.y);
    return c * fx * fy;
  }

  void main() {
    vec3 color = sampleHand(uHandL, uRectL, vUv, 0.0)
               + sampleHand(uHandR, uRectR, vUv, 1.0);

    // Nothing is burning yet, and the whole block below resolves to "mask = 1,
    // rim = 0" at dissolve 0. The hero sits in this state for the entire
    // approach, which is the longest stretch of scroll on the page — so it is
    // worth not computing an answer that is already known.
    if (uDissolve <= 0.0) {
      gl_FragColor = vec4(pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
      return;
    }

    // Distance from the contact point, aspect-corrected so the front is a circle
    // on screen rather than an ellipse.
    float aspect = uResolution.x / uResolution.y;
    vec2 d = vUv - uCenter;
    d.x *= aspect;
    float dist = length(d);
    float angle = atan(d.y, d.x);

    // Two noise fields doing different jobs. The block field is quantised to a
    // ~6px grid so the edge crumbles in chunks instead of fizzing per pixel; the
    // angular field bends the front off-round so it never reads as a circle.
    // Both are lookups now: the block texture is one texel per 6px cell and
    // sampled NEAREST, which reproduces that quantisation exactly rather than
    // approximating it.
    float blockNoise = texture2D(uBlockNoise, vUv).r * 0.15;
    float angularNoise = texture2D(uAngNoise, vec2(angle * INV_TAU + 0.5, 0.5)).r * 0.15;
    float noisyDist = dist + blockNoise + angularNoise;

    // Normalise by the distance to the farthest corner *from the contact point*,
    // not from the middle of the screen — the origin is off-centre, and a centred
    // radius would leave the far corner unburnt at uDissolve = 1. The noise
    // headroom is added so normalizedDist can never exceed 1.
    vec2 far = vec2(uCenter.x < 0.5 ? 1.0 : 0.0, uCenter.y < 0.5 ? 1.0 : 0.0);
    vec2 farVec = far - uCenter;
    farVec.x *= aspect;
    float normalizedDist = noisyDist / (length(farVec) + MAX_NOISE);

    // Pushed a little past 1 so the tail end genuinely clears instead of leaving
    // a few stubborn corner pixels behind.
    float threshold = uDissolve * 1.04;

    // Below the threshold the pixel is gone. The 0.03 band is the soft shoulder
    // that stops the boundary aliasing into a stair-step.
    float mask = smoothstep(threshold - 0.03, threshold, normalizedDist);

    // A thin band just inside the front glows and sparkles, which is what sells
    // burning rather than fading. It narrows as the front expands, so the effect
    // spends itself instead of dragging a bright ring across the whole screen.
    float rimWidth = 0.15 * (1.0 - uDissolve) + 0.02;
    float rim = smoothstep(threshold - rimWidth, threshold - rimWidth + 0.04, normalizedDist)
              * smoothstep(threshold + 0.02, threshold - 0.02, normalizedDist);
    float sparkle = hash(floor(vUv * uResolution / 4.0)) * rim;

    // Tinted towards the hands' own green so the burn belongs to the image.
    vec3 emberColor = vec3(0.75, 1.0, 0.45);
    color += (emberColor * rim * 0.45 + vec3(sparkle * 2.2)) * (1.0 - uDissolve);

    // Back to sRGB, premultiplied by the mask: the drawing buffer is
    // premultiplied-alpha and blending is disabled, so this writes verbatim and
    // the alpha *is* the hole the section behind shows through.
    vec3 srgbOut = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));
    gl_FragColor = vec4(srgbOut * mask, mask);
  }
`

/* -------------------------------------------------------------------------- */
/*                            the noise, baked once                           */
/* -------------------------------------------------------------------------- */

/**
 * The same value-noise the fragment shader used to evaluate per pixel, moved to
 * the CPU and run once per size change.
 *
 * `fract(sin(x) * 43758.5453)` is a precision-dependent hash, so these do not
 * reproduce the GPU's exact bit pattern — float64 here against float32 there.
 * That is fine and deliberate: the field is decorative noise, and what has to
 * survive is its character (amplitude, octave structure, block size), not any
 * individual value.
 */
function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy)
  const b = hash2(ix + 1, iy)
  const c = hash2(ix, iy + 1)
  const d = hash2(ix + 1, iy + 1)
  return (a + (b - a) * ux) + (c - a + (d - b) * ux) * uy
}

/** five octaves, matching the shader this replaces */
function fbm2(x: number, y: number): number {
  let value = 0
  let amplitude = 0.5
  let frequency = 1
  for (let i = 0; i < 5; i++) {
    value += amplitude * valueNoise(x * frequency, y * frequency)
    amplitude *= 0.5
    frequency *= 2
  }
  return value
}

/** the noise cell size in device pixels — was `noiseScale` in the shader */
const NOISE_CELL = 6
/** angular lookup width; ~8 texels per cycle of the highest octave */
const ANGULAR_STEPS = 2048

/**
 * One texel per 6px cell of the drawing buffer. Sampled NEAREST at screen UV,
 * this lands on exactly the cell the shader used to quantise to, so the edge
 * still crumbles in chunks of the same size.
 */
function buildBlockNoise(pw: number, ph: number): { data: Uint8Array; w: number; h: number } {
  const w = Math.max(1, Math.ceil(pw / NOISE_CELL))
  const h = Math.max(1, Math.ceil(ph / NOISE_CELL))
  const data = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) {
    // the UV the shader's blockUv would have held for this cell, times 100
    const v = ((j * NOISE_CELL) / ph) * 100
    for (let i = 0; i < w; i++) {
      const u = ((i * NOISE_CELL) / pw) * 100
      data[j * w + i] = Math.min(255, Math.round(fbm2(u, v) * 255))
    }
  }
  return { data, w, h }
}

/**
 * A 1-D strip over a full turn. Independent of resolution and of where the
 * contact point sits, so it is built once for the lifetime of the context.
 */
function buildAngularNoise(): Uint8Array {
  const data = new Uint8Array(ANGULAR_STEPS)
  for (let i = 0; i < ANGULAR_STEPS; i++) {
    const angle = (i / ANGULAR_STEPS - 0.5) * Math.PI * 2
    data[i] = Math.min(255, Math.round(fbm2(angle * 5, 0) * 255))
  }
  return data
}

/* -------------------------------------------------------------------------- */
/*                              the WebGL harness                             */
/* -------------------------------------------------------------------------- */

interface Gl {
  gl: WebGLRenderingContext
  uniforms: Record<string, WebGLUniformLocation | null>
  /** texture units 0 and 1 — the two hand images */
  textures: [WebGLTexture, WebGLTexture]
  /** unit 2 — the block field, rebuilt whenever the drawing buffer resizes */
  blockNoise: WebGLTexture
  /** unit 3 — the angular field, built once */
  angNoise: WebGLTexture
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`shader compile failed: ${log}`)
  }
  return shader
}

/**
 * Builds program, quad and textures on a fresh context. Kept as one function so
 * context restoration is exactly a re-run.
 */
function initGl(canvas: HTMLCanvasElement): Gl {
  const gl = (canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
  }) ?? undefined) as WebGLRenderingContext | undefined
  if (!gl) throw new Error('WebGL unavailable')

  const program = gl.createProgram()!
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(program)}`)
  }
  gl.useProgram(program)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  // A single opaque quad writes every pixel: no depth, no blending, no clear
  // dependence. NoBlending is what lets the fragment's alpha pass through
  // verbatim as the canvas's alpha.
  gl.disable(gl.BLEND)
  gl.disable(gl.DEPTH_TEST)

  const uniforms: Gl['uniforms'] = {}
  for (const name of [
    'uHandL',
    'uHandR',
    'uBlockNoise',
    'uAngNoise',
    'uRectL',
    'uRectR',
    'uResolution',
    'uDissolve',
    'uCenter',
  ]) {
    uniforms[name] = gl.getUniformLocation(program, name)
  }
  gl.uniform1i(uniforms.uHandL, 0)
  gl.uniform1i(uniforms.uHandR, 1)
  gl.uniform1i(uniforms.uBlockNoise, 2)
  gl.uniform1i(uniforms.uAngNoise, 3)

  // The noise strips are single-channel and their widths are not multiples of
  // four, so the default 4-byte row alignment would skew every row after the
  // first into a diagonal smear.
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)

  // 1×1 black placeholders: the first frame paints the hero's black ground even
  // before the images decode, so there is never a flash of page background.
  const textures = [0, 1].map((unit) => {
    const tex = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
    // NPOT sources (841×509): clamp + linear, no mips — the WebGL1 rules.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    return tex
  }) as [WebGLTexture, WebGLTexture]

  // NEAREST on purpose: the block field *is* the quantisation. Filtering it
  // would smooth the 6px cells back into the per-pixel fizz they exist to
  // avoid. Uploaded empty here and filled by the first resize.
  const blockNoise = gl.createTexture()!
  gl.activeTexture(gl.TEXTURE2)
  gl.bindTexture(gl.TEXTURE_2D, blockNoise)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([0]))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

  // LINEAR here — this one is a smooth bend applied to the whole front, so
  // interpolating between steps is what keeps it from reading as facets.
  const angNoise = gl.createTexture()!
  gl.activeTexture(gl.TEXTURE3)
  gl.bindTexture(gl.TEXTURE_2D, angNoise)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.LUMINANCE,
    ANGULAR_STEPS,
    1,
    0,
    gl.LUMINANCE,
    gl.UNSIGNED_BYTE,
    buildAngularNoise(),
  )
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  return { gl, uniforms, textures, blockNoise, angNoise }
}

/* -------------------------------------------------------------------------- */

/**
 * The hero's hands plus the burn that consumes them. Fills its parent; the
 * scroll choreography that drives it lives in `ScrollTransition` and arrives
 * through the shared progress store — nothing here reads scroll directly, which
 * is what keeps the canvas honest while the page is pinned.
 */
export function HandDissolve({
  className,
  mobileGapRef,
}: {
  className?: string
  /** the DOM spacer Hero reserves between the title and the CTA buttons on
   *  mobile — the hands are fit into its live rect every frame, see
   *  MOBILE_FLOOR_FALLBACK_PX above */
  mobileGapRef?: RefObject<HTMLElement | null>
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return

    let ctx: Gl | null = null
    let raf = 0
    let disposed = false
    const progress = { converge: 0, dissolve: 0 }
    const images: (HTMLImageElement | null)[] = [null, null]
    let startTime = 0
    /** block-noise texture dimensions currently uploaded, in cells not pixels */
    let noiseW = 0
    let noiseH = 0

    const render = () => {
      raf = 0
      if (!ctx) return
      
      if (startTime === 0) startTime = performance.now()
      
      const { gl, uniforms } = ctx
      const W = canvas.clientWidth || 1
      const H = canvas.clientHeight || 1
      let dpr = Math.min(window.devicePixelRatio || 1, maxDprFor(W))
      // Backstop the tier table against an unusually large box.
      const budgeted = Math.sqrt(MAX_PIXELS / (W * H))
      if (budgeted < dpr) dpr = budgeted
      const pw = Math.round(W * dpr)
      const ph = Math.round(H * dpr)
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw
        canvas.height = ph
        gl.viewport(0, 0, pw, ph)
      }

      // Rebuild the block field only when the *texture* would change shape, not
      // whenever the drawing buffer moves. A sticky element's width jitters by a
      // pixel or two as the pin engages, and at one texel per 6px cell that is
      // usually no change at all — keying on the raw size instead re-ran twenty
      // thousand fbm evaluations in the middle of the scroll.
      const nw = Math.max(1, Math.ceil(pw / NOISE_CELL))
      const nh = Math.max(1, Math.ceil(ph / NOISE_CELL))
      if (nw !== noiseW || nh !== noiseH) {
        noiseW = nw
        noiseH = nh
        const { data, w, h } = buildBlockNoise(pw, ph)
        gl.activeTexture(gl.TEXTURE2)
        gl.bindTexture(gl.TEXTURE_2D, ctx.blockNoise)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data)
      }

      const now = performance.now()
      const t = Math.min((now - startTime) / 1500, 1.0)
      // cubic ease-out
      const entranceProgress = 1.0 - Math.pow(1.0 - t, 3)

      const c = progress.converge
      const isMobile = W < MOBILE_BREAKPOINT
      const scale = isMobile ? SCALE_MOBILE : SCALE_DESKTOP
      const viewAspect = W / H

      // Width is a fraction of the viewport; height follows from the image's
      // own aspect, converted through the viewport aspect because screen UV is
      // not square. These are the *natural* sizes — mobile then fits them into
      // the reserved gap below, which can shrink them further.
      let w = WIDTH_VW * scale
      let hL = (w * viewAspect) / HAND_L.aspect
      let hR = (w * viewAspect) / HAND_R.aspect

      // Vertical anchor, as each hand's bottom edge in screen UV (0 at the
      // bottom of the canvas, 1 at the top — same space hL/hR are already in).
      //
      // Desktop hangs both from a shared centre. Mobile fits the pair into the
      // DOM gap Hero reserves between the title and the CTA buttons: the right
      // hand is placed by its *fingertip* rather than its bottom edge, because
      // the two images have different aspects and aligning bottom edges would
      // put the tips at different heights, seeding the burn off the contact.
      let y0L: number
      let y0R: number
      if (isMobile) {
        // Natural bounding box of the pair (bottom edge of the left hand at 0),
        // before any fit-to-gap scaling.
        const offset = (1 - TIP_L_FROM_TOP) * hL - (1 - TIP_R_FROM_TOP) * hR

        const hostRect = host.getBoundingClientRect()
        const gapRect = mobileGapRef?.current?.getBoundingClientRect() ?? null

        // Gap's vertical span, converted from top-down viewport pixels into the
        // same bottom-up UV fraction of H that everything above is in. Only the
        // bottom edge is used below — the hands are anchored to the gap's floor,
        // not its ceiling.
        const gapBottomUV = gapRect ? 1 - (gapRect.bottom - hostRect.top) / H : null

        const scaledBottom = Math.min(0, offset)

        // Bottom-anchored to the gap's own bottom edge, i.e. flush with the
        // CTA row's top margin — the buttons end up directly beneath the hands
        // simply because that is where the reserved space in the DOM ends.
        const floor = gapBottomUV ?? MOBILE_FLOOR_FALLBACK_PX / H
        y0L = floor - scaledBottom
        y0R = y0L + offset
      } else {
        y0L = CY_DESKTOP - hL / 2
        y0R = CY_DESKTOP - hR / 2
      }

      // The inner edges close on the middle of the screen. Both images carry
      // their fingertip flush to that edge, so a zero gap is real contact.
      // Interpolates from the starting gap (GAP_VW) all the way to a slight
      // overlap at c=1, so the actual fingertips (which are inset from the
      // image edge) make real contact when the dissolve triggers.
      const FINAL_OVERLAP = 0.01
      const gapHalf = GAP_VW * (1 - c) - FINAL_OVERLAP * c
      const entranceOffset = (1.0 - entranceProgress) * 0.3

      const u = uniforms
      gl.uniform4f(u.uRectL, 0.5 - gapHalf - w - entranceOffset, y0L, 0.5 - gapHalf - entranceOffset, y0L + hL)
      gl.uniform4f(u.uRectR, 0.5 + gapHalf + entranceOffset, y0R, 0.5 + gapHalf + w + entranceOffset, y0R + hR)

      // keep rendering until entrance finishes
      if (entranceProgress < 1.0) {
        if (!disposed) raf = requestAnimationFrame(render)
      }

      // Seed the burn between the two fingertips. Measured up from each hand's
      // own bottom edge, so this follows whichever anchor the branch above chose
      // — on mobile the two land on the same line and the midpoint is the tips.
      const tipL = y0L + (1 - TIP_L_FROM_TOP) * hL
      const tipR = y0R + (1 - TIP_R_FROM_TOP) * hR
      const contactY = (tipL + tipR) / 2
      gl.uniform2f(u.uCenter, 0.5, contactY)

      // Publish it so the DOM layer stacked above this canvas can be eaten by
      // the same front from the same origin, rather than approximating it.
      // Flipped to top-down, which is what CSS works in.
      setHeroProgress({ contactX: 0.5, contactY: 1 - contactY })

      gl.uniform2f(u.uResolution, W, H)
      gl.uniform1f(u.uDissolve, progress.dissolve)

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    // Demand loop: everything that changes the picture funnels through here,
    // and consecutive requests inside one frame coalesce into a single draw.
    const invalidate = () => {
      if (!raf && !disposed) raf = requestAnimationFrame(render)
    }

    const uploadTextures = () => {
      if (!ctx) return
      images.forEach((img, i) => {
        if (!img) return
        ctx!.gl.activeTexture(ctx!.gl.TEXTURE0 + i)
        ctx!.gl.bindTexture(ctx!.gl.TEXTURE_2D, ctx!.textures[i])
        ctx!.gl.texImage2D(ctx!.gl.TEXTURE_2D, 0, ctx!.gl.RGBA, ctx!.gl.RGBA, ctx!.gl.UNSIGNED_BYTE, img)
      })
      invalidate()
    }

    const setup = () => {
      ctx = initGl(canvas)
      // A restored context has fresh, empty textures — forget what the old one
      // was holding so the next frame rebuilds the block field into it.
      noiseW = 0
      noiseH = 0
      uploadTextures()
      invalidate()
    }

    try {
      setup()
    } catch (err) {
      // No WebGL: paint the ground in CSS instead and stop. The page still
      // works — the Tracks reveal comes from DOM opacity, not this canvas —
      // only the hands and the burn are lost. The black is applied here rather
      // than always, because behind a working canvas an opaque host would blank
      // out the very hole the shader opens.
      host.style.backgroundColor = '#000'
      console.error('[HandDissolve]', err)
      return
    }

    ;[HAND_L.src, HAND_R.src].forEach((src, i) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        images[i] = img
        uploadTextures()
      }
      img.onerror = () => console.error('[HandDissolve] texture failed', src)
      img.src = src
    })

    const unsubscribe = onHeroProgress((p) => {
      progress.converge = p.converge
      progress.dissolve = p.dissolve
      invalidate()
    })

    const ro = new ResizeObserver(invalidate)
    ro.observe(host)

    // A quiet demand loop leaves its last frame in the drawing buffer; coming
    // back from a background tab or the bfcache can drop it, so repaint once on
    // the way back in.
    const repaint = () => {
      if (!document.hidden) invalidate()
    }
    document.addEventListener('visibilitychange', repaint)
    window.addEventListener('pageshow', repaint)

    const onLost = (e: Event) => {
      e.preventDefault()
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      ctx = null
    }
    const onRestored = () => {
      try {
        setup()
      } catch (err) {
        console.error('[HandDissolve] context restore failed', err)
      }
    }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)

    return () => {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      unsubscribe()
      ro.disconnect()
      document.removeEventListener('visibilitychange', repaint)
      window.removeEventListener('pageshow', repaint)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      // Deliberately no loseContext() here: strict mode remounts reuse the same
      // canvas, and getContext on a force-lost context stays lost — which would
      // blank the hero on every dev remount. The context dies with the element.
    }
  }, [])

  return (
    <div ref={hostRef} className={cn('absolute inset-0 z-0', className)}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}

export default HandDissolve
