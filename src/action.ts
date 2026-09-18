import * as actionsCore from '@actions/core';
import { decodePNG } from '@img/png'

const pathInput = actionsCore.getInput('path');
const versionInput = actionsCore.getInput('version');

console.log('path:', pathInput);
console.log('version:', versionInput);

interface BlockStateFile {
  variants?: Record<string, ModelRef | ModelRef[]>;
  multipart?: MultipartPart[];
}

interface MultipartPart {
  when?: Condition;
  apply: ModelRef | ModelRef[];
}

interface Condition {
  OR?: Condition[];
  [key: string]: unknown;
}

interface ModelRef {
  model: string;
  uvlock?: boolean;
  x?: number;
  y?: number;
  z?: number;
  weight?: number;
}

interface ModelFile {
  parent?: string;
  textures?: Record<string, string>;
  elements?: ModelElement[];
}

interface ModelElement {
  from?: number[];
  to?: number[];
  faces?: Record<string, ModelFace>;
}

interface ModelFace {
  texture: string;
  tintindex?: number;
  uv?: number[];
  rotation?: number;
}

type ColorResult = string | Record<string, string>;

const NAMESPACE = "minecraft";

/* -------------------------------------------------------------------------- */
/* PATHS                                                                      */
/* -------------------------------------------------------------------------- */

function normalizePath(path: string): string {
  return path
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function joinPath(...parts: string[]): string {
  return parts
    .map((part) =>
      part
        .replaceAll("\\", "/")
        .replace(/^\/+|\/+$/g, "")
    )
    .filter(Boolean)
    .join("/");
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(
    await Deno.readTextFile(path),
  ) as T;
}

/* -------------------------------------------------------------------------- */
/* PNG                                                                        */
/* -------------------------------------------------------------------------- */

function rgbaToHex(
  r: number,
  g: number,
  b: number,
  a: number,
): string {
  return (
    "#" +
    [r, g, b, a]
      .map((value) =>
        value.toString(16).padStart(2, "0")
      )
      .join("")
  );
}

/**
 * Reads a PNG and calculates its representative RGBA color.
 *
 * Transparent pixels are ignored.
 */
async function readPngColor(
  path: string,
): Promise<string> {
  const bytes = await Deno.readFile(path);

  const image = decodePNG(bytes);

  const pixels = (await image).body;

  if (pixels.length === 0) {
    return "#00000000";
  }

  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  let count = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    if (a === 0) {
      continue;
    }

    red += r;
    green += g;
    blue += b;
    alpha += a;
    count++;
  }

  if (count === 0) {
    return "#00000000";
  }

  return rgbaToHex(
    Math.round(red / count),
    Math.round(green / count),
    Math.round(blue / count),
    Math.round(alpha / count),
  );
}

/* -------------------------------------------------------------------------- */
/* RESOURCE LOCATIONS                                                         */
/* -------------------------------------------------------------------------- */

