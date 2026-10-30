import {
  type ColorValue,
  LAYER_VALUE_KINDS,
  LayerKey,
  type TextureSetConfig,
  ValueKind,
} from "../models/textureSet";
import { ColorEditor } from "./colorEditor";

export const LAYER_LABELS: Record<LayerKey, string> = {
  [LayerKey.COLOR]: "Color (obligatorio)",
  [LayerKey.NORMAL]: "Normal",
  [LayerKey.HEIGHTMAP]: "Mapa de alturas",
  [LayerKey.MER]: "MER",
  [LayerKey.MERS]: "MERS",
};

export const LAYER_TOOLTIPS: Record<LayerKey, string> = {
  [LayerKey.COLOR]: "Textura o color base. Esta capa siempre se incluye.",
  [LayerKey.NORMAL]: "Mapa de normales para el relieve de la textura.",
  [LayerKey.HEIGHTMAP]: "Mapa de alturas; no puede usarse junto con Normal.",
  [LayerKey.MER]: "Metalness, emissive y roughness.",
  [LayerKey.MERS]: "Metalness, emissive, roughness y subsurface.",
};

export const VALUE_KIND_LABELS: Record<ValueKind, string> = {
  [ValueKind.TEXTURE_NAME]: "Nombre de textura",
  [ValueKind.RGB]: "Arreglo RGB",
  [ValueKind.RGBA]: "Arreglo RGBA",
  [ValueKind.HEX_RGB]: "Color hexadecimal RGB",
  [ValueKind.HEX_RGBA]: "Color hexadecimal RGBA",
};

function isColorKind(kind: ValueKind): boolean {
  return kind !== ValueKind.TEXTURE_NAME;
}

export class LayerRow {
  readonly element: HTMLElement;

  private readonly layer: LayerKey;
  private readonly config: TextureSetConfig;
  private readonly onChange: () => void;

  private readonly checkbox: HTMLInputElement;
  private readonly kindSelect: HTMLSelectElement;
  private readonly editorBody: HTMLElement;
  private readonly textInput: HTMLInputElement;
  private readonly colorEditor: ColorEditor;
  private readonly noteElement: HTMLElement;

  private syncing = false;

  constructor(
    layer: LayerKey,
    config: TextureSetConfig,
    onChange: () => void,
  ) {
    this.layer = layer;
    this.config = config;
    this.onChange = onChange;

    this.element = document.createElement("div");
    this.element.className = "layer-row";
    this.element.dataset.layer = layer;

    const header = document.createElement("div");
    header.className = "layer-header";

    const titleGroup = document.createElement("div");
    titleGroup.className = "layer-title-group";

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "layer-toggle-label";
    toggleLabel.title = LAYER_TOOLTIPS[layer];

    this.checkbox = document.createElement("input");
    this.checkbox.type = "checkbox";
    this.checkbox.className = "layer-checkbox";
    this.checkbox.addEventListener("change", () => {
      this.handleEnabledChanged();
    });

    const nameSpan = document.createElement("span");
    nameSpan.className = "layer-name";
    nameSpan.textContent =
      layer === LayerKey.COLOR ? "Color" : LAYER_LABELS[layer];

    toggleLabel.append(this.checkbox, nameSpan);

    if (layer === LayerKey.COLOR) {
      const badge = document.createElement("span");
      badge.className = "layer-badge";
      badge.textContent = "Obligatorio";
      toggleLabel.append(badge);
    }

    const description = document.createElement("p");
    description.className = "layer-description";
    description.textContent = LAYER_TOOLTIPS[layer];

    titleGroup.append(toggleLabel, description);

    this.kindSelect = document.createElement("select");
    this.kindSelect.className = "layer-kind-select";
    this.kindSelect.setAttribute(
      "aria-label",
      `Tipo de valor para ${LAYER_LABELS[layer]}`,
    );

    const allowedKinds = LAYER_VALUE_KINDS[layer];
    for (const valueKind of allowedKinds) {
      const option = document.createElement("option");
      option.value = valueKind;
      option.textContent = VALUE_KIND_LABELS[valueKind];
      this.kindSelect.append(option);
    }

    if (allowedKinds.length <= 1) {
      this.kindSelect.title = "Esta capa solo admite nombre de textura.";
    }

    this.kindSelect.addEventListener("change", () => {
      this.handleKindChanged();
    });

    header.append(titleGroup, this.kindSelect);

    this.editorBody = document.createElement("div");
    this.editorBody.className = "layer-editor-body";

    this.textInput = document.createElement("input");
    this.textInput.type = "text";
    this.textInput.className = "layer-text-input";
    this.textInput.placeholder = "Nombre de textura";
    this.textInput.autocomplete = "off";
    this.textInput.spellcheck = false;
    this.textInput.setAttribute(
      "aria-label",
      `Nombre de textura para ${LAYER_LABELS[layer]}`,
    );
    this.textInput.addEventListener("input", () => {
      this.handleTextChanged();
    });

    this.colorEditor = new ColorEditor((color: ColorValue) => {
      this.handleColorChanged(color);
    });

    this.noteElement = document.createElement("p");
    this.noteElement.className = "layer-note";
    if (layer === LayerKey.MERS) {
      this.noteElement.textContent =
        "Al activarla se selecciona automáticamente la versión 1.21.30.";
    }

    this.editorBody.append(
      this.textInput,
      this.colorEditor.element,
      this.noteElement,
    );

    this.element.append(header, this.editorBody);
    this.refresh();
  }

