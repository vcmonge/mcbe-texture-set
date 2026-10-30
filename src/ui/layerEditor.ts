import {
  type ColorValue,
  LAYER_VALUE_KINDS,
  LayerKey,
  type TextureSetConfig,
  ValueKind,
  suggestedValue,
} from "../models/textureSet";
import { ColorEditor } from "./colorEditor";
import { h, icon } from "./dom";
import { SegmentedControl } from "./segmented";

export const LAYER_LABELS: Record<LayerKey, string> = {
  [LayerKey.COLOR]: "Color",
  [LayerKey.NORMAL]: "Normal map",
  [LayerKey.HEIGHTMAP]: "Heightmap",
  [LayerKey.MER]: "MER",
  [LayerKey.MERS]: "MERS",
};

type Mode = "texture" | "color";
type ColorFormat = "array" | "hex";
type Channels = "rgb" | "rgba";

function isHexKind(kind: ValueKind): boolean {
  return kind === ValueKind.HEX_RGB || kind === ValueKind.HEX_RGBA;
}

function hasAlpha(kind: ValueKind): boolean {
  return kind === ValueKind.RGBA || kind === ValueKind.HEX_RGBA;
}

function colorKind(format: ColorFormat, channels: Channels): ValueKind {
  if (format === "hex") {
    return channels === "rgba" ? ValueKind.HEX_RGBA : ValueKind.HEX_RGB;
  }
  return channels === "rgba" ? ValueKind.RGBA : ValueKind.RGB;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return h("div", "option-field", h("span", "option-label", label), control);
}

const CHANNEL_HINTS: Partial<Record<LayerKey, string>> = {
  [LayerKey.COLOR]: "Flat color applied to the whole surface.",
  [LayerKey.MER]: "R = metalness · G = emissive · B = roughness",
  [LayerKey.MERS]: "R = metalness · G = emissive · B = roughness · A = subsurface",
};

/** Editor for a layer value: texture name or color. */
export class LayerEditor {
  readonly element: HTMLElement;

  private readonly layer: LayerKey;
  private readonly config: TextureSetConfig;
  private readonly onChange: () => void;
  private readonly allowedKinds: readonly ValueKind[];
  private readonly modeControl: SegmentedControl<Mode> | null = null;
  private readonly formatControl: SegmentedControl<ColorFormat>;
  private readonly channelsControl: SegmentedControl<Channels>;
  private readonly formatField: HTMLElement;
  private readonly channelsField: HTMLElement;
  /** Last color kind used, restored when switching from Texture back to Color. */
  private lastColorKind: ValueKind | null;
  private readonly textPanel: HTMLElement;
  private readonly textInput: HTMLInputElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly fileHint: HTMLElement;
  private readonly colorEditor: ColorEditor;
  private readonly errorElement: HTMLElement;

