import { type ColorValue, ValueKind } from "../models/textureSet";
import { h } from "./dom";

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

/** Acepta #rgb, #rgba, #rrggbb y #rrggbbaa (con o sin #). */
function parseHex(text: string): number[] | null {
  const raw = text.trim().replace(/^#/, "");
  if (!/^[0-9a-f]+$/i.test(raw)) {
    return null;
  }
  const digits =
    raw.length === 3 || raw.length === 4
      ? [...raw].map((digit) => digit + digit).join("")
      : raw;
  if (digits.length !== 6 && digits.length !== 8) {
    return null;
  }
  const channels: number[] = [];
  for (let i = 0; i < digits.length; i += 2) {
    channels.push(Number.parseInt(digits.slice(i, i + 2), 16));
  }
  return channels;
}

function isFocused(element: HTMLElement): boolean {
  return document.activeElement === element;
}

export class ColorEditor {
  readonly element: HTMLElement;

  private readonly onChange: (color: ColorValue) => void;
  private readonly swatchFill: HTMLElement;
  private readonly nativeInput: HTMLInputElement;
  private readonly hexInput: HTMLInputElement;
  private readonly channelFields: HTMLElement[] = [];
  private readonly channelInputs: HTMLInputElement[] = [];

  private channels: 3 | 4 = 3;
  private readonly color = [255, 255, 255, 255];

  constructor(onChange: (color: ColorValue) => void, channelHint = "") {
    this.onChange = onChange;

    this.swatchFill = h("span", "color-swatch-fill");
    this.nativeInput = h("input", "color-swatch-input");
    this.nativeInput.type = "color";
    this.nativeInput.setAttribute("aria-label", "Abrir selector de color");
    this.nativeInput.addEventListener("input", () => {
      const parsed = parseHex(this.nativeInput.value);
      if (!parsed) {
        return;
      }
      this.color.splice(0, 3, ...parsed.slice(0, 3));
      this.render();
      this.emit();
    });
    const swatch = h("label", "color-swatch", this.swatchFill, this.nativeInput);
    swatch.title = "Abrir selector de color";

    this.hexInput = h("input", "text-input color-hex-input mono");
    this.hexInput.type = "text";
    this.hexInput.maxLength = 9;
    this.hexInput.spellcheck = false;
    this.hexInput.autocomplete = "off";
    this.hexInput.setAttribute("aria-label", "Color hexadecimal");
    this.hexInput.addEventListener("input", () => {
      this.handleHexInput();
    });
    this.hexInput.addEventListener("blur", () => {
      this.hexInput.classList.remove("is-invalid");
      this.render();
    });

    const channelsRow = h("div", "color-channels");
    for (const [index, name] of CHANNEL_NAMES.entries()) {
      const input = h("input", "text-input channel-input mono");
      input.type = "number";
      input.min = "0";
      input.max = "255";
      input.step = "1";
      input.inputMode = "numeric";
      input.setAttribute("aria-label", `Canal ${name}`);
      input.addEventListener("input", () => {
        if (input.value === "") {
          return;
        }
        this.color[index] = clampChannel(Number(input.value));
        this.render();
        this.emit();
      });
      input.addEventListener("blur", () => {
        input.value = String(this.color[index]);
      });

      const field = h("label", "channel-field", h("span", "channel-label", name), input);
      channelsRow.append(field);
      this.channelFields.push(field);
      this.channelInputs.push(input);
    }

    const hexField = h("div", "color-hex-field", this.hexInput);
    this.element = h(
      "div",
      "color-editor",
      h("div", "color-editor-row", swatch, hexField, channelsRow),
    );
    if (channelHint) {
      this.element.append(h("p", "field-hint", channelHint));
    }
    this.render();
  }

  configure(kind: ValueKind): void {
    this.channels = channelsForKind(kind);
    const alphaField = this.channelFields[3];
    if (alphaField) {
      alphaField.hidden = this.channels !== 4;
    }
    this.render();
  }

  setColor(value: ColorValue): void {
    for (let i = 0; i < 4; i += 1) {
      this.color[i] = clampChannel(value[i] ?? 255);
    }
    this.render();
  }

  focus(): void {
    this.hexInput.focus();
  }

  private handleHexInput(): void {
    const parsed = parseHex(this.hexInput.value);
    this.hexInput.classList.toggle("is-invalid", parsed === null);
    if (!parsed) {
      return;
    }
    const count = this.channels === 4 ? parsed.length : 3;
    this.color.splice(0, count, ...parsed.slice(0, count));
    this.render();
    this.emit();
  }

  private emit(): void {
    this.onChange(this.color.slice(0, this.channels));
  }

  /** Sincroniza todos los campos excepto el que el usuario está editando. */
  private render(): void {
    const [r = 255, g = 255, b = 255, a = 255] = this.color;
    const rgbHex = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;

    if (!isFocused(this.hexInput)) {
      this.hexInput.value = this.channels === 4 ? rgbHex + toHexByte(a) : rgbHex;
    }
    for (const [index, input] of this.channelInputs.entries()) {
      if (!isFocused(input)) {
        input.value = String(this.color[index]);
      }
    }
    this.nativeInput.value = rgbHex;
    const alpha = this.channels === 4 ? a / 255 : 1;
    this.swatchFill.style.backgroundColor = `rgb(${r} ${g} ${b} / ${alpha.toFixed(3)})`;
  }
}
