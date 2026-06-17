/**
 * Sloan Optotype SVG Generator with Advanced Distortion Pipeline
 * For experimental eye tests.
 * 
 * Base set: Sloan letters C, D, H, K, N, O, R, S, V, Z
 * Vector geometry defined in a 100x100 box (representing normalized 5x5 grid, where 1 unit = 20px).
 */

export interface DistortionOptions {
  contrast?: number;          // 0.3 to 1.0 (Low contrast)
  crowding?: number;          // 0.0 to 1.0 (Crowding: spacing compression)
  strokeErosion?: number;     // 0.0 to 0.15 (Stroke erosion: thinner strokes)
  microWarp?: number;         // 0.0 to 0.20 (Micro-warp: gentle bends using low-freq turbulence)
  strokeJitter?: number;      // 0.0 to 0.20 (Edge jitter: wobbly margins using high-freq turbulence)
  segmentDropout?: number;    // 0 to 3 (Segment dropout: random cuts using SVG masks)
  gaussianBlur?: number;      // 0.0 to 2.0 (Gaussian blur: optical focus degradation)
  visualNoise?: number;       // 0.0 to 0.25 (Visual noise: background grain matrix)
  temporalFlashing?: number;  // 0 to 5 (Temporal flashing: frequency in Hz, 0 is static)
  seed?: number;              // LCG seed
}

export type PresetName = "mild" | "moderate" | "hard";

export const PRESETS: Record<PresetName, Required<DistortionOptions>> = {
  mild: {
    contrast: 0.9,
    crowding: 0.2,
    strokeErosion: 0.02,
    microWarp: 0.03,
    strokeJitter: 0.02,
    segmentDropout: 0,
    gaussianBlur: 0.3,
    visualNoise: 0.04,
    temporalFlashing: 0,
    seed: 42
  },
  moderate: {
    contrast: 0.65,
    crowding: 0.6,
    strokeErosion: 0.07,
    microWarp: 0.09,
    strokeJitter: 0.08,
    segmentDropout: 1,
    gaussianBlur: 1.0,
    visualNoise: 0.10,
    temporalFlashing: 0,
    seed: 1337
  },
  hard: {
    contrast: 0.4,
    crowding: 0.9,
    strokeErosion: 0.13,
    microWarp: 0.18,
    strokeJitter: 0.16,
    segmentDropout: 2,
    gaussianBlur: 1.8,
    visualNoise: 0.18,
    temporalFlashing: 0,
    seed: 9999
  }
};

// Sloan letters vector paths inside a 100x100 grid (standard stroke width = 20)
const SLOAN_PATHS: Record<string, string> = {
  C: "M 88.7 40 A 40 40 0 1 0 88.7 60",
  D: "M 10 10 L 50 10 A 40 40 0 0 1 50 90 L 10 90 Z",
  H: "M 10 10 L 10 90 M 90 10 L 90 90 M 10 50 L 90 50",
  K: "M 10 10 L 10 90 M 90 10 L 10 50 M 35 37.5 L 90 90",
  N: "M 10 10 L 10 90 M 10 10 L 90 90 M 90 10 L 90 90",
  O: "M 50 10 A 40 40 0 1 1 49.9 10 Z",
  R: "M 10 10 L 10 90 M 10 10 L 50 10 A 20 20 0 0 1 50 50 L 10 50 M 30 50 L 90 90",
  S: "M 80 25 C 80 10 20 10 20 35 C 20 60 80 40 80 65 C 80 90 20 90 20 75",
  V: "M 10 10 L 50 90 L 90 10",
  Z: "M 10 10 L 90 10 L 10 90 L 90 90"
};

const BASE_LETTERS = Object.keys(SLOAN_PATHS);

/**
 * Seeded Pseudo-Random Number Generator (LCG)
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = Math.abs(seed) || 1;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) % 4294967296;
    return this.state / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  choice<T>(arr: T[]): T {
    const idx = Math.floor(this.next() * arr.length);
    return arr[idx];
  }
}

/**
 * Resolves options with potential preset names
 */
