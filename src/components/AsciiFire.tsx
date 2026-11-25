"use client";

import * as React from "react";
import { useEffect, useRef } from "react";

type PaletteMode = "mono" | "color" | "custom";
type WindDirection = "left" | "right";
type FireCharset = "classic" | "dense" | "blocks" | "minimal";

type FireParticle = {
  kind: "ember" | "spark";
  glyph: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  heat: number;
  life: number;
  maxLife: number;
};

type AsciiFireOptions = {
  intensity: number;
  windDirection: WindDirection;
  windForce: number;
  decay: number;
  turbulence: number;
  thickness: number;
  embers: boolean;
  sparks: boolean;
  pulse: boolean;
  palette: PaletteMode;
  shades: string[];
  sparkColor: string;
  charset: FireCharset;
  backgroundColor: string;
};

type Props = Partial<AsciiFireOptions> & {
  style?: React.CSSProperties;
};

type FireConfig = {
  intensity: number;
  wind: number;
  decay: number;
  turbulence: number;
  thickness: number;
  embers: boolean;
  sparks: boolean;
  pulse: boolean;
};

/**
 * Per-frame cost is O(columns × rows), and the grid is derived from the glyph
 * size — so this is the single strongest lever on how expensive the effect is.
 * At 10px a 1440-wide panel is ~240 columns; 13px takes it to ~185, which is
 * roughly a third less work per frame for a glyph grid that reads the same.
 */
const FONT_SIZE = 13;

/**
 * Hard ceiling on grid cells, independent of viewport. Without it the cost
 * grows with the square of the window and a large desktop pays several times
 * what a laptop does for no visible gain — the glyphs just get denser.
 */
const MAX_CELLS = 6000;

const CHARSETS: Record<FireCharset, string> = {
  classic: " .:-=+*#%@",
  dense: " `.^,:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  blocks: " ░▒▓█",
  minimal: " .:*#",
};

const DEFAULT_CHARSET_KEY: FireCharset = "classic";

const COLOR_PALETTE = [
  "#411205",
  "#7c2105",
  "#b93608",
  "#e85b0c",
  "#ff8b18",
  "#ffc247",
  "#fff1aa",
] as const;

const MONO_PALETTE = [
  "#181818",
  "#303030",
  "#505050",
  "#787878",
  "#a8a8a8",
  "#d8d8d8",
  "#ffffff",
] as const;

const DEFAULT_FIRE_OPTIONS: AsciiFireOptions = {
  intensity: 100,
  windDirection: "right",
  windForce: 10,
  decay: 13,
  turbulence: 30,
  thickness: 1,
  embers: true,
  sparks: true,
  pulse: false,
  palette: "custom",
  shades: [...COLOR_PALETTE],
  sparkColor: "#FF3030",
  charset: "dense",
  backgroundColor: "transparent",
};

/**
 * Fire is stochastic, so it reads convincingly well below display refresh —
 * and every frame costs a full rebuild of several thousand coloured spans.
 * Dropping 30 -> 20 removes a third of that work outright.
 */
const FPS = 20;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const resolveWind = (direction: WindDirection, force: number): number => {
  const amount = clamp(force, 10, 100);
  return direction === "left" ? -amount : amount;
};

const resolveCharacters = (
  charsetName: FireCharset | undefined | string
): string =>
  (charsetName && CHARSETS[charsetName as FireCharset]) ||
  CHARSETS[DEFAULT_CHARSET_KEY];

const resolvePalette = (
  palette: PaletteMode | undefined | string,
  shades: readonly string[] | undefined
): readonly string[] => {
  if (palette === "color") return COLOR_PALETTE;
  if (palette === "custom") {
    return shades && shades.length > 0 ? shades : COLOR_PALETTE;
  }
  if (palette === "mono") return MONO_PALETTE;
  return MONO_PALETTE;
};

