import type { Blockstate } from './blockstate.ts';
import { firstModel } from './first_model.ts';

/**
 * Returns a representative model resource location for a blockstate.
 * Blocks with multiple variants (e.g. "facing=north") or multipart
 * definitions only yield the first matching model - an approximation
 * that is good enough for an average top-face color.
 */
export function getDefaultModel(blockstate : Blockstate): string | undefined {
  if (blockstate.variants !== undefined) {
    const firstVariant = Object.values(blockstate.variants)[0];
    if (firstVariant !== undefined) return firstModel(firstVariant);
  }

  if (blockstate.multipart !== undefined && blockstate.multipart.length > 0) {
    return firstModel(blockstate.multipart[0].apply);
  }

  return undefined;
}