  constructor(layer: LayerKey, config: TextureSetConfig, onChange: () => void) {
    this.layer = layer;
    this.config = config;
    this.onChange = onChange;
    this.element = h("div", "layer-editor");
    this.element.dataset.layer = layer;

    this.allowedKinds = LAYER_VALUE_KINDS[layer];
    const colorKinds = this.allowedKinds.filter((kind) => kind !== ValueKind.TEXTURE_NAME);
    this.lastColorKind = colorKinds.find(isHexKind) ?? colorKinds[0] ?? null;

    const toolbar = h("div", "layer-toolbar");
    if (colorKinds.length > 0) {
      this.modeControl = new SegmentedControl<Mode>(
        `${LAYER_LABELS[layer]} value`,
        [
          { value: "texture", label: "Texture" },
          { value: "color", label: "Color" },
        ],
        (mode) => {
          const kind = mode === "texture" ? ValueKind.TEXTURE_NAME : this.lastColorKind;
          if (kind) {
            this.applyKind(kind);
          }
        },
        "segmented-sm",
      );
      toolbar.append(this.modeControl.element);
    }

    this.formatControl = new SegmentedControl<ColorFormat>(
      "JSON format",
      [
        { value: "array", label: "Array" },
        { value: "hex", label: "Hex" },
      ],
      (format) => {
        const current = config.layers[layer].kind;
        this.applyKind(colorKind(format, hasAlpha(current) ? "rgba" : "rgb"));
      },
      "segmented-sm",
    );
    this.channelsControl = new SegmentedControl<Channels>(
      "Channels",
      [
        { value: "rgb", label: "RGB" },
        { value: "rgba", label: "RGBA" },
      ],
      (channels) => {
        const current = config.layers[layer].kind;
        this.applyKind(colorKind(isHexKind(current) ? "hex" : "array", channels));
      },
      "segmented-sm",
    );
    this.formatField = labeled("JSON format", this.formatControl.element);
    this.channelsField = labeled("Channels", this.channelsControl.element);
    // Only the Color layer lets you choose between RGB and RGBA.
    const alphaChoice =
      colorKinds.some(hasAlpha) && colorKinds.some((kind) => !hasAlpha(kind));
    toolbar.append(this.formatField);
    if (alphaChoice) {
      toolbar.append(this.channelsField);
    }
    if (toolbar.childElementCount > 0) {
      this.element.append(toolbar);
    }

    this.textInput = h("input", "text-input mono");
    this.textInput.type = "text";
    this.textInput.autocomplete = "off";
    this.textInput.spellcheck = false;
    this.textInput.placeholder = "file_name";
    this.textInput.setAttribute("aria-label", `${LAYER_LABELS[layer]} texture`);
    this.textInput.addEventListener("input", () => {
      config.layers[layer].setValue(this.textInput.value);
      onChange();
    });

    this.resetButton = h("button", "icon-button", icon("reset"));
    this.resetButton.type = "button";
    this.resetButton.title = "Use the suggested name";
    this.resetButton.setAttribute("aria-label", "Use the suggested name");
    this.resetButton.addEventListener("click", () => {
      config.layers[layer].setValue(suggestedValue(config.textureName, layer));
      onChange();
      this.textInput.focus();
    });

    this.fileHint = h("p", "field-hint");
    this.textPanel = h(
      "div",
      "layer-text",
      h("div", "input-group", this.textInput, this.resetButton),
      this.fileHint,
    );

    this.colorEditor = new ColorEditor((color: ColorValue) => {
      config.layers[layer].setValue(color);
      onChange();
    }, CHANNEL_HINTS[layer]);

    this.errorElement = h("p", "field-error");
    this.element.append(this.textPanel, this.colorEditor.element, this.errorElement);
  }

  refresh(error?: string): void {
    const layerConfig = this.config.layers[this.layer];
    const value = layerConfig.value();
    const isColor = layerConfig.kind !== ValueKind.TEXTURE_NAME;

    this.modeControl?.setValue(isColor ? "color" : "texture");
    this.textPanel.hidden = isColor;
    this.colorEditor.element.hidden = !isColor;
    this.formatField.hidden = !isColor;
    this.channelsField.hidden = !isColor;

    if (isColor) {
      this.lastColorKind = layerConfig.kind;
      this.formatControl.setValue(isHexKind(layerConfig.kind) ? "hex" : "array");
      this.channelsControl.setValue(hasAlpha(layerConfig.kind) ? "rgba" : "rgb");
      this.colorEditor.configure(layerConfig.kind);
      this.colorEditor.setColor(Array.isArray(value) ? value : [255, 255, 255]);
    } else {
      const text = typeof value === "string" ? value : "";
      if (this.textInput.value !== text) {
        this.textInput.value = text;
      }
      const suggestion = suggestedValue(this.config.textureName, this.layer);
      this.resetButton.hidden = !this.config.textureName.trim() || text === suggestion;
      const file = text.trim();
      if (file) {
        this.fileHint.replaceChildren(
          "Expected image: ",
          h("code", "", `${file}.png`),
          " or ",
          h("code", "", ".tga"),
          ", in the same folder.",
        );
      } else {
        this.fileHint.textContent = "Image file name, without extension.";
      }
    }

    this.errorElement.textContent = error ?? "";
    this.errorElement.hidden = !error;
    this.textInput.classList.toggle("is-invalid", Boolean(error) && !isColor);
  }

  /** Changes the value kind, keeping the color when switching between color formats. */
  private applyKind(kind: ValueKind): void {
    if (!this.allowedKinds.includes(kind)) {
      return;
    }
    const layerConfig = this.config.layers[this.layer];
    const previous = layerConfig.value();
    this.config.setLayerKind(this.layer, kind);
    if (kind !== ValueKind.TEXTURE_NAME && Array.isArray(previous)) {
      const [r = 255, g = 255, b = 255, a = 255] = previous;
      layerConfig.setValue(hasAlpha(kind) ? [r, g, b, a] : [r, g, b]);
    }
    this.onChange();
  }

  focus(): void {
    if (this.config.layers[this.layer].kind === ValueKind.TEXTURE_NAME) {
      this.textInput.focus();
    } else {
      this.colorEditor.focus();
    }
  }
}
