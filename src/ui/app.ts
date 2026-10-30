import {
  type ColorValue,
  FORMAT_VERSIONS,
  FormatVersion,
  LAYER_KEYS,
  type LayerKey,
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
import { LayerRow } from "./layerRow";

function formatPreviewLayerValue(
  kind: ValueKind,
  value: LayerValue,
): string | number[] {
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
        Math.max(0, Math.min(255, Math.round(channel)))
          .toString(16)
          .padStart(2, "0")
          .toLowerCase(),
      )
      .join("")
  );
}

function renderLivePreviewJson(config: TextureSetConfig): string {
  try {
    return serializeTextureSet(config).trimEnd();
  } catch {
    const textureSet: Record<string, string | number[]> = {};
    for (const layer of LAYER_KEYS) {
      const layerConfig = config.layers[layer];
      if (layerConfig.enabled) {
        textureSet[layer] = formatPreviewLayerValue(
          layerConfig.kind,
          layerConfig.value(),
        );
      }
    }
    return JSON.stringify(
      {
        format_version: config.version,
        "minecraft:texture_set": textureSet,
      },
      null,
      2,
    );
  }
}

export class TextureSetApp {
  readonly root: HTMLElement;
  private readonly config: TextureSetConfig;
  private readonly layerRows = new Map<LayerKey, LayerRow>();

  private readonly textureNameInput: HTMLInputElement;
  private readonly textureNameFeedback: HTMLElement;
  private readonly versionSelect: HTMLSelectElement;
  private readonly filenameBadge: HTMLElement;
  private readonly jsonPreviewCode: HTMLElement;
  private readonly statusBanner: HTMLElement;
  private readonly copyButton: HTMLButtonElement;
  private readonly downloadButton: HTMLButtonElement;

  private syncing = false;
  private copyResetTimer: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.config = createDefaultConfig();

    this.root.innerHTML = "";

    const container = document.createElement("div");
    container.className = "app-shell";

    // Header
    const header = document.createElement("header");
    header.className = "app-header";

    const brand = document.createElement("div");
    brand.className = "app-header-brand";

    const logo = document.createElement("img");
    logo.className = "app-header-logo";
    logo.src = "./favicon.png";
    logo.alt = "OreUI";
    logo.addEventListener("error", () => {
      logo.style.display = "none";
    });

    const textGroup = document.createElement("div");
    textGroup.className = "app-header-text";

    const title = document.createElement("h1");
    title.className = "app-title";
    title.textContent = "Generador de texture_set.json";

    const badge = document.createElement("span");
    badge.className = "app-header-badge";
    badge.textContent = "Minecraft Bedrock";

    title.append(badge);

    const subtitle = document.createElement("p");
    subtitle.className = "app-subtitle";
    subtitle.textContent =
      "Escribe el nombre base, activa solo las capas que usarás y descarga el archivo listo para tu resource pack.";

    textGroup.append(title, subtitle);
    brand.append(logo, textGroup);
    header.append(brand);

    // Main 2-column layout
    const mainGrid = document.createElement("main");
    mainGrid.className = "app-main-grid";

    const configColumn = document.createElement("div");
    configColumn.className = "config-column";

    // Section 1: Textura
    const sectionTexture = document.createElement("section");
    sectionTexture.className = "panel-card";

    const sectionTextureTitle = document.createElement("h2");
    sectionTextureTitle.className = "section-title";
    sectionTextureTitle.textContent = "1. Textura";

    const formGrid = document.createElement("div");
    formGrid.className = "form-grid";

    // Texture name field
    const nameField = document.createElement("div");
    nameField.className = "form-field";

    const nameLabel = document.createElement("label");
    nameLabel.className = "field-label";
    nameLabel.htmlFor = "texture-name-input";
    nameLabel.textContent = "Nombre de la textura";

    this.textureNameInput = document.createElement("input");
    this.textureNameInput.id = "texture-name-input";
    this.textureNameInput.type = "text";
    this.textureNameInput.className = "text-input";
    this.textureNameInput.placeholder = "Ejemplo: stone";
    this.textureNameInput.autocomplete = "off";
    this.textureNameInput.spellcheck = false;
    this.textureNameInput.addEventListener("input", () => {
      this.handleTextureNameChanged();
    });

    this.textureNameFeedback = document.createElement("p");
    this.textureNameFeedback.id = "texture-name-feedback";
    this.textureNameFeedback.className = "field-feedback";
    this.textureNameInput.setAttribute(
      "aria-describedby",
      "texture-name-feedback",
    );

