import {
  type ColorValue,
  FormatVersion,
  LAYER_KEYS,
  LayerKey,
  type LayerValue,
  type TextureSetConfig,
  ValueKind,
  createDefaultConfig,
} from "../models/textureSet";
import {
  downloadTextureSet,
  outputFilename,
  serializeTextureSet,
} from "../services/generator";
import {
  ConfigurationInvalid,
  type ValidationError,
  validateConfig,
} from "../validators/rules";
import { h, icon } from "./dom";
import { renderJson } from "./jsonView";
import { LAYER_LABELS, LayerEditor } from "./layerEditor";
import { SegmentedControl } from "./segmented";

type Choice = "none" | LayerKey;

interface ExclusiveGroup {
  readonly element: HTMLElement;
  readonly control: SegmentedControl<Choice>;
  readonly body: HTMLElement;
  readonly options: readonly [LayerKey, LayerKey];
}

function formatPreviewLayerValue(kind: ValueKind, value: LayerValue): string | number[] {
  if (kind === ValueKind.TEXTURE_NAME) {
    return typeof value === "string" ? value : "";
  }
  const channels: ColorValue = Array.isArray(value) ? value : [255, 255, 255];
  if (kind === ValueKind.RGB || kind === ValueKind.RGBA) {
    return [...channels];
  }
  return (
    "#" +
    channels
      .map((channel) =>
        Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0"),
      )
      .join("")
  );
}

/** Final JSON when the config is valid; otherwise an approximation for the preview. */
function renderLivePreviewJson(config: TextureSetConfig): string {
  try {
    return serializeTextureSet(config).trimEnd();
  } catch {
    const textureSet: Record<string, string | number[]> = {};
    for (const layer of LAYER_KEYS) {
      const layerConfig = config.layers[layer];
      if (layerConfig.enabled) {
        textureSet[layer] = formatPreviewLayerValue(layerConfig.kind, layerConfig.value());
      }
    }
    return JSON.stringify(
      { format_version: config.version, "minecraft:texture_set": textureSet },
      null,
      2,
    );
  }
}

function isLayerKey(field: string): field is LayerKey {
  return (LAYER_KEYS as readonly string[]).includes(field);
}

function friendlyMessage(error: ValidationError): string {
  return isLayerKey(error.field)
    ? error.message.replace(error.field, LAYER_LABELS[error.field])
    : error.message;
}

export class TextureSetApp {
  readonly root: HTMLElement;
  private readonly config: TextureSetConfig;
  private readonly editors = new Map<LayerKey, LayerEditor>();

  private readonly nameInput: HTMLInputElement;
  private readonly nameHint: HTMLElement;
  private readonly versionControl: SegmentedControl<FormatVersion>;
  private readonly relief: ExclusiveGroup;
  private readonly material: ExclusiveGroup;
  private readonly materialNote: HTMLElement;
  private readonly materialNoteText: HTMLElement;
  private readonly filenameElement: HTMLElement;
  private readonly jsonCode: HTMLElement;
  private readonly statusElement: HTMLElement;
  private readonly copyButton: HTMLButtonElement;
  private readonly downloadButton: HTMLButtonElement;
  private readonly toastElement: HTMLElement;

  private nameTouched = false;
  private copyResetTimer: number | null = null;
  private toastTimer: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.config = createDefaultConfig();

    // Color always takes the texture name, so it has no editor.
    for (const layer of LAYER_KEYS) {
      if (layer !== LayerKey.COLOR) {
        this.editors.set(layer, new LayerEditor(layer, this.config, () => this.refresh()));
      }
    }

    // Header
    const header = h(
      "header",
      "app-header",
      h("h1", "brand-title", "Texture Set Generator"),
      h(
        "p",
        "brand-subtitle",
        "Set up the PBR layers for your texture and download a texture_set.json for your resource pack.",
      ),
    );

