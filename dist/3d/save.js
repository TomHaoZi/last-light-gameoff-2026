import { SAVE_KEY, defaultProgress } from './simulation.js';

export function loadRun(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { progress: null, issue: null };
    const progress = JSON.parse(raw);
    if (progress?.schema === 1) return { progress, issue: null };
    return { progress: null, issue: 'protectedSave' };
  } catch (error) {
    return { progress: null, issue: error instanceof SyntaxError ? 'protectedSave' : 'saveFailed' };
  }
}

export function storeRun(storage, progress) {
  // Another tab may have upgraded this slot while our game was open.
  const { issue } = loadRun(storage);
  if (issue) return issue;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(progress));
    return null;
  } catch { return 'saveFailed'; }
}

export function restartRun(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw !== null) storage.setItem(SAVE_KEY + '-backup', raw);
    storage.setItem(SAVE_KEY, JSON.stringify({ schema: 1, ...defaultProgress() }));
    return true;
  } catch { return false; }
}
