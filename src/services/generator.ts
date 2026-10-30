import {
  type ColorValue,
  FormatVersion,
  LayerKey,
  type LayerValue,
  TextureSetConfig,
  ValueKind,
} from "../models/textureSet.ts";
import { ConfigurationInvalid, validateConfig } from "../validators/rules.ts";

export interface TextureSetDocument {
  format_version: FormatVersion;
  "minecraft:texture_set": Record<string, string | number[]>;
}

export const LAYER_ORDER: readonly LayerKey[] = [
  LayerKey.COLOR,
  LayerKey.NORMAL,
  LayerKey.HEIGHTMAP,
  LayerKey.MER,
  LayerKey.MERS,
];

function serializeValue(kind: ValueKind, value: LayerValue): string | number[] {
  if (kind === ValueKind.TEXTURE_NAME) {
    return value as string;
  }
  const channels = value as ColorValue;
  if (kind === ValueKind.RGB || kind === ValueKind.RGBA) {
    return [...channels];
  }
  return (
    "#" +
    channels
      .map((component) => component.toString(16).padStart(2, "0").toLowerCase())
      .join("")
  );
}

export function buildTextureSet(config: TextureSetConfig): TextureSetDocument {
  const errors = validateConfig(config);
  if (errors.length > 0) {
    throw new ConfigurationInvalid(errors);
  }

  const textureSet: Record<string, string | number[]> = {};
  for (const layer of LAYER_ORDER) {
    const layerConfig = config.layers[layer];
    if (layer === LayerKey.COLOR) {
      textureSet[layer] = config.textureName.trim();
    } else if (layerConfig.enabled) {
      textureSet[layer] = serializeValue(layerConfig.kind, layerConfig.value());
    }
  }
  return {
    format_version: config.version,
    "minecraft:texture_set": textureSet,
  };
}

export function serializeTextureSet(config: TextureSetConfig): string {
  return JSON.stringify(buildTextureSet(config), null, 2) + "\n";
}

export function outputFilename(textureName: string): string {
  return `${textureName.trim()}.texture_set.json`;
}

export function downloadTextureSet(config: TextureSetConfig): string {
  const content = serializeTextureSet(config);
  const filename = outputFilename(config.textureName);
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
  return filename;
}