  refresh(): void {
    this.syncing = true;
    try {
      const layerConfig = this.config.layers[this.layer];
      const isEnabled = layerConfig.enabled;

      this.checkbox.checked = isEnabled;
      if (this.layer === LayerKey.COLOR) {
        this.checkbox.disabled = true;
        this.checkbox.title = "La capa color es obligatoria.";
      } else {
        this.checkbox.disabled = false;
        this.checkbox.title = LAYER_TOOLTIPS[this.layer];
      }

      this.element.classList.toggle("layer-row-active", isEnabled);
      this.element.classList.toggle("layer-row-inactive", !isEnabled);

      this.kindSelect.value = layerConfig.kind;
      this.showValue(layerConfig.kind);

      this.kindSelect.disabled = !isEnabled;
      this.kindSelect.hidden = !isEnabled;
      this.kindSelect.classList.toggle("hidden", !isEnabled);

      this.editorBody.hidden = !isEnabled;
      this.editorBody.classList.toggle("hidden", !isEnabled);

      const hasNote = Boolean(this.noteElement.textContent);
      const showNote = isEnabled && hasNote;
      this.noteElement.hidden = !showNote;
      this.noteElement.classList.toggle("hidden", !showNote);
    } finally {
      this.syncing = false;
    }
  }

  private showValue(kind: ValueKind): void {
    const layerConfig = this.config.layers[this.layer];
    const currentValue = layerConfig.value();
    const isColor = isColorKind(kind);

    this.textInput.hidden = isColor;
    this.textInput.classList.toggle("hidden", isColor);

    this.colorEditor.element.hidden = !isColor;
    this.colorEditor.element.classList.toggle("hidden", !isColor);

    if (isColor) {
      this.colorEditor.configure(kind);
      const colorTuple = Array.isArray(currentValue)
        ? (currentValue as ColorValue)
        : [255, 255, 255];
      this.colorEditor.setColor(colorTuple);
    } else {
      const textVal = typeof currentValue === "string" ? currentValue : "";
      if (this.textInput.value !== textVal) {
        this.textInput.value = textVal;
      }
    }
  }

  private handleEnabledChanged(): void {
    if (this.syncing) {
      return;
    }
    this.config.setLayerEnabled(this.layer, this.checkbox.checked);
    this.onChange();
  }

  private handleKindChanged(): void {
    if (this.syncing) {
      return;
    }
    const kind = this.kindSelect.value as ValueKind;
    this.config.setLayerKind(this.layer, kind);
    this.showValue(kind);
    this.onChange();
    if (isColorKind(kind)) {
      window.setTimeout(() => {
        this.colorEditor.openPalette();
      }, 0);
    }
  }

  private handleTextChanged(): void {
    if (this.syncing) {
      return;
    }
    this.config.layers[this.layer].setValue(this.textInput.value);
    this.onChange();
  }

  private handleColorChanged(color: ColorValue): void {
    if (this.syncing) {
      return;
    }
    this.config.layers[this.layer].setValue(color);
    this.onChange();
  }
}
