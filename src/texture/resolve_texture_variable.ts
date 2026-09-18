/** Follows "#variable" references until a concrete texture path is found. */
export function resolveTextureVariable(
  textures : Record<string, string>,
  variable : string,
  depth = 0,
) : string | undefined {
  if (depth > 10) return undefined;

  const value = textures[variable];
  if (value === undefined) return undefined;
  if (!value.startsWith('#')) return value;

  return resolveTextureVariable(textures, value.slice(1), depth + 1);
}
