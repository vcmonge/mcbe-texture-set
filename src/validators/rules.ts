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
    return [{ field: "texture_name", message: "El nombre de la textura no puede estar vacío." }];
  }
  if (WINDOWS_INVALID_FILENAME.test(name) || name.endsWith(".") || name.endsWith(" ")) {
    return [
      {
        field: "texture_name",
        message: "El nombre contiene caracteres no válidos para un archivo de Windows.",
      },
    ];
  }
  const baseName = name.toUpperCase().split(".")[0] ?? "";
  if (WINDOWS_RESERVED_NAMES.has(baseName)) {
    return [{ field: "texture_name", message: "El nombre de archivo está reservado por Windows." }];
  }
  return [];
}

function validateValue(layer: LayerKey, kind: ValueKind, value: unknown): ValidationError[] {
  const field = layer;
  if (kind === ValueKind.TEXTURE_NAME) {
    if (typeof value !== "string" || !value.trim()) {
      return [{ field, message: `${layer} debe tener un nombre de textura.` }];
    }
    return [];
  }

  const expectedChannels = kind === ValueKind.RGB || kind === ValueKind.HEX_RGB ? 3 : 4;
  if (!Array.isArray(value) || value.length !== expectedChannels) {
    const label = expectedChannels === 3 ? "RGB" : "RGBA";
    return [{ field, message: `${layer} debe contener un color ${label} válido.` }];
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
    return [{ field, message: `Cada canal de ${layer} debe ser un entero entre 0 y 255.` }];
  }
  return [];
}

export function validateConfig(config: TextureSetConfig): ValidationError[] {
  const errors = validateTextureName(config.textureName);
  if (!FORMAT_VERSIONS.includes(config.version)) {
    errors.push({ field: "version", message: "La versión de formato no es compatible." });
  }

  const color = config.layers[LayerKey.COLOR];
  if (!color.enabled) {
    errors.push({ field: "color", message: "La capa color es obligatoria." });
  }

  const normal = config.layers[LayerKey.NORMAL];
  const heightmap = config.layers[LayerKey.HEIGHTMAP];
  const mer = config.layers[LayerKey.MER];
  const mers = config.layers[LayerKey.MERS];
  if (normal.enabled && heightmap.enabled) {
    errors.push({ field: "relief", message: "normal y heightmap no pueden coexistir." });
  }
  if (mer.enabled && mers.enabled) {
    errors.push({ field: "materials", message: "MER y MERS no pueden coexistir." });
  }
  if (mers.enabled && config.version !== FormatVersion.V1_21_30) {
    errors.push({ field: "mers", message: "MERS requiere la versión 1.21.30." });
  }

  for (const layer of LAYER_KEYS) {
    const layerConfig = config.layers[layer];
    if (!layerConfig.enabled) {
      continue;
    }
    if (!LAYER_VALUE_KINDS[layer].includes(layerConfig.kind)) {
      errors.push({ field: layer, message: "El tipo de valor no es compatible con esta capa." });
      continue;
    }
    errors.push(...validateValue(layer, layerConfig.kind, layerConfig.value()));
  }
  return errors;
}
