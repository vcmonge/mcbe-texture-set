export const FormatVersion = {
  V1_16_100: "1.16.100",
  V1_21_30: "1.21.30",
} as const;

export type FormatVersion = (typeof FormatVersion)[keyof typeof FormatVersion];

export const FORMAT_VERSIONS: readonly FormatVersion[] = [
  FormatVersion.V1_16_100,
  FormatVersion.V1_21_30,
];

export const LayerKey = {
  COLOR: "color",
  NORMAL: "normal",
  HEIGHTMAP: "heightmap",
  MER: "metalness_emissive_roughness",
  MERS: "metalness_emissive_roughness_subsurface",
} as const;

export type LayerKey = (typeof LayerKey)[keyof typeof LayerKey];

export const LAYER_KEYS: readonly LayerKey[] = [
  LayerKey.COLOR,
  LayerKey.NORMAL,
  LayerKey.HEIGHTMAP,
  LayerKey.MER,
  LayerKey.MERS,
];

export const ValueKind = {
  TEXTURE_NAME: "texture_name",
  RGB: "rgb",
  RGBA: "rgba",
  HEX_RGB: "hex_rgb",
  HEX_RGBA: "hex_rgba",
} as const;

export type ValueKind = (typeof ValueKind)[keyof typeof ValueKind];

export type ColorValue = readonly number[];
export type LayerValue = string | ColorValue;

export const LAYER_SUFFIXES: Record<LayerKey, string> = {
  [LayerKey.COLOR]: "",
  [LayerKey.NORMAL]: "_normal",
  [LayerKey.HEIGHTMAP]: "_heightmap",
  [LayerKey.MER]: "_mer",
  [LayerKey.MERS]: "_mers",
};

export const LAYER_VALUE_KINDS: Record<LayerKey, readonly ValueKind[]> = {
  [LayerKey.COLOR]: [
    ValueKind.TEXTURE_NAME,
    ValueKind.RGB,
    ValueKind.RGBA,
    ValueKind.HEX_RGB,
    ValueKind.HEX_RGBA,
  ],
  [LayerKey.NORMAL]: [ValueKind.TEXTURE_NAME],
  [LayerKey.HEIGHTMAP]: [ValueKind.TEXTURE_NAME],
  [LayerKey.MER]: [ValueKind.TEXTURE_NAME, ValueKind.RGB, ValueKind.HEX_RGB],
  [LayerKey.MERS]: [ValueKind.TEXTURE_NAME, ValueKind.RGBA, ValueKind.HEX_RGBA],
};

export function suggestedValue(textureName: string, layer: LayerKey): string {
  return `${textureName}${LAYER_SUFFIXES[layer]}`;
}

function defaultValues(textureName: string, layer: LayerKey): Record<ValueKind, LayerValue> {
  return {
    [ValueKind.TEXTURE_NAME]: suggestedValue(textureName, layer),
    [ValueKind.RGB]: [255, 255, 255],
    [ValueKind.RGBA]: [255, 255, 255, 255],
    [ValueKind.HEX_RGB]: [255, 255, 255],
    [ValueKind.HEX_RGBA]: [255, 255, 255, 255],
  };
}

export interface LayerConfigInit {
  enabled?: boolean;
  kind?: ValueKind;
  values?: Record<ValueKind, LayerValue>;
}

export class LayerConfig {
  enabled: boolean;
  kind: ValueKind;
  values: Record<ValueKind, LayerValue>;

  constructor(
    enabledOrInit: boolean | LayerConfigInit = false,
    kind: ValueKind = ValueKind.TEXTURE_NAME,
    values?: Record<ValueKind, LayerValue>,
  ) {
    if (typeof enabledOrInit === "object" && enabledOrInit !== null) {
      this.enabled = enabledOrInit.enabled ?? false;
      this.kind = enabledOrInit.kind ?? ValueKind.TEXTURE_NAME;
      this.values = enabledOrInit.values ?? defaultValues("", LayerKey.COLOR);
    } else {
      this.enabled = enabledOrInit;
      this.kind = kind;
      this.values = values ?? defaultValues("", LayerKey.COLOR);
    }
  }

  value(): LayerValue {
    return this.values[this.kind];
  }

