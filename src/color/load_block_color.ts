import { Image } from '@cross/image';
import { Blockstate } from '../blockstate/blockstate.ts';
import { getDefaultModel } from '../blockstate/get_default_model.ts';
import { resolveModelTextures } from '../model/resolve_model_textures.ts';
import { parseResourceLocation } from '../parse_resource_location.ts';
import { pickTopTexture } from '../texture/pick_top_texture.ts';
import { averageColor } from './average_color.ts';
import { toHex } from './to_hex.ts';

export async function loadBlockColor(assetsPath: string, blockstatePath: string): Promise<string | undefined> {
  const raw = await Deno.readTextFile(blockstatePath);
  const blockstate = JSON.parse(raw) as Blockstate;

  const modelRef = getDefaultModel(blockstate);
  if (modelRef === undefined) return undefined;

  const model = parseResourceLocation(modelRef);
  const textures = await resolveModelTextures(assetsPath, model.namespace, model.path);

  const topTexture = pickTopTexture(textures);
  if (topTexture === undefined) return undefined;

  const texture = parseResourceLocation(topTexture, model.namespace);
  const texturePath = `${assetsPath}/${texture.namespace}/textures/${texture.path}.png`;

  const bytes = await Deno.readFile(texturePath);
  const image = await Image.decode(bytes);

  const color = averageColor(image.data);
  return color === undefined ? undefined : toHex(color);
}