function resolveOptions(opts?: DistortionOptions | PresetName): Required<DistortionOptions> {
  const defaults: Required<DistortionOptions> = {
    contrast: 1.0,
    crowding: 0.0,
    strokeErosion: 0.0,
    microWarp: 0.0,
    strokeJitter: 0.0,
    segmentDropout: 0,
    gaussianBlur: 0.0,
    visualNoise: 0.0,
    temporalFlashing: 0,
    seed: Math.floor(Math.random() * 100000)
  };

  if (typeof opts === "string") {
    if (opts in PRESETS) {
      return { ...defaults, ...PRESETS[opts as PresetName] };
    }
    return defaults;
  }

  return { ...defaults, ...opts };
}

/**
 * Helper to generate random dropouts (mask elements subtraction)
 */
function generateDropoutsMarkup(count: number, maskId: string, rng: SeededRandom | typeof Math): string {
  if (count <= 0) return "";
  let markup = `<mask id="${maskId}">`;
  markup += `<rect x="-50" y="-50" width="200" height="200" fill="white" />`;
  
  for (let i = 0; i < count; i++) {
    const cx = "range" in rng ? rng.range(20, 80) : 20 + rng.random() * 60;
    const cy = "range" in rng ? rng.range(20, 80) : 20 + rng.random() * 60;
    const r = "range" in rng ? rng.range(8, 14) : 8 + rng.random() * 6; // slightly larger dropout for distinct cuts
    markup += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="black" />`;
  }
  
  markup += `</mask>`;
  return markup;
}

/**
 * Helper to generate the distortion filter markup combining Jitter, Warp, and Blur
 */
function generateFilterMarkup(filterId: string, jitter: number, warp: number, blur: number): string {
  let markup = `<filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">`;
  let currentIn = "SourceGraphic";

  // 1. Micro-warp: Low frequency turbulence (creates gentle bends)
  if (warp > 0) {
    const scaleVal = (warp * 90).toFixed(1);
    markup += `<feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" result="warpNoise" />`;
    markup += `<feDisplacementMap in="${currentIn}" in2="warpNoise" scale="${scaleVal}" xChannelSelector="R" yChannelSelector="G" result="warped" />`;
    currentIn = "warped";
  }
  
  // 2. Stroke Jitter: High frequency turbulence (creates rough/wobbly borders)
  if (jitter > 0) {
    const scaleVal = (jitter * 60).toFixed(1);
    markup += `<feTurbulence type="fractalNoise" baseFrequency="0.12" numOctaves="3" result="jitterNoise" />`;
    markup += `<feDisplacementMap in="${currentIn}" in2="jitterNoise" scale="${scaleVal}" xChannelSelector="R" yChannelSelector="G" result="jittered" />`;
    currentIn = "jittered";
  }
  
  // 3. Gaussian Blur: Optical blur
  if (blur > 0) {
    const stdDev = blur.toFixed(2);
    markup += `<feGaussianBlur in="${currentIn}" stdDeviation="${stdDev}" result="blurred" />`;
    currentIn = "blurred";
  }
  
  markup += `</filter>`;
  return markup;
}

/**
 * Helper to generate background visual noise filter and element
 */
function generateNoiseMarkup(noiseId: string, noiseOpacity: number): { filter: string; rect: string } {
  if (noiseOpacity <= 0) return { filter: "", rect: "" };
  
  const filter = `<filter id="${noiseId}">
    <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="1" result="grain" />
    <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 ${noiseOpacity.toFixed(3)} 0" />
  </filter>`;
  
  const rect = `<rect width="100%" height="100%" filter="url(#${noiseId})" pointer-events="none" />`;
  return { filter, rect };
}

/**
 * Helper to generate temporal flashing style block
 */
function generateFlashingMarkup(cssId: string, hz: number): string {
  if (hz <= 0) return "";
  const period = (1 / hz).toFixed(3);
  return `<style>
    @keyframes flash-${cssId} {
      0%, 49.9% { opacity: 1.0; }
      50%, 100% { opacity: 0.10; }
    }
    .flashing-${cssId} {
      animation: flash-${cssId} ${period}s infinite steps(1, end);
    }
  </style>`;
}

/**
 * 1. Generates a single Sloan letter SVG string with full distortion pipeline
 */
export function generateOptotype(
  letter: string,
  options?: DistortionOptions | PresetName
): { svg: string; metadata: any } {
  const resolvedLetter = letter.toUpperCase();
  const path = SLOAN_PATHS[resolvedLetter] || SLOAN_PATHS.O; // Fallback to O
  const opts = resolveOptions(options);

  const rng = opts.seed !== undefined ? new SeededRandom(opts.seed) : Math;

  const uid = opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 1000000);
  const filterId = `optotype-filter-${uid}`;
  const maskId = `optotype-mask-${uid}`;
  const noiseId = `optotype-noise-${uid}`;

  // Compute values
  const strokeWidth = (20 * (1 - opts.strokeErosion)).toFixed(2);
  const strokeColorVal = Math.round(255 * (1 - opts.contrast));
  const strokeColor = `rgb(${strokeColorVal}, ${strokeColorVal}, ${strokeColorVal})`;

  // Filters & Masks markup
  const filterMarkup = generateFilterMarkup(filterId, opts.strokeJitter, opts.microWarp, opts.gaussianBlur);
  const maskMarkup = generateDropoutsMarkup(opts.segmentDropout, maskId, rng);
  const { filter: noiseFilter, rect: noiseRect } = generateNoiseMarkup(noiseId, opts.visualNoise);
  const flashingMarkup = generateFlashingMarkup(`${uid}`, opts.temporalFlashing);

  const hasFilter = opts.strokeJitter > 0 || opts.microWarp > 0 || opts.gaussianBlur > 0;
  const hasMask = opts.segmentDropout > 0;
  const isFlashing = opts.temporalFlashing > 0;

  const transform = `translate(50, 50) translate(-50, -50)`;

  // Build SVG string
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" style="background: transparent; overflow: hidden;">
  <defs>
    ${filterMarkup}
    ${maskMarkup}
    ${noiseFilter}
    ${flashingMarkup}
  </defs>
  ${noiseRect}
  <g class="${isFlashing ? `flashing-${uid}` : ""}">
    <path d="${path}" 
          fill="none" 
          stroke="${strokeColor}" 
          stroke-width="${strokeWidth}" 
          stroke-linecap="butt" 
          stroke-linejoin="miter" 
          transform="${transform}" 
          ${hasFilter ? `filter="url(#${filterId})"` : ""} 
          ${hasMask ? `mask="url(#${maskId})"` : ""} />
  </g>
</svg>`;

  const metadata = {
    letter: resolvedLetter,
    actualLetter: resolvedLetter in SLOAN_PATHS ? resolvedLetter : "O (fallback)",
    options: opts
  };

  return { svg, metadata };
}

/**
 * 2. Generates a row of optotypes with crowding compression and individual distortions
 */
export function generateChartRow(
  letters: string | string[],
  options?: DistortionOptions | PresetName
): { svg: string; metadata: any } {
  const lettersArray = Array.isArray(letters) ? letters : letters.split("");
  const opts = resolveOptions(options);

  const rng = opts.seed !== undefined ? new SeededRandom(opts.seed) : Math;

  // Crowding scales horizontal spacing
  // spacingScale ranges from 1.2 (no crowding) down to 0.7 (heavy crowding)
  const spacingScale = 1.2 - opts.crowding * 0.5;

  const letterSize = 100;
  const spacing = letterSize * spacingScale;
  const rowWidth = lettersArray.length * letterSize + (lettersArray.length - 1) * spacing;
  const rowHeight = 120; // 100px letter + 10px padding top/bottom

  let defsMarkup = "";
  let elementsMarkup = "";
  const itemMetadata: any[] = [];

  // Define global noise overlay if visualNoise is set
  const noiseUid = opts.seed !== undefined ? opts.seed + 100 : Math.floor(Math.random() * 1000000);
  const { filter: noiseFilter, rect: noiseRect } = generateNoiseMarkup(`row-noise-${noiseUid}`, opts.visualNoise);
  defsMarkup += noiseFilter;

  lettersArray.forEach((letter, index) => {
    const itemSeed = "range" in rng ? Math.floor(rng.range(1, 999999)) : Math.floor(Math.random() * 999999);
    
    const itemOpts = { ...opts, seed: itemSeed };
    const { metadata: itemMeta } = generateOptotype(letter, itemOpts);
    itemMetadata.push(itemMeta);

    const filterId = `row-filter-${index}-${itemSeed}`;
    const maskId = `row-mask-${index}-${itemSeed}`;

    const path = SLOAN_PATHS[letter.toUpperCase()] || SLOAN_PATHS.O;
    const strokeWidth = (20 * (1 - opts.strokeErosion)).toFixed(2);
    const strokeColorVal = Math.round(255 * (1 - opts.contrast));
    const strokeColor = `rgb(${strokeColorVal}, ${strokeColorVal}, ${strokeColorVal})`;

    const filterMarkup = generateFilterMarkup(filterId, opts.strokeJitter, opts.microWarp, opts.gaussianBlur);
    const maskMarkup = generateDropoutsMarkup(opts.segmentDropout, maskId, new SeededRandom(itemSeed));
    const flashingMarkup = generateFlashingMarkup(`row-${index}-${itemSeed}`, opts.temporalFlashing);

    defsMarkup += `\n    ${filterMarkup}\n    ${maskMarkup}\n    ${flashingMarkup}`;

    const hasFilter = opts.strokeJitter > 0 || opts.microWarp > 0 || opts.gaussianBlur > 0;
    const hasMask = opts.segmentDropout > 0;
    const isFlashing = opts.temporalFlashing > 0;
    
    const xOffset = index * (letterSize + spacing);
    const transform = `translate(${xOffset + 50}, 60) translate(-50, -50)`;

    elementsMarkup += `
  <g id="letter-group-${index}" class="${isFlashing ? `flashing-row-${index}-${itemSeed}` : ""}">
    <path d="${path}" 
          fill="none" 
          stroke="${strokeColor}" 
          stroke-width="${strokeWidth}" 
          stroke-linecap="butt" 
          stroke-linejoin="miter" 
          transform="${transform}" 
          ${hasFilter ? `filter="url(#${filterId})"` : ""} 
          ${hasMask ? `mask="url(#${maskId})"` : ""} />
  </g>`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rowWidth} ${rowHeight}" width="100%" height="${rowHeight}" style="background: transparent; overflow: hidden;">
  <defs>${defsMarkup}
  </defs>
  ${noiseRect}
  ${elementsMarkup}
</svg>`;

  const metadata = {
    letters: lettersArray,
    width: rowWidth,
    height: rowHeight,
    options: opts,
    items: itemMetadata
  };

  return { svg, metadata };
}

