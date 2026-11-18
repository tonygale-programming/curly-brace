/**
 * The one field: a transparent textarea laid over a coloured copy of the same text,
 * with line numbers on the left.
 *
 * Why two layers: a textarea can't colour its text, and a full code editor would be a large
 * library. Both layers use the same font, size and line height and share one grid cell, so every
 * character lines up, and the outer .editor scrolls them together.
 */
import { escapeHtml } from './html.js';
import { highlightLine } from './highlighter.js';

// Above this many characters, colouring on every keystroke would make typing slow.
const COLOUR_LIMIT = 200_000;
const LINES_SHOWN_ABOVE_ERROR = 3;
const ERROR_LINE_CLASS = 'has-error';

/**
 * @param elements { container, input, highlight, gutter }: the .editor, its textarea, the coloured
 *                 <pre> and the line-number column
 */
export function createEditor({ container, input, highlight, gutter }) {
  let errorLine = null;
  let lineNumberCount = 0;

  function renderColours(text, lines) {
    const isPlain = text.length > COLOUR_LIMIT;
    container.classList.toggle('is-plain', isPlain);
    // In plain mode the copy is hidden but still sized by the text, so the field keeps its size.
    highlight.innerHTML = isPlain
      ? escapeHtml(`${text} `)
      : lines.map((line) => `<span>${highlightLine(line) || ' '}</span>`).join('');
  }

  // Line numbers only change when the number of lines does, which is rare while typing.
  function renderLineNumbers(lineCount) {
    if (lineCount === lineNumberCount) return;
    lineNumberCount = lineCount;
    gutter.innerHTML = Array.from({ length: lineCount }, (unused, index) => `<span>${index + 1}</span>`).join('');
  }

  // Marks the error's line in the numbers and in the coloured copy, without rebuilding either.
  function renderErrorLine() {
    for (const layer of [gutter, highlight]) {
      layer.querySelector(`.${ERROR_LINE_CLASS}`)?.classList.remove(ERROR_LINE_CLASS);
      if (errorLine !== null) layer.children[errorLine - 1]?.classList.add(ERROR_LINE_CLASS);
    }
  }

  function render() {
    const text = input.value;
    const lines = text.split('\n');
    renderColours(text, lines);
    renderLineNumbers(lines.length);
    renderErrorLine();
  }

  function getText() {
    return input.value;
  }

  /** True when the whole text is selected, so whatever is typed or pasted next replaces all of it. */
  function isAllSelected() {
    return input.selectionStart === 0 && input.selectionEnd === input.value.length;
  }

  /**
   * Replaces the whole text. By default it goes through the browser's editing command, so
   * Ctrl/⌘+Z brings the old text back; returns false if the browser refused and Undo won't work.
   */
  function setText(text, { undoable = true } = {}) {
    let replaced = false;
    if (undoable) {
      // insertText only works in the focused field; afterwards focus goes back to the button that was
      // pressed, so keyboard users keep their place
      const previousFocus = document.activeElement;
      input.focus({ preventScroll: true });
      input.select();
      try {
        replaced = document.execCommand('insertText', false, text) && input.value === text;
      } catch {
        replaced = false;
      }
      if (previousFocus instanceof HTMLButtonElement) previousFocus.focus({ preventScroll: true });
    }
    if (!replaced) input.value = text;

    input.setSelectionRange(0, 0);
    container.scrollTop = 0;
    container.scrollLeft = 0;
    render();
    return replaced;
  }

  /** Marks one line as the error's line, or none with null. */
  function markErrorLine(lineNumber) {
    if (lineNumber === errorLine) return;
    errorLine = lineNumber;
    renderErrorLine();
  }

  /** Puts the cursor on a position and scrolls so a few lines above it stay visible. */
  function showPosition(position, lineNumber) {
    input.focus({ preventScroll: true });
    input.setSelectionRange(position, Math.min(position + 1, input.value.length));
    const lineHeight = parseFloat(getComputedStyle(input).lineHeight) || 20;
    container.scrollTop = Math.max(0, (lineNumber - 1 - LINES_SHOWN_ABOVE_ERROR) * lineHeight);
  }

  input.addEventListener('input', render);
  render();

  return { getText, setText, isAllSelected, markErrorLine, showPosition };
}