const seedFuel = (
  heat: Float32Array,
  columns: number,
  rows: number,
  config: FireConfig,
  elapsedSeconds: number
): void => {
  const pulseMultiplier = config.pulse
    ? 0.88 + Math.sin(elapsedSeconds * 2.2) * 0.12
    : 1;
  const fuelRows = clamp(Math.round(config.thickness), 1, Math.max(1, rows - 1));
  const baseHeat = clamp(config.intensity / 100, 0.05, 1) * pulseMultiplier;

  for (let rowOffset = 0; rowOffset < fuelRows; rowOffset += 1) {
    const row = rows - 1 - rowOffset;
    const rowStrength = 1 - rowOffset / Math.max(fuelRows * 2, 1);

    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const flicker = 0.58 + Math.random() * 0.42;
      heat[index] = clamp(baseHeat * rowStrength * flicker, 0, 1);
    }
  }
};

const propagateFire = (
  heat: Float32Array,
  nextHeat: Float32Array,
  columns: number,
  rows: number,
  config: FireConfig
): void => {
  nextHeat.fill(0);
  const windOffset = config.wind / 50;
  const turbulence = config.turbulence / 100;
  const cooling = config.decay / 1000;

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const randomDrift = (Math.random() - 0.5) * (1.5 + turbulence * 5);
      const sourceColumn = clamp(
        Math.round(column - windOffset + randomDrift),
        0,
        columns - 1
      );
      const rowBelow = (row + 1) * columns;
      const rowTwoBelow = Math.min(row + 2, rows - 1) * columns;
      const sideDirection = Math.random() < 0.5 ? -1 : 1;
      const side =
        rowBelow + clamp(sourceColumn + sideDirection, 0, columns - 1);
      const center = rowBelow + sourceColumn;
      const deep = rowTwoBelow + sourceColumn;
      let carriedHeat =
        heat[center] * 0.58 + heat[side] * 0.16 + heat[deep] * 0.26;
      const randomCooling =
        cooling * (0.2 + Math.random() * (1.3 + turbulence * 2));

      if (Math.random() < turbulence * 0.08) {
        carriedHeat *= 0.45 + Math.random() * 0.35;
      }

      nextHeat[row * columns + column] = clamp(carriedHeat - randomCooling, 0, 1);
    }
  }

  const fuelStart = Math.max(0, rows - Math.round(config.thickness));
  nextHeat.set(heat.subarray(fuelStart * columns), fuelStart * columns);
};

const updateParticles = (
  particles: FireParticle[],
  columns: number,
  rows: number,
  config: FireConfig
): FireParticle[] => {
  const updatedParticles = particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.velocityX + config.wind / 500,
      y: particle.y + particle.velocityY,
      velocityX:
        particle.velocityX + (Math.random() - 0.5) * (config.turbulence / 300),
      heat: particle.heat * (particle.kind === "spark" ? 0.985 : 0.94),
      life: particle.life - 1,
    }))
    .filter(
      (particle) =>
        particle.life > 0 &&
        particle.y >= 0 &&
        particle.x >= 0 &&
        particle.x < columns
    );

  const sourceColumns = Array.from({ length: columns }, (_, index) => index);
  const spawnParticle = (isSpark: boolean): void => {
    const sourceColumn =
      sourceColumns[Math.floor(Math.random() * sourceColumns.length)] ?? 0;
    const life = isSpark ? 20 + Math.random() * 24 : 22 + Math.random() * 28;
    updatedParticles.push({
      kind: isSpark ? "spark" : "ember",
      glyph: isSpark ? (Math.random() < 0.5 ? "'" : "|") : ".",
      x: sourceColumn + (Math.random() - 0.5) * 2,
      y: rows - Math.max(2, config.thickness),
      velocityX: (Math.random() - 0.5) * (isSpark ? 0.45 : 0.16),
      velocityY: isSpark
        ? -(0.8 + Math.random() * 0.8)
        : -(0.16 + Math.random() * 0.24),
      heat: isSpark ? 1.2 : 0.76,
      life,
      maxLife: life,
    });
  };

  if (config.embers && Math.random() < 0.2 * 2.4) spawnParticle(false);
  if (config.sparks && Math.random() < 0.07 * 2.4) spawnParticle(true);

  return updatedParticles.slice(-Math.max(40, Math.round(columns * 1.5)));
};

