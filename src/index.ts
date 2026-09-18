import * as actionsCore from '@actions/core';
import { loadBlockColor } from './color/load_block_color.ts';

const resourcePackPath = actionsCore.getInput('path');
const assetsPath = `${resourcePackPath}/assets`;
const outputPath = actionsCore.getInput('output') || 'block-colors.json';
const blockstatesDir = `${assetsPath}/minecraft/blockstates`;

const colors: Record<string, string> = {};
let skipped = 0;

for await (const entry of Deno.readDir(blockstatesDir)) {
  if (!entry.isFile || !entry.name.endsWith('.json')) continue;

  const blockId = `minecraft:${entry.name.replace(/\.json$/, '')}`;

  try {
    const color = await loadBlockColor(assetsPath, `${blockstatesDir}/${entry.name}`);
    if (color === undefined) {
      skipped++;
      continue;
    }
    colors[blockId] = color;
  } catch (error) {
    actionsCore.warning(`Could not determine a color for "${blockId}": ${(error as Error).message}`);
    skipped++;
  }
}

await Deno.writeTextFile(outputPath, JSON.stringify(colors, null, 2));

actionsCore.info(`Generated colors for ${Object.keys(colors).length} blocks (${skipped} skipped) -> ${outputPath}`);
actionsCore.setOutput('path', outputPath);
