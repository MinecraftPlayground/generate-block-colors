import type { RGBColor } from './rgb_color.ts';

/**
 * Computes the average color of a decoded PNG's pixel buffer ([r,g,b,a,...]).
 * Fully transparent pixels (alpha === 0) are skipped so empty texture areas
 * don't skew the result.
 */
export function averageColor(body : Uint8Array) : RGBColor | undefined {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let i = 0; i < body.length; i += 4) {
    if (body[i + 3] === 0) continue;
    sumR += body[i];
    sumG += body[i + 1];
    sumB += body[i + 2];
    count++;
  }

  if (count === 0) return undefined;

  return {
    r: Math.round(sumR / count),
    g: Math.round(sumG / count),
    b: Math.round(sumB / count),
  };
}


