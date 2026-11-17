/**
 * Curly Brace JSON Formatter: entry point.
 *
 * One field holds the JSON. Format, Minify and Stringify rewrite it in place (Ctrl/⌘+Z goes back),
 * and everything else follows whatever is in the field: the status row, the error card,
 * which buttons can be used, and the tree.
 */
import {
  readJson, stringifyJson, stringifyAsEscapedString, unwrapStringifiedJson, sortKeysDeep, repairJson, canRepair,
} from './json-engine.js';
import { getLineAndColumn } from './syntax-checker.js';
import { createEditor } from './editor.js';
import { createErrorCard } from './error-card.js';
import { createStatusBar } from './status-bar.js';
import { createTreePanel } from './tree-panel.js';
import { createSortMemory } from './sort-memory.js';
import { readFileAsText, acceptDroppedFiles } from './files.js';
import { showToast, copyToClipboard, LONG_TOAST_MS } from './notifications.js';
import { bindShortcuts, setUpShortcutsDialog } from './keyboard.js';
import { saveTextAsFile } from './download.js';
import { loadSetting, saveSetting, loadDraft, saveDraft, migrateOldSettings } from './storage.js';
import { toggleTheme } from './theme.js';
import { enableOfflineUse } from './offline.js';

const TYPING_DELAY_MS = 180;
const MAX_SAVED_DRAFT_LENGTH = 500_000; // characters; larger inputs are not kept on reload
const BYTE_ORDER_MARK = /^\uFEFF/; // some editors put this invisible mark at the start of a file
const DEFAULT_FILE_NAME = 'curly-brace.json';

const SAMPLE_JSON = '{"order":{"id":"ORD-20419","placedAt":"2026-11-08T09:41:27Z","status":"shipped","customer":{"name":"Mara Lindqvist","email":"mara@example.com","loyaltyTier":"gold"},"items":[{"sku":"KB-7720","title":"Mechanical keyboard, 75% layout","qty":1,"unitPrice":129.0},{"sku":"CB-0031","title":"Braided USB-C cable, 2 m","qty":2,"unitPrice":14.5}],"shipping":{"carrier":"DHL","tracking":"JD014600006281990","address":{"line1":"Sveavägen 44","city":"Stockholm","postcode":"111 34","country":"SE"}},"totals":{"subtotal":158.0,"shipping":0,"tax":39.5,"currency":"EUR"},"giftWrap":false,"notes":null}}';

const getElement = (id) => document.getElementById(id);

const elements = {
  editorPane: getElement('editor-pane'),
  editor: getElement('editor'),
  input: getElement('json-input'),
  fileInput: getElement('file-input'),
  formatButton: getElement('format-button'),
  minifyButton: getElement('minify-button'),
  stringifyButton: getElement('stringify-button'),
  indentSelect: getElement('indent-select'),
  sortKeysButton: getElement('sort-keys-button'),
  sampleButton: getElement('sample-button'),
  repairButton: getElement('repair-button'),
  clearButton: getElement('clear-button'),
  textTab: getElement('text-tab'),
  treeTab: getElement('tree-tab'),
  errorRepairButton: getElement('error-repair-button'),
  errorShowButton: getElement('error-show-button'),
  downloadButton: getElement('download-button'),
  copyButton: getElement('copy-button'),
  themeButton: getElement('theme-button'),
  shortcutsButton: getElement('shortcuts-button'),
  shortcutsDialog: getElement('shortcuts-dialog'),
};

const editor = createEditor({
  container: elements.editor,
  input: elements.input,
  highlight: getElement('editor-highlight'),
  gutter: getElement('editor-gutter'),
});

const errorCard = createErrorCard({
  card: getElement('error-card'),
  title: getElement('error-title'),
  message: getElement('error-message'),
  snippet: getElement('error-snippet'),
  repairButton: elements.errorRepairButton,
});

const statusBar = createStatusBar({
  chip: getElement('status-chip'),
  label: getElement('status-label'),
  stats: getElement('stats'),
});

const treePanel = createTreePanel({
  view: getElement('tree-view'),
  root: getElement('tree-root'),
  pathBar: getElement('path-bar'),
  selectedPath: getElement('selected-path'),
  expandToggle: getElement('expand-toggle'),
  copyPathButton: getElement('copy-path-button'),
  copyValueButton: getElement('copy-value-button'),
}, { getIndent });