/* -------------------------------------------------------------------------- */
/*                            the per-frame draw                              */
/* -------------------------------------------------------------------------- */

/**
 * The grid is drawn, not laid out.
 *
 * This began as `element.innerHTML = ...` every frame — ~46 KB of markup and
 * ~1,150 `<span>`s per fire, re-parsed and re-laid-out from scratch. Reusing
 * the nodes removed the parsing, but measurement showed the real cost was never
 * parsing: it was style recalculation and layout of those spans, 520 ms of every
 * 4 s with two fires mounted, which no amount of node reuse can avoid while the
 * glyphs live in the DOM.
 *
 * On a canvas the same glyphs cost paint alone — no style invalidation and no
 * layout at all. Runs of identical colour are still coalesced, so a row becomes
 * a handful of `fillText` calls rather than one per cell, and runs that are pure
 * spaces are skipped entirely.
 */
type GridMetrics = {
  cellWidth: number;
  cellHeight: number;
  fontPx: number;
  fontFamily: string;
};

const renderFire = (
  context: CanvasRenderingContext2D,
  metrics: GridMetrics,
  heat: Float32Array,
  particles: FireParticle[],
  columns: number,
  rows: number,
  charsetName: FireCharset,
  palette: readonly string[],
  sparkColor: string
): void => {
  const displayHeat = new Float32Array(heat);
  const particleGlyphs = new Map<number, { color: string; glyph: string }>();
  const safePalette = palette && palette.length > 0 ? palette : MONO_PALETTE;
  const resolvedSparkColor =
    sparkColor ||
    safePalette[safePalette.length - 1] ||
    COLOR_PALETTE[COLOR_PALETTE.length - 1];

  for (const particle of particles) {
    const column = clamp(Math.round(particle.x), 0, columns - 1);
    const row = clamp(Math.round(particle.y), 0, rows - 1);
    const fade = particle.life / particle.maxLife;
    const index = row * columns + column;
    displayHeat[index] = Math.max(displayHeat[index], particle.heat * fade);
    if (particle.kind === "spark" || !particleGlyphs.has(index)) {
      particleGlyphs.set(index, {
        color:
          particle.kind === "spark"
            ? resolvedSparkColor
            : safePalette[Math.max(0, safePalette.length - 3)],
        glyph: particle.glyph,
      });
    }
  }

  const characters = resolveCharacters(charsetName);
  const { cellWidth, cellHeight, fontPx, fontFamily } = metrics;

  context.clearRect(0, 0, columns * cellWidth, rows * cellHeight);
  context.font = `${fontPx}px ${fontFamily}`;
  context.textBaseline = "top";

  for (let row = 0; row < rows; row += 1) {
    let activeColor = "";
    let run = "";
    let runStart = 0;
    const y = row * cellHeight;

    const flushRun = (): void => {
      // Runs with no colour are the cells below the visibility threshold, and
      // those are always spaces — nothing to paint.
      if (run && activeColor) {
        context.fillStyle = activeColor;
        context.fillText(run, runStart * cellWidth, y);
      }
      run = "";
    };

    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const value = displayHeat[index];
      const particleGlyph = particleGlyphs.get(index);
      const characterIndex = clamp(
        Math.floor(value * (characters.length - 1)),
        0,
        characters.length - 1
      );
      const paletteIndex = clamp(
        Math.floor(Math.pow(value, 0.72) * (safePalette.length - 1)),
        0,
        safePalette.length - 1
      );
      const color =
        particleGlyph?.color ?? (value < 0.025 ? "" : safePalette[paletteIndex]);
      const character =
        particleGlyph?.glyph ?? (value < 0.025 ? " " : characters[characterIndex]);

      if (color !== activeColor) {
        flushRun();
        activeColor = color;
        runStart = column;
      }
      run += character;
    }

    flushRun();
  }
};

