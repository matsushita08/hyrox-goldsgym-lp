import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { childEnv, regularPath, requireThat, safeRead } from './safety.mjs';

export const notRunChecks = () => [
  { name: 'javascript-syntax', status: 'not_run', reason: '検証未到達' },
  { name: 'change-lint', status: 'not_run', reason: '検証未到達' },
  { name: 'static-site', status: 'not_run', reason: '検証未到達' },
  { name: 'build', status: 'not_applicable', reason: '静的HTML/CSS/JSサイト。ビルド工程は存在しない' },
  { name: 'browser-visual', status: 'not_run', reason: 'ブラウザ表示・視覚確認は今回未実施' }
];

export function syntax(file, remainingMs) {
  requireThat(remainingMs > 0, 'TIME_BUDGET_EXCEEDED');
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: path.dirname(file), env: childEnv(), stdio: 'ignore', timeout: Math.ceil(remainingMs)
  });
  if (result.error?.code === 'ETIMEDOUT' || result.signal) requireThat(false, 'TIME_BUDGET_EXCEEDED');
  return result.status === 0;
}

export function runChecks(workspace, sourceRoot, task, changes, remainingMs) {
  const checks = notRunChecks();
  let syntaxOk = true;
  for (const file of fs.readdirSync(workspace).filter(n => n.endsWith('.js'))) {
    syntaxOk = syntax(regularPath(workspace, file), remainingMs()) && syntaxOk;
  }
  checks[0] = { name: 'javascript-syntax', status: 'executed', outcome: syntaxOk ? 'passed' : 'failed', method: 'node --check (実行せず構文解析)' };
  const lintOk = changes.every(c => c.added.every(line => !/[\t ]+$/.test(line) && !/^(<{7}|={7}|>{7})(?: |$)/.test(line)));
  checks[1] = { name: 'change-lint', status: 'executed', outcome: lintOk ? 'passed' : 'failed', method: '追加行の末尾空白・競合マーカー検査。完全なHTML/CSS Linterではない' };
  const html = safeRead(workspace, 'index.html');
  let staticOk = /<!doctype html>/i.test(html) && /<html\b/i.test(html) && /<\/html>/i.test(html) && /<body\b/i.test(html) && /<\/body>/i.test(html);
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']*)["']/gi)) {
    const raw = match[1];
    if (!raw || raw.startsWith('#') || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) continue;
    try {
      const relative = decodeURIComponent(raw.split(/[?#]/)[0]);
      // Only a read of existing static assets, no remote downloads or generated code execution.
      regularPath(fs.existsSync(path.join(workspace, relative)) ? workspace : sourceRoot, relative);
    } catch { staticOk = false; }
  }
  checks[2] = { name: 'static-site', status: 'executed', outcome: staticOk ? 'passed' : 'failed', method: 'HTML主要タグ・ローカルsrc/hrefの存在。描画・外部URL・JS内動的URLは未検証' };
  const criteria = task.acceptanceCriteria.map(c => {
    if (c.kind === 'manual') return { id: c.id, status: 'not_run', reason: '人間の確認待ち' };
    const text = safeRead(workspace, c.path);
    const ok = c.kind === 'js_syntax' ? syntax(path.join(workspace, c.path), remainingMs()) : c.kind === 'file_contains' ? text.includes(c.value) : !text.includes(c.value);
    return { id: c.id, status: 'executed', outcome: ok ? 'passed' : 'failed' };
  });
  return { checks, criteria, passed: checks.every(c => c.outcome !== 'failed') && criteria.every(c => c.outcome !== 'failed'), manualPending: criteria.some(c => c.status === 'not_run') };
}