    nameField.append(
      nameLabel,
      this.textureNameInput,
      this.textureNameFeedback,
    );

    // Format version field
    const versionField = document.createElement("div");
    versionField.className = "form-field";

    const versionLabel = document.createElement("label");
    versionLabel.className = "field-label";
    versionLabel.htmlFor = "format-version-select";
    versionLabel.textContent = "Format version";

    this.versionSelect = document.createElement("select");
    this.versionSelect.id = "format-version-select";
    this.versionSelect.className = "select-input";

    const orderedVersions: FormatVersion[] = [
      FormatVersion.V1_21_30,
      FormatVersion.V1_16_100,
    ];
    for (const version of FORMAT_VERSIONS) {
      if (!orderedVersions.includes(version)) {
        orderedVersions.push(version);
      }
    }

    for (const version of orderedVersions) {
      const option = document.createElement("option");
      option.value = version;
      option.textContent = version;
      this.versionSelect.append(option);
    }

    this.versionSelect.addEventListener("change", () => {
      this.handleVersionChanged();
    });

    const versionHint = document.createElement("p");
    versionHint.className = "field-hint";
    versionHint.textContent =
      "Usa 1.21.30 para soporte de MERS (subsurface) o 1.16.100 para packs clásicos.";

    versionField.append(versionLabel, this.versionSelect, versionHint);

    formGrid.append(nameField, versionField);
    sectionTexture.append(sectionTextureTitle, formGrid);

    // Section 2: Capas PBR
    const sectionLayers = document.createElement("section");
    sectionLayers.className = "panel-card";

    const sectionLayersHeader = document.createElement("div");
    sectionLayersHeader.className = "section-header";

    const sectionLayersTitle = document.createElement("h2");
    sectionLayersTitle.className = "section-title";
    sectionLayersTitle.textContent = "2. Capas PBR";

    const layersHelp = document.createElement("p");
    layersHelp.className = "section-help";
    layersHelp.textContent =
      "Color es obligatorio. Normal y Mapa de alturas son mutuamente excluyentes, al igual que MER y MERS.";

    sectionLayersHeader.append(sectionLayersTitle, layersHelp);

    const layersList = document.createElement("div");
    layersList.className = "layers-list";

    for (const layerKey of LAYER_KEYS) {
      const row = new LayerRow(layerKey, this.config, () => {
        this.refreshUI({ refreshName: false });
      });
      this.layerRows.set(layerKey, row);
      layersList.append(row.element);
    }

    sectionLayers.append(sectionLayersHeader, layersList);
    configColumn.append(sectionTexture, sectionLayers);

    // Section 3: Vista previa y salida (Sticky right panel)
    const previewColumn = document.createElement("aside");
    previewColumn.className = "preview-column";

    const sectionPreview = document.createElement("section");
    sectionPreview.className = "panel-card preview-card";

    const previewHeader = document.createElement("div");
    previewHeader.className = "preview-header";

    const sectionPreviewTitle = document.createElement("h2");
    sectionPreviewTitle.className = "section-title";
    sectionPreviewTitle.textContent = "3. Vista previa y salida";

    const fileIndicator = document.createElement("div");
    fileIndicator.className = "output-file-indicator";

    const fileLabel = document.createElement("span");
    fileLabel.className = "output-file-label";
    fileLabel.textContent = "Archivo:";

    this.filenameBadge = document.createElement("code");
    this.filenameBadge.className = "output-filename";

    fileIndicator.append(fileLabel, this.filenameBadge);
    previewHeader.append(sectionPreviewTitle, fileIndicator);

    const preBlock = document.createElement("pre");
    preBlock.className = "json-preview-pre";

    this.jsonPreviewCode = document.createElement("code");
    this.jsonPreviewCode.id = "json-preview";
    preBlock.append(this.jsonPreviewCode);

    this.statusBanner = document.createElement("div");
    this.statusBanner.className = "status-banner";
    this.statusBanner.setAttribute("role", "status");
    this.statusBanner.setAttribute("aria-live", "polite");

    const actionsRow = document.createElement("div");
    actionsRow.className = "actions-row";

    this.copyButton = document.createElement("button");
    this.copyButton.type = "button";
    this.copyButton.className = "btn btn-secondary";
    this.copyButton.textContent = "Copiar JSON";
    this.copyButton.addEventListener("click", () => {
      void this.handleCopyJson();
    });

    this.downloadButton = document.createElement("button");
    this.downloadButton.type = "button";
    this.downloadButton.className = "btn btn-primary";
    this.downloadButton.textContent = "Descargar texture_set.json";
    this.downloadButton.addEventListener("click", () => {
      this.handleDownload();
    });