export default function AsciiFire(props: Props) {
  const {
    intensity = DEFAULT_FIRE_OPTIONS.intensity,
    windDirection = DEFAULT_FIRE_OPTIONS.windDirection,
    windForce = DEFAULT_FIRE_OPTIONS.windForce,
    decay = DEFAULT_FIRE_OPTIONS.decay,
    turbulence = DEFAULT_FIRE_OPTIONS.turbulence,
    thickness = DEFAULT_FIRE_OPTIONS.thickness,
    embers = DEFAULT_FIRE_OPTIONS.embers,
    sparks = DEFAULT_FIRE_OPTIONS.sparks,
    pulse = DEFAULT_FIRE_OPTIONS.pulse,
    palette = DEFAULT_FIRE_OPTIONS.palette,
    shades = DEFAULT_FIRE_OPTIONS.shades,
    sparkColor = DEFAULT_FIRE_OPTIONS.sparkColor,
    charset = DEFAULT_FIRE_OPTIONS.charset,
    backgroundColor = DEFAULT_FIRE_OPTIONS.backgroundColor,
    style,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const wind = resolveWind(windDirection, windForce);
  const activePalette = resolvePalette(palette, shades);
  const activeSparkColor =
    palette === "custom" ? sparkColor : activePalette[activePalette.length - 1];

  useEffect(() => {
    const container = containerRef.current;
    const output = outputRef.current;
    if (!container || !output) return;
    const context = output.getContext("2d");
    if (!context) return;

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    const measurementContext = document.createElement("canvas").getContext("2d");
    let animationFrameId = 0;
    let isActive = true;
    let columns = 1;
    let rows = 1;
    const fontFamily =
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    const metrics: GridMetrics = {
      cellWidth: 1,
      cellHeight: 1,
      fontPx: FONT_SIZE,
      fontFamily,
    };
    let heat = new Float32Array(1);
    let nextHeat = new Float32Array(1);
    let particles: FireParticle[] = [];
    let previousFrameTime = 0;
    let startTime = performance.now();

    const config: FireConfig = {
      intensity,
      wind,
      decay,
      turbulence,
      thickness,
      embers,
      sparks,
      pulse,
    };

    const handleResize = (): void => {
      const bounds = container.getBoundingClientRect();
      const width = Math.max(bounds.width, container.clientWidth) || 600;
      const height = Math.max(bounds.height, container.clientHeight) || 600;

      const lineHeight = FONT_SIZE * 1.05;
      if (measurementContext) {
        measurementContext.font = `${FONT_SIZE}px ${fontFamily}`;
      }
      const characterWidth =
        measurementContext?.measureText("M").width || FONT_SIZE * 0.6;
      let nextColumns = Math.max(1, Math.floor(width / characterWidth));
      let nextRows = Math.max(1, Math.floor(height / lineHeight));

      // Thin the grid on large viewports rather than letting the cell count —
      // and with it the per-frame cost — scale with the window area. The cells
      // are stretched back over the panel below, so the fire still fills it;
      // the glyphs are simply a little larger.
      const cells = nextColumns * nextRows;
      if (cells > MAX_CELLS) {
        const shrink = Math.sqrt(MAX_CELLS / cells);
        nextColumns = Math.max(1, Math.floor(nextColumns * shrink));
        nextRows = Math.max(1, Math.floor(nextRows * shrink));
      }

      // Cells are sized from the panel rather than from the font, so the grid
      // always spans it exactly however much it was thinned. The glyph size
      // follows the cell width, using the ratio measured at FONT_SIZE.
      metrics.cellWidth = width / nextColumns;
      metrics.cellHeight = height / nextRows;
      metrics.fontPx = (metrics.cellWidth / characterWidth) * FONT_SIZE;

      // Backing store in device pixels, CSS box in layout pixels; the transform
      // lets everything below draw in the latter. Capped at 2x because the
      // glyphs gain nothing visible beyond it and fill cost is quadratic.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      output.width = Math.max(1, Math.round(width * dpr));
      output.height = Math.max(1, Math.round(height * dpr));
      output.style.width = `${width}px`;
      output.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (nextColumns === columns && nextRows === rows) return;

      columns = nextColumns;
      rows = nextRows;
      heat = new Float32Array(columns * rows);
      nextHeat = new Float32Array(columns * rows);
      particles = [];

      for (let warmUpStep = 0; warmUpStep < Math.min(rows, 48); warmUpStep += 1) {
        seedFuel(heat, columns, rows, config, warmUpStep / FPS);
        propagateFire(heat, nextHeat, columns, rows, config);
        [heat, nextHeat] = [nextHeat, heat];
      }

      renderFire(
        context,
        metrics,
        heat,
        particles,
        columns,
        rows,
        charset,
        activePalette,
        activeSparkColor
      );
    };

    const drawFrame = (timestamp: number): void => {
      const frameInterval = 1000 / FPS;
      const elapsedSinceFrame = timestamp - previousFrameTime;

      if (elapsedSinceFrame >= frameInterval || previousFrameTime === 0) {
        const elapsedSeconds = (timestamp - startTime) / 1000;
        seedFuel(heat, columns, rows, config, elapsedSeconds);
        propagateFire(heat, nextHeat, columns, rows, config);
        [heat, nextHeat] = [nextHeat, heat];
        particles = updateParticles(particles, columns, rows, config);
        renderFire(
          context,
          metrics,
          heat,
          particles,
          columns,
          rows,
          charset,
          activePalette,
          activeSparkColor
        );
        previousFrameTime = timestamp - (elapsedSinceFrame % frameInterval);
      }

      // Reduced motion renders one settled frame and stops. Clearing the flag
      // as well as returning means a later resume knows the loop is not live.
      if (reducedMotionQuery.matches) {
        looping = false;
        return;
      }
      animationFrameId = window.requestAnimationFrame(drawFrame);
    };

    const handleMotionPreferenceChange = (): void => {
      stopLoop();
      startTime = performance.now();
      sync();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();
    void document.fonts.ready.then(() => {
      if (isActive) handleResize();
    });
    reducedMotionQuery.addEventListener("change", handleMotionPreferenceChange);

    // Each frame re-serialises the whole grid into HTML and forces the browser
    // to re-parse, re-style, lay out and paint several thousand spans. That is
    // by far the most expensive thing on the page, so it must not run for a
    // fire nobody can see — and there are two of these mounted at once, neither
    // of which is on screen for most of the page.
    let onScreen = false;
    let looping = false;

    const startLoop = (): void => {
      if (looping || !isActive) return;
      looping = true;
      // Resume from now, or the elapsed-time check fires a burst of catch-up
      // frames for the entire time it was parked.
      previousFrameTime = 0;
      animationFrameId = window.requestAnimationFrame(drawFrame);
    };

    const stopLoop = (): void => {
      looping = false;
      window.cancelAnimationFrame(animationFrameId);
    };

    const sync = (): void => {
      if (onScreen && !document.hidden) startLoop();
      else stopLoop();
    };

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        onScreen = entries[entries.length - 1].isIntersecting;
        sync();
      },
      // A little margin so it is already running by the time it scrolls in.
      { rootMargin: "200px 0px" }
    );
    intersectionObserver.observe(container);
    document.addEventListener("visibilitychange", sync);

    return () => {
      isActive = false;
      looping = false;
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reducedMotionQuery.removeEventListener(
        "change",
        handleMotionPreferenceChange
      );
    };
  }, [
    intensity,
    wind,
    decay,
    turbulence,
    thickness,
    embers,
    sparks,
    pulse,
    activePalette,
    activeSparkColor,
    charset,
  ]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: 600,
        height: 600,
        minHeight: 128,
        overflow: "hidden",
        backgroundColor,
        ...style,
      }}
    >
      <canvas
        ref={outputRef}
        role="img"
        aria-label="Animated ASCII wall of fire"
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
