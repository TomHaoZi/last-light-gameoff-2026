import { SAVE_KEY, defaultProgress } from './simulation.js';
import { backUpSave, includeSaveGeneration, newSaveGeneration, withSaveSlot } from '../save-slot.js';

export function loadRun(storage) {
  let raw;
  try {
    raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { progress: null, issue: null, raw };
    const saved = JSON.parse(raw);
    if (saved?.schema === 1) {
      const { saveGeneration, ...progress } = saved;
      return { progress, issue: null, raw, saveGeneration };
    }
    return { progress: null, issue: 'protectedSave', raw };
  } catch (error) {
    return { progress: null, issue: error instanceof SyntaxError ? 'protectedSave' : 'saveFailed', raw };
  }
}

function writeRun(storage, bytes, expected) {
  const { issue, raw, saveGeneration } = loadRun(storage);
  if (issue) return { issue };
  if (expected !== undefined && raw !== expected) return { issue: 'staleSave' };
  const next = includeSaveGeneration(bytes, { saveGeneration });
  if (raw !== next) storage.setItem(SAVE_KEY, next);
  return { issue: null, raw: next };
}

export function storeRun(storage, progress) {
  try { return writeRun(storage, JSON.stringify(progress)).issue; }
  catch { return 'saveFailed'; }
}

export function openRun(storage) {
  return withSaveSlot(SAVE_KEY, loadRun, storage).catch(() => ({ ...loadRun(storage), issue: 'saveFailed', raw: undefined }));
}

export function commitRun(storage, progress, session) {
  const bytes = JSON.stringify(progress);
  const pending = (session.pending ?? Promise.resolve()).then(async () => {
    if (session.issue === 'staleSave' || session.issue === 'protectedSave' || session.raw === undefined) return session.issue ?? 'saveFailed';
    const { issue, raw } = await withSaveSlot(SAVE_KEY, slot => writeRun(slot, bytes, session.raw), storage);
    if (issue) session.issue = issue;
    else {
      session.raw = raw;
      session.progress = JSON.parse(bytes);
      session.issue = null;
    }
    return issue;
  }).catch(() => 'saveFailed');
  session.pending = pending;
  return pending;
}

export function restartRun(storage) {
  try {
    backUpSave(storage, SAVE_KEY + '-backup', storage.getItem(SAVE_KEY));
    storage.setItem(SAVE_KEY, JSON.stringify({ schema: 1, ...defaultProgress(), saveGeneration: newSaveGeneration() }));
    return true;
  } catch { return false; }
}

export function restartRunSession(storage) {
  return withSaveSlot(SAVE_KEY, slot => restartRun(slot) ? loadRun(slot) : null, storage).catch(() => null);
}
