/**
 * The tree view and its controls: showing the tree for the current JSON, selecting a key,
 * the path bar with Copy path and Copy value, and the Expand all / Collapse all button.
 * The tree itself is drawn by tree-view.js.
 */
import { renderTree, expandAll, collapseAll, selectNode, EXPAND_ALL_LIMIT } from './tree-view.js';
import { stringifyJson } from './json-engine.js';
import { showToast, copyToClipboard } from './notifications.js';

/**
 * @param elements { view, root, pathBar, selectedPath, expandToggle, copyPathButton, copyValueButton }
 * @param getIndent returns the indent chosen in the toolbar, used by Copy value
 */
export function createTreePanel(elements, { getIndent }) {
  const { view, root, pathBar, selectedPath, expandToggle, copyPathButton, copyValueButton } = elements;
  let shownText = null;
  let selectedValue;

  /** Shows or hides the tree with its path bar and Expand button. */
  function setVisible(isVisible) {
    view.hidden = !isVisible;
    pathBar.hidden = !isVisible;
    expandToggle.hidden = !isVisible;
  }

  /** Draws the tree for this JSON. Switching views back and forth keeps the tree as it was. */
  function show(data, sourceText) {
    if (sourceText === shownText) return;
    shownText = sourceText;
    renderTree(root, data);
    selectedPath.textContent = '$';
    selectedValue = data;
    expandToggle.setAttribute('aria-expanded', 'false');
  }

  function selectKey(event) {
    if (!event.target.classList.contains('tree-key')) return;
    event.preventDefault();
    const selection = selectNode(root, event.target);
    if (!selection) return;
    selectedPath.textContent = selection.path;
    selectedValue = selection.value;
  }

  function copyValue() {
    // A string is copied as its text; anything else as JSON
    const text = typeof selectedValue === 'string' ? selectedValue : stringifyJson(selectedValue, getIndent());
    copyToClipboard(text, 'Copied value', selectedPath);
  }

  /** One button: Expand all, then Collapse all. Its label always says what the next press does. */
  function toggleExpansion() {
    const isExpanded = expandToggle.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      collapseAll(root);
    } else if (!expandAll(root)) {
      showToast(`Expanded the first ${EXPAND_ALL_LIMIT.toLocaleString()} nodes`);
    }
    expandToggle.setAttribute('aria-expanded', String(!isExpanded));
  }

  root.addEventListener('click', selectKey);
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') selectKey(event);
  });
  copyPathButton.addEventListener('click', () => copyToClipboard(selectedPath.textContent, 'Copied path', selectedPath));
  copyValueButton.addEventListener('click', copyValue);
  expandToggle.addEventListener('click', toggleExpansion);

  return { setVisible, show };
}
