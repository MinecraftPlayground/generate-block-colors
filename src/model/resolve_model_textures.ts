import { parseResourceLocation } from '../parse_resource_location.ts';
import { readModel } from './read_model.ts';

/**
 * Walks a model's parent chain and merges all texture variable declarations
 * into a single map (child declarations take precedence over parents).
 */
export async function resolveModelTextures(
  assetsPath : string,
  namespace : string,
  modelPath : string,
  visited : Set<string> = new Set(),
) : Promise<Record<string, string>> {
  const key = `${namespace}:${modelPath}`;
  if (visited.has(key)) return {};
  visited.add(key);

  const model = await readModel(assetsPath, namespace, modelPath);
  if (model === undefined) return {};

  let textures: Record<string, string> = {};

  if (model.parent !== undefined) {
    const parent = parseResourceLocation(model.parent, namespace);
    textures = await resolveModelTextures(assetsPath, parent.namespace, parent.path, visited);
  }

  if (model.textures !== undefined) {
    for (const [variable, target] of Object.entries(model.textures)) {
      textures[variable] = target;
    }
  }

  return textures;
}
