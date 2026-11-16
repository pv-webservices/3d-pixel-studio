// Reorderable list behaviour: drag and drop for pointer users, Move up/down buttons for everyone.
// Lists are immutable arrays; every change produces a new array passed to onChange.

export const moveItem = (items, from, to) => {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const removeAt = (items, index) => items.filter((_, i) => i !== index);

/**
 * Wire HTML5 drag and drop on a list container whose children carry data-index.
 * @param {HTMLElement} list
 * @param {(from: number, to: number) => void} onMove
 */
export function enableDragSort(list, onMove) {
  let from = null;
  list.addEventListener('dragstart', (e) => {
    const item = e.target.closest('[data-index]');
    if (!item) return;
    from = Number(item.dataset.index);
    item.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(from));
  });
  list.addEventListener('dragover', (e) => {
    const item = e.target.closest('[data-index]');
    if (from === null || !item) return;
    e.preventDefault();
    list.querySelectorAll('.is-drop-target').forEach((el) => el !== item && el.classList.remove('is-drop-target'));
    item.classList.add('is-drop-target');
  });
  list.addEventListener('drop', (e) => {
    const item = e.target.closest('[data-index]');
    if (from === null || !item) return;
    e.preventDefault();
    const to = Number(item.dataset.index);
    const origin = from;
    from = null;
    onMove(origin, to);
  });
  list.addEventListener('dragend', () => {
    from = null;
    list.querySelectorAll('.is-dragging, .is-drop-target').forEach((el) => el.classList.remove('is-dragging', 'is-drop-target'));
  });
}
