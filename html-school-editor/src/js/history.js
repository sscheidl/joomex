// One undo/redo history for the whole document, shared by both panes. Entries are complete text states.
// Typing in one pane is grouped into steps (a pause of one second or four seconds of typing start a new step).
export function createHistory(limitChars) {
  let entries = [], index = -1, size = 0;
  return {
    reset(text) { entries = [{ text, kind: 'load', time: 0, started: 0 }]; index = 0; size = text.length; },
    record(text, kind, now) {
      const top = entries[index];
      if (top.text === text) return;
      const typing = kind === 'src-type' || kind === 'vis-type';
      if (typing && index > 0 && index === entries.length - 1 && top.kind === kind && now - top.time < 1000 && now - top.started < 4000) {
        size += text.length - top.text.length;
        top.text = text;
        top.time = now;
        return;
      }
      for (let i = entries.length - 1; i > index; i--) size -= entries[i].text.length;
      entries.length = index + 1;
      entries.push({ text, kind, time: now, started: now });
      index++;
      size += text.length;
      while ((entries.length > 300 || size > limitChars) && index > 1) { size -= entries[0].text.length; entries.shift(); index--; }
    },
    seal() { if (index >= 0) entries[index].time = 0; },
    undo() { if (index <= 0) return null; index--; entries[index].time = 0; return entries[index]; },
    redo() { if (index >= entries.length - 1) return null; index++; entries[index].time = 0; return entries[index]; },
    canUndo() { return index > 0; },
    canRedo() { return index < entries.length - 1; },
    count() { return entries.length; },
  };
}
