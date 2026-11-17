/**
 * Files the visitor opens or drops on the page. They are read inside the browser; nothing is uploaded.
 */

// Larger files would freeze the tab while they are parsed, coloured and drawn.
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = '10 MB';

/** Reads a file as text. Rejects with a message people can read when it is too large or unreadable. */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_BYTES) {
      reject(new Error(`${file.name} is larger than ${MAX_FILE_SIZE_LABEL}, too big to open here.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsText(file);
  });
}

const hasFiles = (event) => Boolean(event.dataTransfer?.types.includes('Files'));

/**
 * Accepts a file dropped anywhere on the page. dropTarget gets the is-dragging class while a file is
 * dragged over, so the field lights up; onFile receives the dropped file.
 */
export function acceptDroppedFiles(dropTarget, onFile) {
  const showDropTarget = (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault(); // without this the browser would open the file instead of handing it over
    dropTarget.classList.add('is-dragging');
  };
  const hideDropTarget = () => dropTarget.classList.remove('is-dragging');

  document.addEventListener('dragenter', showDropTarget);
  document.addEventListener('dragover', showDropTarget);
  document.addEventListener('dragleave', (event) => {
    if (!event.relatedTarget) hideDropTarget(); // the pointer left the window
  });
  document.addEventListener('drop', (event) => {
    hideDropTarget();
    if (!event.dataTransfer?.files.length) return;
    event.preventDefault();
    onFile(event.dataTransfer.files[0]);
  });
}