const sortMemory = createSortMemory();

const state = {
  lastAction: 'format', // 'format', 'minify' or 'stringify': re-applied when Sort keys changes
  parsed: null,         // { data, isStringified } while the field holds valid JSON
  errorLocation: null,  // { position, line, column } while it doesn't
  view: 'text',         // 'text' or 'tree'
  fileName: DEFAULT_FILE_NAME,
};

let typingTimer = null;

/* ---------- Following the field ---------- */

function getFieldText() {
  return editor.getText().replace(BYTE_ORDER_MARK, '');
}

/** Checks the field and updates everything that depends on it. */
function refresh() {
  clearTimeout(typingTimer);
  const text = getFieldText();
  state.parsed = null;
  state.errorLocation = null;

  if (!text.trim()) {
    statusBar.showWaiting();
    errorCard.hide();
    editor.markErrorLine(null);
  } else {
    const { data, error } = readJson(text);
    if (error) {
      state.errorLocation = errorCard.show(text, error, { canRepair: canRepair && error.repairable });
      editor.markErrorLine(state.errorLocation.line);
      statusBar.showInvalid();
    } else {
      state.parsed = { data, isStringified: unwrapStringifiedJson(data) !== null };
      errorCard.hide();
      editor.markErrorLine(null);
      statusBar.showValid(text, data);
    }
  }

  // Leave the tree if the JSON stopped being valid; otherwise this redraws it for the new text
  showView(state.view === 'tree' && state.parsed ? 'tree' : 'text');
}

/** A control that can't do anything right now is disabled, rather than explaining after the click. */
function updateButtons() {
  const isValid = Boolean(state.parsed);
  const isInvalid = Boolean(state.errorLocation);
  // Format, Minify, Stringify and Indent only shape the text, which the tree view hides.
  // Sort keys stays, because it reorders the tree too.
  const canShapeText = isValid && state.view === 'text';

  for (const button of [elements.downloadButton, elements.copyButton, elements.treeTab]) button.disabled = !isValid;
  elements.formatButton.disabled = !canShapeText;
  elements.minifyButton.disabled = !canShapeText;
  // Text that Stringify made is already one escaped string; stringifying it again would only add backslashes
  elements.stringifyButton.disabled = !canShapeText || Boolean(state.parsed?.isStringified);
  elements.indentSelect.disabled = state.view === 'tree';
  elements.repairButton.disabled = !(isInvalid && canRepair);
  elements.clearButton.disabled = !getFieldText().trim();
}

function keepDraft(text) {
  if (text.length <= MAX_SAVED_DRAFT_LENGTH) saveDraft(text);
}

function handleTyping() {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    refresh();
    keepDraft(editor.getText());
  }, TYPING_DELAY_MS);
}

/** Replaces the field's text (Ctrl/⌘+Z can bring the old one back) and updates everything. */
function replaceFieldText(text) {
  editor.setText(text);
  refresh();
  keepDraft(text);
}

/* ---------- Format, Minify, Stringify ---------- */

function getIndent() {
  const choice = elements.indentSelect.value;
  return choice === 'tab' ? '\t' : Number(choice);
}

const isSortingKeys = () => elements.sortKeysButton.getAttribute('aria-pressed') === 'true';

function buildOutput(data, action) {
  const orderedData = isSortingKeys() ? sortKeysDeep(data) : data;
  if (action === 'minify') return stringifyJson(orderedData);
  if (action === 'stringify') return stringifyAsEscapedString(orderedData);
  return stringifyJson(orderedData, getIndent());
}

/** Rewrites the field as formatted, minified or stringified JSON. */
function applyAction(action) {
  refresh();
  if (!state.parsed) return;

  // Every action starts from the real data, unwrapping text that Stringify made. That lets Format undo a
  // Stringify, and makes pressing Stringify twice give the same result instead of more backslashes.
  const { data } = state.parsed;
  const sourceData = unwrapStringifiedJson(data) ?? data;
  const isSorting = isSortingKeys();
  if (isSorting) sortMemory.beforeSorting(editor.getText(), sourceData);

  state.lastAction = action;
  const output = buildOutput(sourceData, action);
  replaceFieldText(output);
  if (isSorting) sortMemory.afterSorting(output);
}