function modelPath(
  root: string,
  model: string,
): string {
  model = model.replace(/^#/, "");

  const [namespace, name] = model.includes(":")
    ? model.split(":", 2)
    : [NAMESPACE, model];

  return joinPath(
    root,
    "assets",
    namespace,
    "models",
    `${name}.json`,
  );
}

function texturePath(
  root: string,
  texture: string,
): string {
  texture = texture.replace(/^#/, "");

  const [namespace, name] = texture.includes(":")
    ? texture.split(":", 2)
    : [NAMESPACE, texture];

  return joinPath(
    root,
    "assets",
    namespace,
    "textures",
    `${name}.png`,
  );
}

/* -------------------------------------------------------------------------- */
/* MODELS                                                                     */
/* -------------------------------------------------------------------------- */

async function loadModel(
  root: string,
  modelName: string,
  cache: Map<string, ModelFile>,
  stack = new Set<string>(),
): Promise<ModelFile> {
  const cached = cache.get(modelName);

  if (cached) {
    return cached;
  }

  if (stack.has(modelName)) {
    throw new Error(
      `Circular model parent chain: ${
        [...stack, modelName].join(" -> ")
      }`,
    );
  }

  stack.add(modelName);

  const path = modelPath(
    root,
    modelName,
  );

  if (!(await exists(path))) {
    throw new Error(
      `Model does not exist: ${modelName}`,
    );
  }

  const own = await readJson<ModelFile>(
    path,
  );

  let model: ModelFile = {
    ...own,
    textures: {
      ...(own.textures ?? {}),
    },
    elements: own.elements
      ? [...own.elements]
      : undefined,
  };

  if (own.parent) {
    const parent = await loadModel(
      root,
      own.parent,
      cache,
      stack,
    );

    model = {
      ...parent,
      ...own,

      textures: {
        ...(parent.textures ?? {}),
        ...(own.textures ?? {}),
      },

      elements:
        own.elements !== undefined
          ? own.elements
          : parent.elements,
    };
  }

  stack.delete(modelName);

  cache.set(modelName, model);

  return model;
}

function findUpFace(
  model: ModelFile,
): ModelFace | undefined {
  if (!model.elements) {
    return undefined;
  }

  let best:
    | {
        face: ModelFace;
        height: number;
      }
    | undefined;

  for (const element of model.elements) {
    const face = element.faces?.up;

    if (!face) {
      continue;
    }

    const height = element.to?.[1] ?? 16;

    if (!best || height > best.height) {
      best = {
        face,
        height,
      };
    }
  }

  return best?.face;
}

/* -------------------------------------------------------------------------- */
/* TEXTURES                                                                   */
/* -------------------------------------------------------------------------- */

function resolveTexture(
  texture: string,
  textures: Record<string, string>,
): string {
  let current = texture;

  const visited = new Set<string>();

  while (current.startsWith("#")) {
    if (visited.has(current)) {
      throw new Error(
        `Circular texture reference: ${current}`,
      );
    }

    visited.add(current);

    const key = current.slice(1);
    const value = textures[key];

    if (!value) {
      throw new Error(
        `Could not resolve texture reference: ${current}`,
      );
    }

    current = value;
  }

  return current;
}

async function getModelTopColor(
  root: string,
  modelRef: ModelRef,
  modelCache: Map<string, ModelFile>,
  textureCache: Map<string, string>,
): Promise<string | undefined> {
  const model = await loadModel(
    root,
    modelRef.model,
    modelCache,
  );

  const upFace = findUpFace(model);

  if (!upFace) {
    return undefined;
  }

  const texture = resolveTexture(
    upFace.texture,
    model.textures ?? {},
  );

  const path = texturePath(
    root,
    texture,
  );

  let color = textureCache.get(path);

  if (!color) {
    if (!(await exists(path))) {
      throw new Error(
        `Texture does not exist: ${texture}`,
      );
    }

    color = await readPngColor(path);

    textureCache.set(path, color);
  }

  return color;
}

/* -------------------------------------------------------------------------- */
/* BLOCKSTATES                                                                */
/* -------------------------------------------------------------------------- */

function parseVariantKey(
  key: string,
): Record<string, string> {
  if (!key.trim()) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const part of key.split(",")) {
    const separator = part.indexOf("=");

    if (separator === -1) {
      continue;
    }

    result[part.slice(0, separator)] =
      part.slice(separator + 1);
  }

  return result;
}

function collectPropertyValues(
  blockstate: BlockStateFile,
): Map<string, string[]> {
  const values =
    new Map<string, Set<string>>();

  const add = (
    property: string,
    value: string,
  ) => {
    if (!values.has(property)) {
      values.set(
        property,
        new Set(),
      );
    }

    values.get(property)!.add(value);
  };

  for (const key of Object.keys(
    blockstate.variants ?? {},
  )) {
    const variant =
      parseVariantKey(key);

    for (
      const [property, value] of
      Object.entries(variant)
    ) {
      for (
        const singleValue of
        value.split("|")
      ) {
        add(
          property,
          singleValue,
        );
      }
    }
  }

  for (
    const part of
    blockstate.multipart ?? []
  ) {
    collectConditionValues(
      part.when,
      add,
    );
  }

  return new Map(
    [...values.entries()].map(
      ([property, set]) => [
        property,
        [...set],
      ],
    ),
  );
}

function collectConditionValues(
  condition: Condition | undefined,
  add: (
    property: string,
    value: string,
  ) => void,
): void {
  if (!condition) {
    return;
  }

  if (condition.OR) {
    for (const child of condition.OR) {
      collectConditionValues(
        child,
        add,
      );
    }
  }

  for (
    const [property, expected] of
    Object.entries(condition)
  ) {
    if (property === "OR") {
      continue;
    }

    if (typeof expected === "string") {
      for (
        const value of
        expected.split("|")
      ) {
        add(property, value);
      }
    }

    if (Array.isArray(expected)) {
      for (const value of expected) {
        add(
          property,
          String(value),
        );
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* BLOCKSTATE MATCHING                                                        */
/* -------------------------------------------------------------------------- */

function matchesVariant(
  variant: string,
  state: Record<string, string>,
): boolean {
  const requirements =
    parseVariantKey(variant);

  for (
    const [property, expected] of
    Object.entries(requirements)
  ) {
    const actual = state[property];

    if (actual === undefined) {
      return false;
    }

    if (
      !expected
        .split("|")
        .includes(actual)
    ) {
      return false;
    }
  }

  return true;
}

function matchesCondition(
  condition: Condition | undefined,
  state: Record<string, string>,
): boolean {
  if (!condition) {
    return true;
  }

  if (condition.OR) {
    return condition.OR.some(
      (child) =>
        matchesCondition(
          child,
          state,
        ),
    );
  }

  for (
    const [property, expected] of
    Object.entries(condition)
  ) {
    if (property === "OR") {
      continue;
    }

    const actual = state[property];

    if (actual === undefined) {
      return false;
    }

    if (typeof expected === "string") {
      if (
        !expected
          .split("|")
          .includes(actual)
      ) {
        return false;
      }
    }

    if (Array.isArray(expected)) {
      if (
        !expected
          .map(String)
          .includes(actual)
      ) {
        return false;
      }
    }
  }

  return true;
}

function selectModels(
  blockstate: BlockStateFile,
  state: Record<string, string>,
): ModelRef[] {
  const result: ModelRef[] = [];

  for (
    const [variant, models] of
    Object.entries(
      blockstate.variants ?? {},
    )
  ) {
    if (
      !matchesVariant(
        variant,
        state,
      )
    ) {
      continue;
    }

    if (Array.isArray(models)) {
      result.push(...models);
    } else {
      result.push(models);
    }
  }

  for (
    const part of
    blockstate.multipart ?? []
  ) {
    if (
      !matchesCondition(
        part.when,
        state,
      )
    ) {
      continue;
    }

    if (Array.isArray(part.apply)) {
      result.push(...part.apply);
    } else {
      result.push(part.apply);
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* STATE -> COLOR                                                             */
/* -------------------------------------------------------------------------- */

async function getStateColor(
  root: string,
  blockstate: BlockStateFile,
  state: Record<string, string>,
  modelCache: Map<string, ModelFile>,
  textureCache: Map<string, string>,
): Promise<string> {
  const models = selectModels(
    blockstate,
    state,
  );

  for (const model of models) {
    const color =
      await getModelTopColor(
        root,
        model,
        modelCache,
        textureCache,
      );

    if (color !== undefined) {
      return color;
    }
  }

  return "#00000000";
}

/* -------------------------------------------------------------------------- */
/* STATE ENUMERATION                                                          */
/* -------------------------------------------------------------------------- */

function createCartesianStates(
  properties: string[],
  values: Map<string, string[]>,
): Record<string, string>[] {
  if (properties.length === 0) {
    return [{}];
  }

  const [
    property,
    ...remainingProperties
  ] = properties;

  const remaining =
    createCartesianStates(
      remainingProperties,
      values,
    );

  const result:
    Record<string, string>[] = [];

  for (
    const value of
    values.get(property) ?? []
  ) {
    for (const state of remaining) {
      result.push({
        ...state,
        [property]: value,
      });
    }
  }

  return result;
}

function stateKey(
  state: Record<string, string>,
): string {
  return Object.entries(state)
    .sort(([a], [b]) =>
      a.localeCompare(b)
    )
    .map(
      ([property, value]) =>
        `${property}=${value}`,
    )
    .join("|");
}

/* -------------------------------------------------------------------------- */
/* RELEVANT PROPERTIES                                                        */
/* -------------------------------------------------------------------------- */

function findRelevantProperties(
  states: Record<string, string>[],
  colors: Map<string, string>,
  properties: string[],
): string[] {
  const relevant = [...properties];

  let changed = true;

  while (changed) {
    changed = false;

    for (
      const property of [...relevant]
    ) {
      const remaining =
        relevant.filter(
          (p) => p !== property,
        );

      const groups =
        new Map<string, string>();

      let removable = true;

      for (const state of states) {
        const groupKey =
          remaining
            .map(
              (p) =>
                `${p}=${state[p]}`,
            )
            .join("|");

        const color =
          colors.get(
            stateKey(state),
          );

        if (color === undefined) {
          removable = false;
          break;
        }

        const previous =
          groups.get(groupKey);

        if (
          previous === undefined
        ) {
          groups.set(
            groupKey,
            color,
          );
          continue;
        }

        if (previous !== color) {
          removable = false;
          break;
        }
      }

      if (removable) {
        relevant.splice(
          relevant.indexOf(property),
          1,
        );

        changed = true;
      }
    }
  }

  return relevant;
}

/* -------------------------------------------------------------------------- */
/* COMPACT OUTPUT                                                             */
/* -------------------------------------------------------------------------- */

function compactColors(
  states: Record<string, string>[],
  colors: Map<string, string>,
  relevantProperties: string[],
): ColorResult {
  const allColors =
    states.map(
      (state) =>
        colors.get(
          stateKey(state),
        )!,
    );

  const uniqueColors =
    [...new Set(allColors)];

  /*
   * Nothing affects the top color.
   */
  if (uniqueColors.length === 1) {
    return uniqueColors[0];
  }

  const result:
    Record<string, string> = {};

  for (const state of states) {
    const key =
      relevantProperties
        .map(
          (property) =>
            `${property}=${state[property]}`,
        )
        .join(",");

    result[key] =
      colors.get(
        stateKey(state),
      )!;
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* BLOCK                                                                      */
/* -------------------------------------------------------------------------- */

async function processBlock(
  root: string,
  blockstate: BlockStateFile,
  modelCache: Map<string, ModelFile>,
  textureCache: Map<string, string>,
): Promise<ColorResult | undefined> {
  const propertyValues =
    collectPropertyValues(
      blockstate,
    );

  const properties =
    [...propertyValues.keys()].sort();

  if (properties.length === 0) {
    return getStateColor(
      root,
      blockstate,
      {},
      modelCache,
      textureCache,
    );
  }

  const states =
    createCartesianStates(
      properties,
      propertyValues,
    );

  if (states.length === 0) {
    return undefined;
  }

  const colors =
    new Map<string, string>();

  for (const state of states) {
    const color =
      await getStateColor(
        root,
        blockstate,
        state,
        modelCache,
        textureCache,
      );

    colors.set(
      stateKey(state),
      color,
    );
  }

  const relevantProperties =
    findRelevantProperties(
      states,
      colors,
      properties,
    );

  return compactColors(
    states,
    colors,
    relevantProperties,
  );
}

/* -------------------------------------------------------------------------- */
/* BLOCKSTATE FILES                                                           */
/* -------------------------------------------------------------------------- */

async function findBlockstateFiles(
  root: string,
): Promise<string[]> {
  const directory =
    joinPath(
      root,
      "assets",
      NAMESPACE,
      "blockstates",
    );

  if (!(await exists(directory))) {
    throw new Error(
      `Blockstate directory does not exist: ${directory}`,
    );
  }

  const files: string[] = [];

  for await (
    const entry of
    Deno.readDir(directory)
  ) {
    if (!entry.isFile) {
      continue;
    }

    if (!entry.name.endsWith(".json")) {
      continue;
    }

    files.push(
      joinPath(
        directory,
        entry.name,
      ),
    );
  }

  files.sort();

  return files;
}

function blockNameFromPath(
  path: string,
): string {
  const filename =
    path.split("/").pop()!;

  return `${NAMESPACE}:${filename.slice(
    0,
    -".json".length,
  )}`;
}

/* -------------------------------------------------------------------------- */
/* MAIN                                                                       */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const root = pathInput

  const version = versionInput

  console.log(
    `Resource pack: ${root}`,
  );

  if (version) {
    console.log(
      `Minecraft version: ${version}`,
    );
  }

  if (!(await exists(root))) {
    throw new Error(
      `Resource pack does not exist: ${root}`,
    );
  }

  const blockstateFiles =
    await findBlockstateFiles(root);

  console.log(
    `Found ${blockstateFiles.length} blockstate files.`,
  );

  const output:
    Record<string, ColorResult> = {};

  const modelCache =
    new Map<string, ModelFile>();

  const textureCache =
    new Map<string, string>();

  let processed = 0;
  let skipped = 0;

  for (const file of blockstateFiles) {
    const blockName =
      blockNameFromPath(file);

    try {
      const blockstate =
        await readJson<BlockStateFile>(
          file,
        );

      const color =
        await processBlock(
          root,
          blockstate,
          modelCache,
          textureCache,
        );

      if (color === undefined) {
        skipped++;
        continue;
      }

      output[blockName] = color;
      processed++;

      console.log(
        `[${processed}] ${blockName}`,
      );
    } catch (error) {
      skipped++;

      console.warn(
        `Skipped ${blockName}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }
  }

  const sortedOutput =
    Object.fromEntries(
      Object.entries(output).sort(
        ([a], [b]) =>
          a.localeCompare(b),
      ),
    );

  const outputPath =
    joinPath(
      root,
      "block-colors.json",
    );

  await Deno.writeTextFile(
    outputPath,
    JSON.stringify(
      sortedOutput,
      null,
      2,
    ) + "\n",
  );

  console.log("");
  console.log(
    `Processed: ${processed}`,
  );
  console.log(
    `Skipped: ${skipped}`,
  );
  console.log(
    `Models: ${modelCache.size}`,
  );
  console.log(
    `Textures: ${textureCache.size}`,
  );
  console.log(
    `Output: ${outputPath}`,
  );
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    Deno.exit(1);
  }
}
