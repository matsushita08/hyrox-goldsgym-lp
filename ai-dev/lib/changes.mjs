import fs from 'node:fs';
import { requireThat, noSecrets, regularPath } from './safety.mjs';

function span(before, after) {
  const oldLines = before.split('\n'); const newLines = after.split('\n');
  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;
  let endOld = oldLines.length; let endNew = newLines.length;
  while (endOld > start && endNew > start && oldLines[endOld - 1] === newLines[endNew - 1]) { endOld--; endNew--; }
  return { start, removed: oldLines.slice(start, endOld), added: newLines.slice(start, endNew) };
}

export function planChanges(edits, originals, task, policy) {
  const planned = new Map();
  for (const edit of edits) {
    requireThat(policy.allowedPaths.includes(edit.path) && task.allowedPaths.includes(edit.path), 'PATH_NOT_ALLOWED');
    requireThat(Object.hasOwn(originals, edit.path), 'MISSING_FILE');
    noSecrets(edit);
    const before = planned.get(edit.path) ?? originals[edit.path];
    const first = before.indexOf(edit.find);
    requireThat(first >= 0 && before.indexOf(edit.find, first + 1) < 0, 'FIND_NOT_UNIQUE');
    planned.set(edit.path, before.slice(0, first) + edit.replace + before.slice(first + edit.find.length));
  }
  const changes = [...planned].filter(([name, after]) => originals[name] !== after).map(([name, after]) => {
    requireThat(Buffer.byteLength(after) <= policy.maxFileBytes, 'FILE_TOO_LARGE');
    const diff = span(originals[name], after);
    return { path: name, after, ...diff };
  });
  requireThat(changes.length > 0, 'NO_CHANGES');
  const metrics = {
    files: changes.length,
    addedLines: changes.reduce((n, c) => n + c.added.length, 0),
    deletedLines: changes.reduce((n, c) => n + c.removed.length, 0),
    changedBytes: changes.reduce((n, c) => n + Buffer.byteLength(c.added.join('\n')) + Buffer.byteLength(c.removed.join('\n')), 0)
  };
  requireThat(metrics.files <= policy.maxFiles && metrics.addedLines <= policy.maxAddedLines && metrics.deletedLines <= policy.maxDeletedLines && metrics.changedBytes <= policy.maxChangedBytes, 'CHANGE_LIMIT_EXCEEDED');
  return { changes, metrics };
}

export function patchText(changes) {
  return changes.map(c => `--- a/${c.path}\n+++ b/${c.path}\n@@ -${c.start + 1},${c.removed.length} +${c.start + 1},${c.added.length} @@\n${[...c.removed.map(l => `-${l}`), ...c.added.map(l => `+${l}`)].join('\n')}\n`).join('');
}

export function writeWorkspace(workspace, originals, changes) {
  fs.mkdirSync(workspace, { recursive: true, mode: 0o700 });
  requireThat(fs.readdirSync(workspace).every(name => Object.hasOwn(originals, name)), 'WORKSPACE_UNEXPECTED_FILE');
  for (const [name, text] of Object.entries(originals)) {
    const target = regularPath(workspace, name, false);
    fs.writeFileSync(target, changes.find(c => c.path === name)?.after ?? text, { mode: 0o600 });
  }
}
