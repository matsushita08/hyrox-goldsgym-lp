import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class GuardError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function requireThat(condition, code) {
  if (!condition) throw new GuardError(code);
}
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const canonicalHash = value => hash(JSON.stringify(value));
export const childEnv = () => ({ LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', TZ: 'UTC' });
// No task text, subprocess output, environment dump or exception stack is logged.
export function errorCode(error) {
  return error instanceof GuardError ? error.code : 'INTERNAL_ERROR';
}
export function noSecrets(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  requireThat(!/(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,}|sk-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:authorization|password|api[_-]?key|access[_-]?token)\s*["']?\s*[:=]\s*["']?[^\s"',}]{6,})/i.test(text), 'SECRET_LIKE_INPUT');
}
export function regularPath(root, relative, mustExist = true) {
  requireThat(typeof relative === 'string' && relative.length > 0 && !path.isAbsolute(relative), 'UNSAFE_PATH');
  const parts = relative.split('/');
  requireThat(parts.every(p => p && p !== '.' && p !== '..' && !p.includes('\\') && !p.includes('\0')), 'UNSAFE_PATH');
  requireThat(fs.realpathSync(root) === path.resolve(root), 'SYMLINK_ROOT');
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat) requireThat(!stat.isSymbolicLink(), 'SYMLINK_PATH');
    else requireThat(!mustExist, 'MISSING_FILE');
  }
  if (mustExist) requireThat(fs.statSync(current).isFile(), 'NOT_REGULAR_FILE');
  return current;
}
export function safeRead(root, relative, limit = 2097152) {
  const target = regularPath(root, relative);
  requireThat(fs.statSync(target).size <= limit, 'FILE_TOO_LARGE');
  return fs.readFileSync(target, 'utf8');
}
export function jsonInput(file) {
  const absolute = path.resolve(file);
  const forbidden = /(?:^|\/)(?:\.env[^/]*|\.claude|\.codex|\.aws|\.ssh|\.config|auth[^/]*|credentials[^/]*|secrets?[^/]*)(?:\/|$)/i;
  requireThat(absolute.endsWith('.json') && !forbidden.test(absolute), 'INPUT_PATH_FORBIDDEN');
  requireThat(!fs.lstatSync(absolute).isSymbolicLink() && fs.statSync(absolute).size <= 65536, 'INPUT_FILE_INVALID');
  requireThat(!forbidden.test(fs.realpathSync(absolute)), 'INPUT_PATH_FORBIDDEN');
  const raw = fs.readFileSync(absolute, 'utf8');
  noSecrets(raw);
  try { return JSON.parse(raw); } catch { throw new GuardError('INVALID_JSON'); }
}
export function atomicJson(file, value) {
  const temp = `${file}.next`;
  regularPath(path.dirname(file), path.basename(temp), false);
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, file);
}
export function exactKeys(value, required, optional = []) {
  requireThat(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_OBJECT');
  requireThat(required.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => [...required, ...optional].includes(k)), 'INVALID_FIELDS');
}
export function string(value, min = 1, max = 1000) {
  requireThat(typeof value === 'string' && value.trim().length >= min && value.length <= max && !value.includes('\0'), 'INVALID_STRING');
}
