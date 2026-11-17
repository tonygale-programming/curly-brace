/**
 * Remembers the key order from before Sort keys was turned on, so turning it off can bring that order back.
 *
 * The memory only holds while the field still shows exactly what sorting produced. After an edit, the old
 * order no longer matches the JSON, so the next sorted action starts from the edited text instead.
 */
export function createSortMemory() {
  let unsortedData = null;
  let sortedText = null;

  return {
    /** Call before a sorted action, with the field's text and the data about to be sorted. */
    beforeSorting(currentText, data) {
      if (currentText !== sortedText) unsortedData = data;
    },

    /** Call after a sorted action, with the text it put in the field. */
    afterSorting(outputText) {
      sortedText = outputText;
    },

    /**
     * Call when Sort keys is turned off. Returns the data in its old order, or null when the field
     * was edited since sorting. Either way the memory is cleared.
     */
    takeUnsortedData(currentText) {
      const data = currentText === sortedText ? unsortedData : null;
      unsortedData = null;
      sortedText = null;
      return data;
    },
  };
}
