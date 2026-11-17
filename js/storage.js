/**
 * What the app remembers in this browser.
 *
 * Settings (theme, indent, sort keys) are kept between visits in localStorage.
 * The JSON in the field is kept only for this tab, in sessionStorage: it survives a reload,
 * but is gone when the tab closes, so pasted secrets don't stay on the device.
 *
 * Storage can be blocked (private windows, strict privacy settings), so every access is wrapped:
 * the app works the same without it, it just won't remember.
 */

const KEY_PREFIX = 'curly-brace:';
const DRAFT_KEY = `${KEY_PREFIX}draft`;

// Before the rename to Curly Brace, keys started with "brace:"
const OLD_KEY_PREFIX = 'brace:';
const SETTINGS_TO_MOVE = ['theme', 'indent', 'sort'];

function read(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function write(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage is unavailable or full; there is nothing useful to tell the user.
  }
}

export function loadSetting(name) {
  return read(localStorage, KEY_PREFIX + name);
}

export function saveSetting(name, value) {
  write(localStorage, KEY_PREFIX + name, value);
}

export function loadDraft() {
  return read(sessionStorage, DRAFT_KEY);
}

export function saveDraft(text) {
  write(sessionStorage, DRAFT_KEY, text);
}

/**
 * Moves settings saved under the old "brace:" keys to the new ones, and deletes the old keys,
 * including the old long-lived draft. Safe to call on every start: once moved, there is nothing left.
 */
export function migrateOldSettings() {
  try {
    for (const name of SETTINGS_TO_MOVE) {
      const oldValue = localStorage.getItem(OLD_KEY_PREFIX + name);
      if (oldValue !== null && localStorage.getItem(KEY_PREFIX + name) === null) {
        localStorage.setItem(KEY_PREFIX + name, oldValue);
      }
      localStorage.removeItem(OLD_KEY_PREFIX + name);
    }
    localStorage.removeItem(`${OLD_KEY_PREFIX}draft`);
  } catch {
    // Storage is unavailable: there is nothing to move.
  }
}
