import { ResourceLocation } from './resource_location.ts';

/**
 * Parses a Minecraft resource location such as "minecraft:block/stone" or
 * "block/stone" (namespace defaults to "minecraft" when omitted).
 */
export function parseResourceLocation(value : string, defaultNamespace : string = 'minecraft') : ResourceLocation {
  const separatorIndex = value.indexOf(':');
  if (separatorIndex === -1) {
    return { namespace: defaultNamespace, path: value };
  }
  return {
    namespace: value.slice(0, separatorIndex),
    path: value.slice(separatorIndex + 1),
  };
}
