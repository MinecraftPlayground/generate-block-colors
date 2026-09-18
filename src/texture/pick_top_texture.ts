import { resolveTextureVariable } from './resolve_texture_variable.ts';

const TOP_FACE_VARIABLES = ['up', 'top', 'all', 'particle'];

/** Picks the texture to use for the top face of a block, with fallbacks. */
export function pickTopTexture(textures: Record<string, string>): string | undefined {
  for (const variable of TOP_FACE_VARIABLES) {
    const resolved = resolveTextureVariable(textures, variable);
    if (resolved !== undefined) return resolved;
  }

  for (const variable of Object.keys(textures)) {
    const resolved = resolveTextureVariable(textures, variable);
    if (resolved !== undefined) return resolved;
  }

  return undefined;
}
