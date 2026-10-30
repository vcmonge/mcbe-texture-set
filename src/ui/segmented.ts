import { h } from "./dom";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** Mutually exclusive button group with radiogroup semantics and keyboard support. */
export class SegmentedControl<T extends string> {
  readonly element: HTMLElement;

  private readonly order: T[] = [];
  private readonly buttons = new Map<T, HTMLButtonElement>();
  private readonly onSelect: (value: T) => void;
  private value: T | null = null;

  constructor(
    label: string,
    options: readonly SegmentOption<T>[],
    onSelect: (value: T) => void,
    variant = "",
  ) {
    this.onSelect = onSelect;
    this.element = h("div", `segmented ${variant}`.trim());
    this.element.setAttribute("role", "radiogroup");
    this.element.setAttribute("aria-label", label);

    for (const option of options) {
      const button = h("button", "segment", h("span", "segment-label", option.label));
      button.type = "button";
      button.setAttribute("role", "radio");
      if (option.hint) {
        button.append(h("span", "segment-hint", option.hint));
      }
      button.addEventListener("click", () => {
        this.select(option.value);
      });
      button.addEventListener("keydown", (event) => {
        this.handleKeydown(event);
      });
      this.order.push(option.value);
      this.buttons.set(option.value, button);
      this.element.append(button);
    }
  }

  setValue(value: T): void {
    this.value = value;
    for (const [optionValue, button] of this.buttons) {
      const checked = optionValue === value;
      button.setAttribute("aria-checked", String(checked));
      button.tabIndex = checked ? 0 : -1;
    }
  }

  focus(): void {
    if (this.value !== null) {
      this.buttons.get(this.value)?.focus();
    }
  }

  private select(value: T): void {
    if (value !== this.value) {
      this.onSelect(value);
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    const current = this.value === null ? 0 : this.order.indexOf(this.value);
    const last = this.order.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = current >= last ? 0 : current + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = current <= 0 ? last : current - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    const value = this.order[next];
    if (value !== undefined) {
      this.select(value);
      this.buttons.get(value)?.focus();
    }
  }
}