    // Step 1: name and version
    this.nameInput = h("input", "text-input input-lg mono");
    this.nameInput.id = "texture-name";
    this.nameInput.type = "text";
    this.nameInput.placeholder = "stone";
    this.nameInput.autocomplete = "off";
    this.nameInput.spellcheck = false;
    this.nameInput.setAttribute("aria-describedby", "texture-name-hint");
    this.nameInput.addEventListener("input", () => {
      this.nameTouched = true;
      this.config.setTextureName(this.nameInput.value);
      this.refresh();
    });
    this.nameHint = h("p", "field-hint");
    this.nameHint.id = "texture-name-hint";

    const nameLabel = h("label", "field-label", "Texture name");
    nameLabel.htmlFor = this.nameInput.id;

    this.versionControl = new SegmentedControl(
      "format_version",
      [
        { value: FormatVersion.V1_21_30, label: "1.21.30", hint: "Recommended · MERS only" },
        { value: FormatVersion.V1_16_100, label: "1.16.100", hint: "Legacy · MER only" },
      ],
      (version) => this.handleVersionSelected(version),
      "segmented-cards",
    );

    const stepTexture = this.card(
      "1",
      "Texture",
      "Base file name and format version.",
      h(
        "div",
        "basics-grid",
        h("div", "field", nameLabel, this.nameInput, this.nameHint),
        h(
          "div",
          "field",
          h("span", "field-label", "Format version"),
          this.versionControl.element,
        ),
      ),
    );

    // Step 2: layers
    this.relief = this.exclusiveGroup(
      "relief",
      "Surface detail",
      "Adds depth to the surface with a normal map or a heightmap.",
      [LayerKey.NORMAL, LayerKey.HEIGHTMAP],
    );

    this.materialNoteText = h("span", "");
    this.materialNote = h("p", "note", icon("info"), this.materialNoteText);
    this.material = this.exclusiveGroup(
      "material",
      "Material",
      "Metalness, emissive and roughness. MERS adds subsurface scattering.",
      [LayerKey.MER, LayerKey.MERS],
    );
    this.material.body.append(this.materialNote);

    const stepLayers = this.card(
      "2",
      "Layers",
      "Enable only the ones you need.",
      h(
        "div",
        "layer-blocks",
        this.relief.element,
        this.material.element,
      ),
    );

    // Output
    this.filenameElement = h("code", "filename-text");
    this.jsonCode = h("code", "");
    this.statusElement = h("div", "status");
    this.statusElement.setAttribute("aria-live", "polite");

    this.downloadButton = h("button", "btn btn-primary", icon("download"), "Download");
    this.downloadButton.type = "button";
    this.downloadButton.addEventListener("click", () => this.handleDownload());

    this.copyButton = h("button", "btn btn-secondary");
    this.copyButton.type = "button";
    this.setCopyLabel(false);
    this.copyButton.addEventListener("click", () => void this.handleCopy());

    const output = h(
      "aside",
      "output-col",
      h(
        "section",
        "card output-card",
        h(
          "div",
          "output-head",
          h("span", "eyebrow", "Output"),
          h("div", "filename", icon("file"), this.filenameElement),
        ),
        h("pre", "json-view", this.jsonCode),
        this.statusElement,
        h("div", "actions", this.downloadButton, this.copyButton),
        h(
          "p",
          "shortcut-hint",
          h("kbd", "", "Ctrl"),
          " + ",
          h("kbd", "", "S"),
          " to download",
        ),
      ),
    );

    this.toastElement = h("div", "toast");
    this.toastElement.setAttribute("role", "status");