  setValue(value: LayerValue): void {
    this.values[this.kind] = value;
  }
}

export interface TextureSetConfigInit {
  textureName?: string;
  version?: FormatVersion;
  layers?: Record<LayerKey, LayerConfig>;
}

function defaultLayers(
  textureName: string,
  version: FormatVersion,
): Record<LayerKey, LayerConfig> {
  return {
    [LayerKey.COLOR]: new LayerConfig(
      true,
      ValueKind.TEXTURE_NAME,
      defaultValues(textureName, LayerKey.COLOR),
    ),
    [LayerKey.NORMAL]: new LayerConfig(
      true,
      ValueKind.TEXTURE_NAME,
      defaultValues(textureName, LayerKey.NORMAL),
    ),
    [LayerKey.HEIGHTMAP]: new LayerConfig(
      false,
      ValueKind.TEXTURE_NAME,
      defaultValues(textureName, LayerKey.HEIGHTMAP),
    ),
    [LayerKey.MER]: new LayerConfig(
      version === FormatVersion.V1_16_100,
      ValueKind.TEXTURE_NAME,
      defaultValues(textureName, LayerKey.MER),
    ),
    [LayerKey.MERS]: new LayerConfig(
      version !== FormatVersion.V1_16_100,
      ValueKind.TEXTURE_NAME,
      defaultValues(textureName, LayerKey.MERS),
    ),
  };
}

export class TextureSetConfig {
  textureName: string;
  version: FormatVersion;
  layers: Record<LayerKey, LayerConfig>;

  constructor(
    textureNameOrInit: string | TextureSetConfigInit = "",
    version: FormatVersion = FormatVersion.V1_21_30,
    layers?: Record<LayerKey, LayerConfig>,
  ) {
    if (typeof textureNameOrInit === "object" && textureNameOrInit !== null) {
      const resolvedName = textureNameOrInit.textureName ?? "";
      const resolvedVersion = textureNameOrInit.version ?? FormatVersion.V1_21_30;
      this.textureName = resolvedName;
      this.version = resolvedVersion;
      this.layers = textureNameOrInit.layers ?? defaultLayers(resolvedName, resolvedVersion);
    } else {
      this.textureName = textureNameOrInit;
      this.version = version;
      this.layers = layers ?? defaultLayers(textureNameOrInit, version);
    }
  }

  setTextureName(textureName: string): void {
    this.textureName = textureName;
    for (const layer of LAYER_KEYS) {
      this.layers[layer].values[ValueKind.TEXTURE_NAME] = suggestedValue(textureName, layer);
    }
  }

  setVersion(version: FormatVersion): void {
    if (version === this.version) {
      return;
    }

    const hadMers = this.layers[LayerKey.MERS].enabled;
    this.version = version;
    if (version === FormatVersion.V1_16_100 && hadMers) {
      this.layers[LayerKey.MERS].enabled = false;
      this.layers[LayerKey.MER].enabled = true;
    }
  }

  setLayerEnabled(layer: LayerKey, enabled: boolean): void {
    if (layer === LayerKey.COLOR) {
      this.layers[layer].enabled = true;
      return;
    }

    if (layer === LayerKey.MERS && enabled) {
      this.version = FormatVersion.V1_21_30;
      this.layers[LayerKey.MER].enabled = false;
    } else if (layer === LayerKey.MER && enabled) {
      this.layers[LayerKey.MERS].enabled = false;
    } else if (layer === LayerKey.NORMAL && enabled) {
      this.layers[LayerKey.HEIGHTMAP].enabled = false;
    } else if (layer === LayerKey.HEIGHTMAP && enabled) {
      this.layers[LayerKey.NORMAL].enabled = false;
    }

    this.layers[layer].enabled = enabled;
  }

  setLayerKind(layer: LayerKey, kind: ValueKind): void {
    if (!LAYER_VALUE_KINDS[layer].includes(kind)) {
      throw new Error(`${kind} no es válido para ${layer}.`);
    }
    this.layers[layer].kind = kind;
  }
}

export function createDefaultConfig(
  version: FormatVersion = FormatVersion.V1_21_30,
): TextureSetConfig {
  return new TextureSetConfig("", version, defaultLayers("", version));
}