    actionsRow.append(this.copyButton, this.downloadButton);

    sectionPreview.append(
      previewHeader,
      preBlock,
      this.statusBanner,
      actionsRow,
    );
    previewColumn.append(sectionPreview);

    mainGrid.append(configColumn, previewColumn);
    container.append(header, mainGrid);
    this.root.append(container);

    this.refreshUI({ refreshName: true });
  }

  private handleTextureNameChanged(): void {
    if (this.syncing) {
      return;
    }
    this.config.setTextureName(this.textureNameInput.value);
    this.refreshUI({ refreshName: false });
  }

  private handleVersionChanged(): void {
    if (this.syncing) {
      return;
    }
    this.config.setVersion(this.versionSelect.value as FormatVersion);
    this.refreshUI({ refreshName: false });
  }

  private refreshUI(options: { refreshName: boolean }): void {
    this.syncing = true;
    try {
      if (options.refreshName) {
        this.textureNameInput.value = this.config.textureName;
      }
      this.versionSelect.value = this.config.version;
      for (const row of this.layerRows.values()) {
        row.refresh();
      }
    } finally {
      this.syncing = false;
    }

    this.refreshValidationAndPreview();
  }

  private refreshValidationAndPreview(): void {
    const errors = validateConfig(this.config);
    const trimmedName = this.config.textureName.trim();
    const displayFilename = trimmedName
      ? outputFilename(trimmedName)
      : "sin_nombre.texture_set.json";

    this.filenameBadge.textContent = displayFilename;
    this.filenameBadge.classList.toggle("output-filename-placeholder", !trimmedName);

    const nameError = errors.find(
      (err: ValidationError) => err.field === "texture_name",
    );
    const hasTypedOrInvalidName =
      nameError !== undefined && this.config.textureName.length > 0;

    if (nameError) {
      this.textureNameFeedback.textContent = nameError.message;
      this.textureNameFeedback.classList.toggle(
        "field-feedback-error",
        hasTypedOrInvalidName,
      );
      this.textureNameInput.classList.toggle(
        "input-invalid",
        hasTypedOrInvalidName,
      );
    } else {
      this.textureNameFeedback.textContent =
        "Se aplica automáticamente como prefijo sugerido en las capas de textura.";
      this.textureNameFeedback.classList.remove("field-feedback-error");
      this.textureNameInput.classList.remove("input-invalid");
    }

    this.jsonPreviewCode.textContent = renderLivePreviewJson(this.config);

    const isValid = errors.length === 0;
    this.copyButton.disabled = !isValid;
    this.downloadButton.disabled = !isValid;

    if (!isValid) {
      this.statusBanner.className = "status-banner status-error";
      this.statusBanner.textContent = errors[0]?.message ?? "Configuración inválida.";
    } else {
      const targetFile = outputFilename(this.config.textureName);
      this.statusBanner.className = "status-banner status-ok";
      this.statusBanner.textContent = `Listo para generar: ${targetFile}`;
    }
  }

  private async handleCopyJson(): Promise<void> {
    const errors = validateConfig(this.config);
    if (errors.length > 0) {
      this.refreshValidationAndPreview();
      return;
    }

    try {
      const jsonText = serializeTextureSet(this.config);
      await navigator.clipboard.writeText(jsonText);
      this.copyButton.textContent = "¡Copiado!";
      if (this.copyResetTimer !== null) {
        window.clearTimeout(this.copyResetTimer);
      }
      this.copyResetTimer = window.setTimeout(() => {
        this.copyButton.textContent = "Copiar JSON";
        this.copyResetTimer = null;
      }, 1500);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo copiar al portapapeles.";
      this.statusBanner.className = "status-banner status-error";
      this.statusBanner.textContent = message;
    }
  }

  private handleDownload(): void {
    try {
      const filename = downloadTextureSet(this.config);
      this.statusBanner.className = "status-banner status-ok";
      this.statusBanner.textContent = `Archivo descargado: ${filename}`;
    } catch (error) {
      if (error instanceof ConfigurationInvalid) {
        this.statusBanner.className = "status-banner status-error";
        this.statusBanner.textContent =
          error.errors[0]?.message ?? error.message;
        return;
      }
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo generar el archivo.";
      this.statusBanner.className = "status-banner status-error";
      this.statusBanner.textContent = message;
    }
  }
}

export function mountApp(root: HTMLElement): TextureSetApp {
  return new TextureSetApp(root);
}