export interface ChartLevelInput {
  acuity: string; 
  letters: string[];
  options: DistortionOptions | PresetName;
  scale: number; 
}

/**
 * 3. Generates a multi-level, complete test chart (Snellen-style stack)
 */
export function generateTestChart(
  levels: number | ChartLevelInput[],
  seed?: number
): { svg: string; metadata: any } {
  const chartSeed = seed !== undefined ? seed : Math.floor(Math.random() * 100000);
  const rng = new SeededRandom(chartSeed);

  let finalLevels: ChartLevelInput[] = [];

  if (typeof levels === "number") {
    const standardLevels = [
      { acuity: "6/60", count: 1, scale: 1.0, preset: "mild" as PresetName },
      { acuity: "6/30", count: 2, scale: 0.5, preset: "mild" as PresetName },
      { acuity: "6/20", count: 3, scale: 0.33, preset: "moderate" as PresetName },
      { acuity: "6/12", count: 4, scale: 0.2, preset: "moderate" as PresetName },
      { acuity: "6/9",  count: 5, scale: 0.15, preset: "hard" as PresetName },
      { acuity: "6/6",  count: 5, scale: 0.1, preset: "hard" as PresetName }
    ];

    const count = Math.min(levels, standardLevels.length);

    for (let i = 0; i < count; i++) {
      const def = standardLevels[i];
      const rowLetters: string[] = [];
      for (let j = 0; j < def.count; j++) {
        rowLetters.push(rng.choice(BASE_LETTERS));
      }

      const basePreset = PRESETS[def.preset];
      const customOpts: DistortionOptions = {
        contrast: rng.range(basePreset.contrast * 0.9, Math.min(1.0, basePreset.contrast * 1.1)),
        crowding: rng.range(basePreset.crowding * 0.8, basePreset.crowding * 1.2),
        strokeErosion: rng.range(basePreset.strokeErosion * 0.8, basePreset.strokeErosion * 1.2),
        microWarp: rng.range(basePreset.microWarp * 0.7, basePreset.microWarp * 1.3),
        strokeJitter: rng.range(basePreset.strokeJitter * 0.7, basePreset.strokeJitter * 1.3),
        segmentDropout: basePreset.segmentDropout,
        gaussianBlur: rng.range(basePreset.gaussianBlur * 0.7, basePreset.gaussianBlur * 1.3),
        visualNoise: rng.range(basePreset.visualNoise * 0.8, basePreset.visualNoise * 1.2),
        temporalFlashing: basePreset.temporalFlashing,
        seed: Math.floor(rng.range(1, 999999))
      };

      finalLevels.push({
        acuity: def.acuity,
        letters: rowLetters,
        options: customOpts,
        scale: def.scale
      });
    }
  } else {
    finalLevels = levels;
  }

  const chartWidth = 800;
  const rowSpacing = 35; 
  let currentY = 20;

  let defsMarkup = "";
  let groupsMarkup = "";
  let overlayNoiseMarkup = "";
  const levelsMetadata: any[] = [];

  finalLevels.forEach((level, levelIdx) => {
    const levelOpts = resolveOptions(level.options);
    const { svg: rowSvg, metadata: rowMeta } = generateChartRow(level.letters, levelOpts);
    
    levelsMetadata.push({
      acuity: level.acuity,
      scale: level.scale,
      rowMeta
    });

    // Extract defs
    const defsStart = rowSvg.indexOf("<defs>") + 6;
    const defsEnd = rowSvg.indexOf("</defs>");
    const extractedDefs = defsStart > 5 && defsEnd > defsStart ? rowSvg.substring(defsStart, defsEnd) : "";
    defsMarkup += extractedDefs;

    // Extract path/g elements (excluding noise rect which we place globally)
    const elementsStart = rowSvg.indexOf("</defs>") + 7;
    const elementsEnd = rowSvg.lastIndexOf("</svg>");
    let extractedElements = elementsStart > 6 && elementsEnd > elementsStart ? rowSvg.substring(elementsStart, elementsEnd) : "";
    
    // Remove individual noise rect if present so we can stack them cleanly
    extractedElements = extractedElements.replace(/<rect[^>]*filter="url\(#row-noise-[^"]*\)"[^>]*\/>/g, "");

    const rowRawWidth = rowMeta.width;
    const scaledRowWidth = rowRawWidth * level.scale;
    const xTranslate = (chartWidth - scaledRowWidth) / 2;

    groupsMarkup += `
  <!-- Row ${levelIdx + 1} (${level.acuity}) -->
  <g id="chart-row-${levelIdx}" transform="translate(${xTranslate.toFixed(1)}, ${currentY.toFixed(1)}) scale(${level.scale.toFixed(3)})">
    ${extractedElements}
  </g>`;

    // Add noise overlay specifically for this row's bounding box region in the global SVG
    if (levelOpts.visualNoise > 0) {
      const rowNoiseId = `chart-row-noise-${levelIdx}-${chartSeed}`;
      const scaledRowHeight = 120 * level.scale;
      
      defsMarkup += `<filter id="${rowNoiseId}">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="1" result="grain" />
        <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 ${levelOpts.visualNoise.toFixed(3)} 0" />
      </filter>`;
      
      overlayNoiseMarkup += `<rect x="${xTranslate.toFixed(1)}" y="${currentY.toFixed(1)}" width="${scaledRowWidth.toFixed(1)}" height="${scaledRowHeight.toFixed(1)}" filter="url(#${rowNoiseId})" pointer-events="none" />`;
    }

    currentY += 120 * level.scale + rowSpacing;
  });

  const chartHeight = currentY + 20;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${chartWidth} ${chartHeight}" width="100%" height="${chartHeight}" style="background: #ffffff; overflow: hidden; font-family: monospace;">
  <defs>${defsMarkup}
  </defs>
  ${groupsMarkup}
  ${overlayNoiseMarkup}
</svg>`;

  const metadata = {
    chartSeed,
    width: chartWidth,
    height: chartHeight,
    levels: levelsMetadata
  };

  return { svg, metadata };
}
