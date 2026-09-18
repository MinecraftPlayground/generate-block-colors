import type { RGBColor } from './rgb_color.ts';

/** Formats an RGB color as a "#rrggbb" hex string. */
export function toHex(color : RGBColor): string {
  const channel = (value: number): string => value.toString(16).padStart(2, '0');
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}