function changeIndent() {
  saveSetting('indent', elements.indentSelect.value);
  if (state.parsed) applyAction('format');
}

/** On: sorts the keys. Off: brings the earlier order back, unless the JSON was edited in between. */
function toggleSortKeys() {
  const isOn = !isSortingKeys();
  elements.sortKeysButton.setAttribute('aria-pressed', String(isOn));
  saveSetting('sort', isOn ? '1' : '');
  if (!state.parsed) return;

  if (isOn) {
    applyAction(state.lastAction);
    return;
  }
  const unsortedData = sortMemory.takeUnsortedData(editor.getText());
  if (unsortedData !== null) replaceFieldText(buildOutput(unsortedData, state.lastAction));
}

/**
 * Pasting into an empty field, or over all of its text, formats it straight away;
 * one Undo brings back what was pasted.
 */
function handlePaste() {
  if (getFieldText().trim() && !editor.isAllSelected()) return;
  // The pasted text arrives after this event, so wait for it.
  setTimeout(() => {
    refresh();
    if (state.parsed) applyAction('format');
  }, 0);
}

/* ---------- Repair, Sample, Clear, files ---------- */

// Each of these goes through the editor's undoable replace, so Ctrl/⌘+Z brings the earlier text back.

function repairInput() {
  const text = editor.getText();
  let repairedText;
  try {
    repairedText = repairJson(text);
  } catch (error) {
    const lineHint = typeof error.position === 'number'
      ? ` (line ${getLineAndColumn(text, error.position).line})`
      : '';
    showToast(`Could not repair this automatically${lineHint}. Fix it by hand using the error details.`,
      { durationMs: LONG_TOAST_MS });
    return;
  }
  if (repairedText === text) {
    showToast('Repair cannot fix this one. Fix it by hand using the error details.', { durationMs: LONG_TOAST_MS });
    return;
  }
  replaceFieldText(repairedText);
  showToast('Repaired');
}

function formattedSample() {
  return buildOutput(readJson(SAMPLE_JSON).data, 'format');
}

function loadSample() {
  state.fileName = DEFAULT_FILE_NAME;
  replaceFieldText(formattedSample());
  showToast('Sample loaded');
}

function clearField() {
  state.fileName = DEFAULT_FILE_NAME;
  replaceFieldText('');
  showToast('Cleared');
  elements.input.focus();
}

async function openFile(file) {
  if (!file) return;
  try {
    const text = await readFileAsText(file);
    state.fileName = file.name;
    replaceFieldText(text);
    if (state.parsed) applyAction('format');
    showToast(`Opened ${file.name}`);
  } catch (error) {
    showToast(error.message, { durationMs: LONG_TOAST_MS });
  }
}

function showErrorInInput() {
  if (!state.errorLocation) return;
  showView('text');
  editor.showPosition(state.errorLocation.position, state.errorLocation.line);
}

/* ---------- Text and Tree ---------- */

function showView(view) {
  const isTree = view === 'tree' && Boolean(state.parsed);
  state.view = isTree ? 'tree' : 'text';

  elements.textTab.setAttribute('aria-selected', String(!isTree));
  elements.treeTab.setAttribute('aria-selected', String(isTree));
  elements.editor.hidden = isTree;
  treePanel.setVisible(isTree);
  if (isTree) treePanel.show(state.parsed.data, editor.getText());
  updateButtons();
}

function toggleView() {
  if (!elements.treeTab.disabled) showView(state.view === 'tree' ? 'text' : 'tree');
}

/* ---------- Download and Copy ---------- */

function downloadField() {
  saveTextAsFile(editor.getText(), state.fileName);
  showToast(`Downloaded ${state.fileName}`);
}

function copyField() {
  copyToClipboard(editor.getText(), 'Copied', elements.input);
}

/* ---------- Shortcuts ---------- */

/** Presses a button the way a click would, so a shortcut does nothing while its button is disabled. */
function press(button) {
  if (!button.disabled) button.click();
}