    this.root.replaceChildren(
      h(
        "div",
        "app",
        header,
        h("main", "layout", h("div", "config-col", stepTexture, stepLayers), output),
      ),
      this.toastElement,
    );

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        this.handleDownload();
      }
    });

    this.refresh();
  }

  private editor(layer: LayerKey): LayerEditor {
    const editor = this.editors.get(layer);
    if (!editor) {
      throw new Error(`No editor for ${layer}.`);
    }
    return editor;
  }

  private card(step: string, title: string, description: string, content: HTMLElement): HTMLElement {
    return h(
      "section",
      "card",
      h(
        "div",
        "card-head",
        h("span", "step", step),
        h("div", "", h("h2", "card-title", title), h("p", "card-desc", description)),
      ),
      content,
    );
  }

  private layerBlock(
    accent: string,
    title: string,
    description: string,
    aside: HTMLElement,
  ): { element: HTMLElement; body: HTMLElement } {
    const body = h("div", "layer-block-body");
    const element = h(
      "div",
      "layer-block",
      h(
        "div",
        "layer-block-head",
        h(
          "div",
          "layer-block-info",
          h("h3", "layer-block-title", h("span", "layer-dot"), title),
          h("p", "layer-block-desc", description),
        ),
        aside,
      ),
      body,
    );
    element.dataset.accent = accent;
    return { element, body };
  }

  private exclusiveGroup(
    accent: string,
    title: string,
    description: string,
    options: readonly [LayerKey, LayerKey],
  ): ExclusiveGroup {
    const control = new SegmentedControl<Choice>(
      title,
      [
        { value: "none", label: "None" },
        ...options.map((layer) => ({ value: layer, label: LAYER_LABELS[layer] })),
      ],
      (choice) => this.handleGroupSelected(options, choice),
    );
    const block = this.layerBlock(accent, title, description, control.element);
    for (const layer of options) {
      block.body.append(this.editor(layer).element);
    }
    return { element: block.element, control, body: block.body, options };
  }

  private handleGroupSelected(options: readonly [LayerKey, LayerKey], choice: Choice): void {
    const previousVersion = this.config.version;
    if (choice === "none") {
      for (const layer of options) {
        this.config.setLayerEnabled(layer, false);
      }
    } else {
      this.config.setLayerEnabled(choice, true);
    }
    if (this.config.version !== previousVersion) {
      const material = this.config.layers[LayerKey.MERS].enabled ? "MERS" : "MER";
      this.showToast(`format_version switched to ${this.config.version} to use ${material}.`);
    }
    this.refresh();
  }

  private handleVersionSelected(version: FormatVersion): void {
    const hadMer = this.config.layers[LayerKey.MER].enabled;
    const hadMers = this.config.layers[LayerKey.MERS].enabled;
    this.config.setVersion(version);
    if (hadMers && !this.config.layers[LayerKey.MERS].enabled) {
      this.showToast(`MERS is not available in ${version}, switched to MER.`);
    } else if (hadMer && !this.config.layers[LayerKey.MER].enabled) {
      this.showToast(`MER is not available in ${version}, switched to MERS.`);
    }
    this.refresh();
  }

  private refresh(): void {
    const errors = validateConfig(this.config);
    const name = this.config.textureName.trim();

    this.versionControl.setValue(this.config.version);
    for (const group of [this.relief, this.material]) {
      const active = group.options.find((layer) => this.config.layers[layer].enabled);
      group.control.setValue(active ?? "none");
      group.body.hidden = active === undefined;
      for (const layer of group.options) {
        this.editor(layer).element.hidden = layer !== active;
      }
    }
    const merEnabled = this.config.layers[LayerKey.MER].enabled;
    const mersEnabled = this.config.layers[LayerKey.MERS].enabled;
    this.materialNote.hidden = !merEnabled && !mersEnabled;
    this.materialNoteText.textContent = mersEnabled
      ? "MERS requires format_version 1.21.30, it is selected automatically."
      : "MER requires format_version 1.16.100, it is selected automatically.";

    // Layer errors caused by an empty name add nothing until a name is entered.
    for (const [layer, editor] of this.editors) {
      const error = name ? errors.find((err) => err.field === layer) : undefined;
      editor.refresh(error ? friendlyMessage(error) : undefined);
    }

    const nameError = errors.find((err) => err.field === "texture_name");
    const showNameError = nameError !== undefined && this.nameTouched;
    this.nameInput.classList.toggle("is-invalid", showNameError);
    this.nameHint.classList.toggle("is-error", showNameError);
    if (showNameError) {
      this.nameHint.textContent = nameError.message;
    } else if (name) {
      this.nameHint.replaceChildren(
        "Layer prefix, e.g. ",
        h("code", "", `${name}_n`),
        ".",
      );
    } else {
      this.nameHint.textContent = "File name of the base image, without extension.";
    }

    this.filenameElement.textContent = name ? outputFilename(name) : "name.texture_set.json";
    this.filenameElement.classList.toggle("is-placeholder", !name);
    renderJson(this.jsonCode, renderLivePreviewJson(this.config));

    const isValid = errors.length === 0;
    this.copyButton.disabled = !isValid;
    this.downloadButton.disabled = !isValid;
    this.renderStatus(errors, name);
  }

  private renderStatus(errors: readonly ValidationError[], name: string): void {
    if (errors.length === 0) {
      this.statusElement.className = "status status-ok";
      this.statusElement.replaceChildren(icon("check"), h("span", "", "Ready to download"));
      return;
    }
    if (!name && !this.nameTouched) {
      this.statusElement.className = "status status-neutral";
      this.statusElement.replaceChildren(
        icon("info"),
        h("span", "", "Enter a texture name to get started."),
      );
      return;
    }

    const list = h("ul", "status-list");
    for (const error of errors) {
      const button = h("button", "link-button", friendlyMessage(error));
      button.type = "button";
      button.addEventListener("click", () => this.focusField(error.field));
      list.append(h("li", "", button));
    }
    this.statusElement.className = "status status-error";
    this.statusElement.replaceChildren(icon("alert"), list);
  }

  private focusField(field: string): void {
    if (field === "texture_name") {
      this.nameInput.focus();
    } else if (isLayerKey(field)) {
      this.editors.get(field)?.focus();
    }
  }

  private setCopyLabel(copied: boolean): void {
    this.copyButton.replaceChildren(
      icon(copied ? "check" : "copy"),
      copied ? "Copied" : "Copy JSON",
    );
  }

  private async handleCopy(): Promise<void> {
    if (validateConfig(this.config).length > 0) {
      return;
    }
    try {
      await navigator.clipboard.writeText(serializeTextureSet(this.config));
      this.setCopyLabel(true);
      if (this.copyResetTimer !== null) {
        window.clearTimeout(this.copyResetTimer);
      }
      this.copyResetTimer = window.setTimeout(() => {
        this.setCopyLabel(false);
        this.copyResetTimer = null;
      }, 1500);
    } catch {
      this.showToast("Could not copy to clipboard.", true);
    }
  }

  private handleDownload(): void {
    const errors = validateConfig(this.config);
    if (errors.length > 0) {
      this.nameTouched = true;
      this.refresh();
      const first = errors[0];
      if (first) {
        this.focusField(first.field);
      }
      return;
    }
    try {
      const filename = downloadTextureSet(this.config);
      this.showToast(`Downloaded ${filename}`);
    } catch (error) {
      const message =
        error instanceof ConfigurationInvalid
          ? (error.errors[0]?.message ?? error.message)
          : error instanceof Error
            ? error.message
            : "Could not generate the file.";
      this.showToast(message, true);
    }
  }

  private showToast(message: string, isError = false): void {
    this.toastElement.textContent = message;
    this.toastElement.classList.toggle("toast-error", isError);
    this.toastElement.classList.add("is-visible");
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toastElement.classList.remove("is-visible");
      this.toastTimer = null;
    }, 3200);
  }
}

export function mountApp(root: HTMLElement): TextureSetApp {
  return new TextureSetApp(root);
}
