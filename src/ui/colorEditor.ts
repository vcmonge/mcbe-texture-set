import { type ColorValue, ValueKind } from "../models/textureSet";

const CHANNEL_NAMES = ["R", "G", "B", "A"] as const;

function clampChannel(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHexByte(value: number): string {
  return clampChannel(value).toString(16).padStart(2, "0");
}

function channelsForKind(kind: ValueKind): 3 | 4 {
  return kind === ValueKind.RGBA || kind === ValueKind.HEX_RGBA ? 4 : 3;
}

export class ColorEditor {
  readonly element: HTMLElement;

  private readonly onChange: (color: ColorValue) => void;
  private readonly colorInput: HTMLInputElement;
  private readonly swatchIndicator: HTMLElement;
  private readonly paletteButton: HTMLButtonElement;
  private readonly channelGroups: HTMLElement[] = [];
  private readonly channelInputs: HTMLInputElement[] = [];
  private readonly hexPreview: HTMLElement;

  private channels: 3 | 4 = 3;
  private kind: ValueKind = ValueKind.RGB;
  private syncing = false;

  constructor(onChange: (color: ColorValue) => void) {
    this.onChange = onChange;

    this.element = document.createElement("div");
    this.element.className = "color-editor";

    const pickerGroup = document.createElement("div");
    pickerGroup.className = "color-picker-group";

    this.colorInput = document.createElement("input");
    this.colorInput.type = "color";
    this.colorInput.className = "color-native-input";
    this.colorInput.value = "#ffffff";
    this.colorInput.setAttribute("aria-label", "Selector de color RGB");
    this.colorInput.addEventListener("input", () => {
      this.handleNativeColorInput();
    });

    this.paletteButton = document.createElement("button");
    this.paletteButton.type = "button";
    this.paletteButton.className = "btn btn-color-picker";
    this.paletteButton.title = "Abrir selector de color RGB";

    this.swatchIndicator = document.createElement("span");
    this.swatchIndicator.className = "color-swatch";
    this.swatchIndicator.setAttribute("aria-hidden", "true");

    const buttonLabel = document.createElement("span");
    buttonLabel.textContent = "Elegir color…";

    this.paletteButton.append(this.swatchIndicator, buttonLabel);
    this.paletteButton.addEventListener("click", () => {
      this.openPalette();
    });

    pickerGroup.append(this.colorInput, this.paletteButton);

    const channelsContainer = document.createElement("div");
    channelsContainer.className = "color-channels";

    for (const channel of CHANNEL_NAMES) {
      const group = document.createElement("label");
      group.className = "channel-field";

      const tag = document.createElement("span");
      tag.className = "channel-label";
      tag.textContent = channel;

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "255";
      input.step = "1";
      input.value = "255";
      input.inputMode = "numeric";
      input.className = "channel-input";
      input.setAttribute("aria-label", `Canal ${channel}`);

      input.addEventListener("input", () => {
        this.handleChannelInput();
      });

      input.addEventListener("change", () => {
        const sanitized = clampChannel( Number(input.value) );
        input.value = String(sanitized);
        this.handleChannelInput();
      });

      group.append(tag, input);
      channelsContainer.append(group);
      this.channelGroups.push(group);
      this.channelInputs.push(input);
    }

    this.hexPreview = document.createElement("code");
    this.hexPreview.className = "hex-preview";
    this.hexPreview.title = "Representación hexadecimal actual";
    this.hexPreview.textContent = "#ffffff";

    this.element.append(pickerGroup, channelsContainer, this.hexPreview);
    this.configure(ValueKind.RGB);
  }

  configure(kind: ValueKind): void {
    this.kind = kind;
    this.channels = channelsForKind(this.kind);

    const alphaGroup = this.channelGroups[3];
    if (alphaGroup) {
      const showAlpha = this.channels === 4;
      alphaGroup.hidden = !showAlpha;
      alphaGroup.classList.toggle("hidden", !showAlpha);
    }

    const isHex =
      this.kind === ValueKind.HEX_RGB || this.kind === ValueKind.HEX_RGBA;
    this.hexPreview.classList.toggle("hex-preview-active", isHex);

    this.updatePreview();
  }

  getColor(): ColorValue {
    const r = clampChannel(Number(this.channelInputs[0]?.value ?? 255));
    const g = clampChannel(Number(this.channelInputs[1]?.value ?? 255));
    const b = clampChannel(Number(this.channelInputs[2]?.value ?? 255));
    if (this.channels === 4) {
      const a = clampChannel(Number(this.channelInputs[3]?.value ?? 255));
      return [r, g, b, a];
    }
    return [r, g, b];
  }

  setColor(value: ColorValue): void {
    this.syncing = true;
    try {
      for (let i = 0; i < 4; i += 1) {
        const raw = i < value.length ? value[i] : 255;
        const channelValue = clampChannel(raw ?? 255);
        const input = this.channelInputs[i];
        if (input) {
          input.value = String(channelValue);
        }
      }
    } finally {
      this.syncing = false;
    }
    this.updatePreview();
  }

  openPalette(): void {
    this.colorInput.focus();
    if (typeof this.colorInput.showPicker === "function") {
      try {
        this.colorInput.showPicker();
        return;
      } catch {
        // Fallback when showPicker requires direct gesture or is unsupported
      }
    }
    this.colorInput.click();
  }

  private handleNativeColorInput(): void {
    const rawHex = this.colorInput.value;
    if (!/^#[0-9a-fA-F]{6}$/.test(rawHex)) {
      return;
    }
    const r = Number.parseInt(rawHex.slice(1, 3), 16);
    const g = Number.parseInt(rawHex.slice(3, 5), 16);
    const b = Number.parseInt(rawHex.slice(5, 7), 16);

    this.syncing = true;
    try {
      if (this.channelInputs[0]) this.channelInputs[0].value = String(r);
      if (this.channelInputs[1]) this.channelInputs[1].value = String(g);
      if (this.channelInputs[2]) this.channelInputs[2].value = String(b);
    } finally {
      this.syncing = false;
    }

    this.updatePreview();
    if (!this.syncing) {
      this.onChange(this.getColor());
    }
  }

  private handleChannelInput(): void {
    this.updatePreview();
    if (!this.syncing) {
      this.onChange(this.getColor());
    }
  }

  private updatePreview(): void {
    const color = this.getColor();
    const [r, g, b] = color;
    const a = color.length === 4 ? color[3] : 255;

    const rgbHex = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
    const fullHex =
      color.length === 4 ? `${rgbHex}${toHexByte(a)}` : rgbHex;

    this.colorInput.value = rgbHex;
    this.hexPreview.textContent = fullHex;
    this.swatchIndicator.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  }
}
