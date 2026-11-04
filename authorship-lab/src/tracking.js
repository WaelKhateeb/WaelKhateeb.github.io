// Unicode code points, so one emoji is not counted as two UTF-16 units.
export const characters = text => Array.from(text).length;
export const spaces = text => (text.match(/ /g) || []).length;

export function textDifference(before, after) {
  const a = Array.from(before), b = Array.from(after);
  let start = 0, endA = a.length, endB = b.length;
  while (start < endA && start < endB && a[start] === b[start]) start++;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  return { inserted: b.slice(start, endB).join(''), deleted: a.slice(start, endA).join('') };
}

// Read replacements from the actual ProseMirror steps, including equal-length
// replacements, rather than estimating edits from document length or key presses.
export function transactionChanges(transactions) {
  let inserted = '', deleted = '';
  for (const tr of transactions) {
    tr.steps.forEach((step, index) => {
      const before = tr.docs[index];
      const after = tr.docs[index + 1] || tr.doc;
      step.getMap().forEach((from, to, newFrom, newTo) => {
        deleted += before.textBetween(from, to, '\n', '');
        inserted += after.textBetween(newFrom, newTo, '\n', '');
      });
    });
  }
  return { inserted, deleted };
}

export function newSession() {
  return {
    version: 2, createdAt: Date.now(), startedAt: null, finishedAt: null,
    metrics: { typed: 0, spaces: 0, backspaces: 0, deleted: 0, pastes: 0, pasted: 0, pauses: 0, edits: 0, focus: 0 },
    events: [], snapshots: [{ at: Date.now(), reason: 'Initial state', doc: null }],
    document: null,
  };
}
