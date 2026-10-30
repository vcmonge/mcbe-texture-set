import { h } from "./dom";

const TOKEN =
  /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g;

/** Renders syntax-highlighted JSON using text nodes only. */
export function renderJson(target: HTMLElement, json: string): void {
  const fragment = document.createDocumentFragment();
  let last = 0;
  for (const match of json.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) {
      fragment.append(json.slice(last, index));
    }
    const [token, text, colon, number] = match;
    if (text !== undefined && colon !== undefined) {
      fragment.append(h("span", "tok-key", text), h("span", "tok-punct", colon));
    } else if (text !== undefined) {
      fragment.append(h("span", text === '""' ? "tok-str tok-empty" : "tok-str", text));
    } else if (number !== undefined) {
      fragment.append(h("span", "tok-num", number));
    } else {
      fragment.append(h("span", "tok-punct", token));
    }
    last = index + token.length;
  }
  fragment.append(json.slice(last));
  target.replaceChildren(fragment);
}
