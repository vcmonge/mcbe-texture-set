import {
  FORMAT_VERSIONS,
  FormatVersion,
  LAYER_KEYS,
  LAYER_VALUE_KINDS,
  LayerKey,
  TextureSetConfig,
  ValueKind,
} from "../models/textureSet.ts";

const WINDOWS_INVALID_FILENAME = /[<>:"/\\|?*\x00-\x1f]/;
const WINDOWS_RESERVED_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

export interface ValidationError {
  readonly field: string;
  readonly message: string;
}

export class ConfigurationInvalid extends Error {
  readonly errors: readonly ValidationError[];

  constructor(errors: readonly ValidationError[]) {
    super(errors.map((error) => error.message).join("\n"));
    this.name = "ConfigurationInvalid";
    this.errors = errors;
  }
}

export function validateTextureName(textureName: string): ValidationError[] {
  const name = textureName.trim();
  if (!name) {
    return [{ field: "texture_name", message: "Texture name cannot be empty." }];
  }
  if (WINDOWS_INVALID_FILENAME.test(name) || name.endsWith(".") || name.endsWith(" ")) {
    return [
      {
        field: "texture_name",
        message: "The name contains characters that are not valid in a Windows file name.",
      },
    ];
  }
  const baseName = name.toUpperCase().split(".")[0] ?? "";
  if (WINDOWS_RESERVED_NAMES.has(baseName)) {
    return [{ field: "texture_name", message: "This file name is reserved by Windows." }];
  }
  return [];
}

function validateValue(layer: LayerKey, kind: ValueKind, value: unknown): ValidationError[] {
  const field = layer;
  if (kind === ValueKind.TEXTURE_NAME) {
    if (typeof value !== "string" || !value.trim()) {
      return [{ field, message: `${layer} must have a texture name.` }];
    }
    return [];
  }

  const expectedChannels = kind === ValueKind.RGB || kind === ValueKind.HEX_RGB ? 3 : 4;
  if (!Array.isArray(value) || value.length !== expectedChannels) {
    const label = expectedChannels === 3 ? "RGB" : "RGBA";
    return [{ field, message: `${layer} must contain a valid ${label} color.` }];
  }
  if (
    value.some(
      (component) =>
        typeof component !== "number" ||
        !Number.isInteger(component) ||
        component < 0 ||
        component > 255,
    )
  ) {
    return [{ field, message: `Each ${layer} channel must be an integer between 0 and 255.` }];
  }
  return [];
}

export function validateConfig(config: TextureSetConfig): ValidationError[] {
  const errors = validateTextureName(config.textureName);
  if (!FORMAT_VERSIONS.includes(config.version)) {
    errors.push({ field: "version", message: "Unsupported format version." });
  }

  const color = config.layers[LayerKey.COLOR];
  if (!color.enabled) {
    errors.push({ field: "color", message: "The color layer is required." });
  }

  const normal = config.layers[LayerKey.NORMAL];
  const heightmap = config.layers[LayerKey.HEIGHTMAP];
  const mer = config.layers[LayerKey.MER];
  const mers = config.layers[LayerKey.MERS];
  if (normal.enabled && heightmap.enabled) {
    errors.push({ field: "relief", message: "Normal map and heightmap cannot be used together." });
  }
  if (mer.enabled && mers.enabled) {
    errors.push({ field: "materials", message: "MER and MERS cannot be used together." });
  }
  if (mers.enabled && config.version !== FormatVersion.V1_21_30) {
    errors.push({ field: "mers", message: "MERS requires format version 1.21.30." });
  }

  for (const layer of LAYER_KEYS) {
    const layerConfig = config.layers[layer];
    // The color layer takes the texture name, already validated above.
    if (!layerConfig.enabled || layer === LayerKey.COLOR) {
      continue;
    }
    if (!LAYER_VALUE_KINDS[layer].includes(layerConfig.kind)) {
      errors.push({ field: layer, message: "This value kind is not supported by this layer." });
      continue;
    }
    errors.push(...validateValue(layer, layerConfig.kind, layerConfig.value()));
  }
  return errors;
}