/* The one list of shortcuts: it drives the keys, the shortcuts window and the button tooltips. */
const SHORTCUTS = [
  { group: 'Change the JSON', label: 'Format', button: elements.formatButton, run: () => press(elements.formatButton),
    keys: [{ shift: true, option: true, key: 'F', code: 'KeyF' }, { command: true, key: 'Enter', code: 'Enter' }] },
  { group: 'Change the JSON', label: 'Minify', button: elements.minifyButton, run: () => press(elements.minifyButton),
    keys: [{ shift: true, option: true, key: 'M', code: 'KeyM' }] },
  { group: 'Change the JSON', label: 'Stringify', button: elements.stringifyButton, run: () => press(elements.stringifyButton),
    keys: [{ shift: true, option: true, key: 'S', code: 'KeyS' }] },
  { group: 'Change the JSON', label: 'Repair', button: elements.repairButton, run: () => press(elements.repairButton),
    keys: [{ shift: true, option: true, key: 'R', code: 'KeyR' }] },
  { group: 'Change the JSON', label: 'Undo the last change',
    keys: [{ command: true, key: 'Z' }] },
  { group: 'File', label: 'Open file', run: () => elements.fileInput.click(),
    keys: [{ command: true, key: 'O', code: 'KeyO' }] },
  { group: 'File', label: 'Download', button: elements.downloadButton, run: () => press(elements.downloadButton),
    keys: [{ command: true, key: 'S', code: 'KeyS' }] },
  { group: 'View', label: 'Switch Text / Tree', run: toggleView,
    keys: [{ shift: true, option: true, key: 'T', code: 'KeyT' }] },
  { group: 'View', label: 'Show shortcuts', button: elements.shortcutsButton,
    run: () => elements.shortcutsDialog.showModal(), notWhileTyping: true,
    keys: [{ key: '?', character: '?' }] },
];

/* ---------- Events ---------- */

function bindEvents() {
  elements.input.addEventListener('input', handleTyping);
  elements.input.addEventListener('paste', handlePaste);

  elements.formatButton.addEventListener('click', () => applyAction('format'));
  elements.minifyButton.addEventListener('click', () => applyAction('minify'));
  elements.stringifyButton.addEventListener('click', () => applyAction('stringify'));
  elements.indentSelect.addEventListener('change', changeIndent);
  elements.sortKeysButton.addEventListener('click', toggleSortKeys);

  elements.fileInput.addEventListener('change', () => {
    openFile(elements.fileInput.files[0]);
    elements.fileInput.value = ''; // lets the same file be opened again
  });
  acceptDroppedFiles(elements.editorPane, openFile);
  elements.sampleButton.addEventListener('click', loadSample);
  elements.repairButton.hidden = !canRepair;
  elements.repairButton.addEventListener('click', repairInput);
  elements.errorRepairButton.addEventListener('click', repairInput);
  elements.errorShowButton.addEventListener('click', showErrorInInput);
  elements.clearButton.addEventListener('click', clearField);

  elements.textTab.addEventListener('click', () => showView('text'));
  elements.treeTab.addEventListener('click', () => showView('tree'));
  elements.downloadButton.addEventListener('click', downloadField);
  elements.copyButton.addEventListener('click', copyField);
  elements.themeButton.addEventListener('click', toggleTheme);

  bindShortcuts(SHORTCUTS);
  setUpShortcutsDialog({
    dialog: elements.shortcutsDialog,
    list: getElement('shortcut-groups'),
    openButton: elements.shortcutsButton,
    closeButton: getElement('shortcuts-close-button'),
  }, SHORTCUTS);
}

/* ---------- Start ---------- */

function restorePreferences() {
  const savedIndent = loadSetting('indent');
  const indentChoices = [...elements.indentSelect.options].map((option) => option.value);
  if (indentChoices.includes(savedIndent)) elements.indentSelect.value = savedIndent;
  elements.sortKeysButton.setAttribute('aria-pressed', String(loadSetting('sort') === '1'));
}

/** A reload keeps the field's text (for this tab only); a new tab starts with the sample. */
function loadInitialText() {
  const draft = loadDraft();
  editor.setText(draft?.trim() ? draft : formattedSample(), { undoable: false });
  refresh();
}

migrateOldSettings();
bindEvents();
restorePreferences();
loadInitialText();
enableOfflineUse();
