import type { BlockModel } from './block_model.ts';

/** Reads and parses a block model json file, or undefined if missing/invalid. */
export async function readModel(
  assetsPath : string,
  namespace : string,
  modelPath : string
) : Promise<BlockModel | undefined> {
  const filePath = `${assetsPath}/${namespace}/models/${modelPath}.json`;
  try {
    const raw = await Deno.readTextFile(filePath);
    return JSON.parse(raw) as BlockModel;
  } catch {
    return undefined;
  }
}
