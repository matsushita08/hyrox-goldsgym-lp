import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { run, policy, toolRoot } from '../lib/runner.mjs';
import { validateTask, prioritize } from '../lib/task.mjs';
import { planChanges } from '../lib/changes.mjs';
import { propose } from '../lib/adapter.mjs';
import { childEnv, jsonInput, regularPath } from '../lib/safety.mjs';

const sample = JSON.parse(fs.readFileSync(path.join(toolRoot, 'examples/issue-task.json')));
const fixture = JSON.parse(fs.readFileSync(path.join(toolRoot, 'examples/fixture.json')));
const html = '<!DOCTYPE html>\n<html lang="ja"><head><link href="style.css" rel="stylesheet"></head><body><img src="assets/picture.svg"><script src="script.js"></script></body></html>\n';
function setup(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hyrox-phase1-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'assets'));
  fs.writeFileSync(path.join(root, 'assets/picture.svg'), '<svg/>');
  const originals = { 'index.html': html, 'script.js': 'const value = 1;\n', 'style.css': 'body { color: black; }\n', 'leaflet-fallback.css': '.map { display: block; }\n' };
  for (const [name, text] of Object.entries(originals)) fs.writeFileSync(path.join(root, name), text);
  return { root, task: structuredClone(sample), fixture: structuredClone(fixture), originals };
}
const code = expected => error => error.code === expected;
function state(root) { return JSON.parse(fs.readFileSync(path.join(root, '.ai-dev-runs/issue-1/state.json'))); }
function artifact(root, name) { return fs.readFileSync(path.join(root, '.ai-dev-runs/issue-1', name), 'utf8'); }

test('fixture成功: 元サイト不変、料金null、実施/未実施/該当なしを分離', async t => {
  const ctx = setup(t); const { state: result } = await run(ctx);
  assert.equal(result.status, 'completed'); assert.equal(result.apiConnected, false);
  assert.equal(result.cost.actualUsd, null); assert.equal(result.cost.upperBoundUsd, 0);
  assert.equal(result.checks.find(c => c.name === 'build').status, 'not_applicable');
  assert.equal(result.checks.find(c => c.name === 'browser-visual').status, 'not_run');
  assert.equal(result.checks.find(c => c.name === 'javascript-syntax').outcome, 'passed');
  for (const [name, text] of Object.entries(ctx.originals)) assert.equal(fs.readFileSync(path.join(ctx.root, name), 'utf8'), text);
  assert.match(artifact(ctx.root, 'workspace/index.html'), /AI DEV FIXTURE DEMO/);
  assert.match(artifact(ctx.root, 'proposal.diff'), /\+<!-- AI DEV FIXTURE DEMO -->/);
  assert.match(artifact(ctx.root, 'report.ja.md'), /API未接続/);
  assert.ok(result.durationMs > 0); assert.equal(result.attempts.length, 1);
});
test('dry-runは提案のみ、作業コピー作成とサイト検証をしない', async t => {
  const ctx = setup(t); const result = await run({ ...ctx, dryRun: true });
  assert.equal(result.state.status, 'dry_run_completed');
  assert.equal(fs.existsSync(path.join(result.directory, 'workspace')), false);
  assert.equal(result.state.checks[0].status, 'not_run');
  assert.ok(result.state.criteria.every(c => c.status === 'not_run'));
});
test('優先順位P0→P3、同順位はIssue番号順。重複ID拒否', () => {
  const tasks = [3, 2, 1].map(n => ({ ...structuredClone(sample), id: `task-${n}`, priority: n === 3 ? 'P0' : 'P2', issue: { ...sample.issue, number: n, url: `${sample.issue.url.slice(0, -1)}${n}` } }));
  assert.deepEqual(prioritize(tasks, policy).map(t => t.id), ['task-3', 'task-1', 'task-2']);
  assert.throws(() => prioritize([sample, sample], policy), code('DUPLICATE_TASK_ID'));
});
for (const [name, mutate, expected] of [
  ['優先順位欠落', t => delete t.priority, 'INVALID_FIELDS'],
  ['優先順位不正', t => t.priority = 'urgent', 'INVALID_PRIORITY'],
  ['完了条件なし', t => t.acceptanceCriteria = [], 'MISSING_ACCEPTANCE'],
  ['重複完了条件', t => t.acceptanceCriteria.push(t.acceptanceCriteria[0]), 'INVALID_CRITERION_ID'],
  ['対象不一致', t => t.issue.repository = 'other/repo', 'REPOSITORY_MISMATCH'],
  ['Issue URL不一致', t => t.issue.number = 42, 'ISSUE_URL_MISMATCH'],
  ['予算上限超過', t => t.budget.maxUsd = 1, 'COST_BUDGET_EXCEEDED'],
  ['時間上限超過', t => t.budget.maxSeconds = 121, 'TIME_BUDGET_EXCEEDED'],
  ['NaN予算', t => t.budget.maxUsd = NaN, 'COST_BUDGET_EXCEEDED'],
  ['自己変更', t => t.allowedPaths = ['ai-dev/cli.mjs'], 'PATH_NOT_ALLOWED'],
  ['workflow変更', t => t.allowedPaths = ['.github/workflows/a.yml'], 'PATH_NOT_ALLOWED'],
  ['認証ファイル変更', t => t.allowedPaths = ['.env'], 'PATH_NOT_ALLOWED'],
  ['完了条件の権限外パス', t => t.acceptanceCriteria[0].path = 'script.js', 'CRITERION_PATH_NOT_ALLOWED'],
  ['未知フィールド', t => t.command = 'echo unsafe', 'INVALID_FIELDS']
]) test(`入力拒否: ${name}`, () => {
  const task = structuredClone(sample); mutate(task);
  assert.throws(() => validateTask(task, policy), code(expected));
});
test('予算拒否ログは固定コードのみ', async t => {
  const ctx = setup(t); ctx.task.budget.maxUsd = 1;
  await assert.rejects(run(ctx), code('COST_BUDGET_EXCEEDED'));
  const log = fs.readFileSync(path.join(ctx.root, '.ai-dev-runs/rejections.jsonl'), 'utf8');
  assert.match(log, /COST_BUDGET_EXCEEDED/); assert.doesNotMatch(log, /ローカル模擬タスク/);
});
test('タスク外パス、traversal、絶対パス、秘密設定をfixtureから変更不可', t => {
  const ctx = setup(t);
  for (const target of ['../index.html', '/tmp/x', '.github/x', '.git/config', '.env', 'ai-dev/policy.json', 'script.js']) {
    assert.throws(() => planChanges([{ path: target, find: 'a', replace: 'b' }], ctx.originals, ctx.task, policy), code('PATH_NOT_ALLOWED'));
  }
});
test('変更量上限: 行、ファイル数、バイトを拒否', t => {
  const ctx = setup(t);
  assert.throws(() => planChanges([{ path: 'index.html', find: '<!DOCTYPE html>', replace: 'x\n'.repeat(32) }], ctx.originals, ctx.task, policy), code('CHANGE_LIMIT_EXCEEDED'));
  assert.throws(() => planChanges([{ path: 'index.html', find: '<!DOCTYPE html>', replace: 'x'.repeat(8200) }], ctx.originals, ctx.task, policy), code('CHANGE_LIMIT_EXCEEDED'));
  ctx.task.allowedPaths = policy.allowedPaths;
  assert.throws(() => planChanges(['index.html', 'script.js', 'style.css'].map(p => ({ path: p, find: ctx.originals[p], replace: 'x' })), ctx.originals, ctx.task, policy), code('CHANGE_LIMIT_EXCEEDED'));
});
test('一致なし・複数一致・変更なしを拒否', t => {
  const ctx = setup(t);
  for (const [find, replace, expected] of [['missing', 'x', 'FIND_NOT_UNIQUE'], ['html', 'x', 'FIND_NOT_UNIQUE'], ['<!DOCTYPE html>', '<!DOCTYPE html>', 'NO_CHANGES']]) {
    assert.throws(() => planChanges([{ path: 'index.html', find, replace }], ctx.originals, ctx.task, policy), code(expected));
  }
});
test('計画後の中断から再開、入力一致と累積時間を保持', async t => {
  const ctx = setup(t);
  await assert.rejects(run({ ...ctx, pauseAfter: 'planned' }), code('INTERRUPTED'));
  const first = state(ctx.root); assert.equal(first.status, 'interrupted'); assert.equal(first.stage, 'planned');
  const result = await run({ ...ctx, resume: true });
  assert.equal(result.state.status, 'completed'); assert.equal(result.state.attempts.length, 2);
  assert.ok(result.state.durationMs >= first.durationMs);
  assert.match(artifact(ctx.root, 'events.jsonl'), /proposal-restored/);
});
test('適用後中断の作業コピーが変更されても再構築して再検証', async t => {
  const ctx = setup(t);
  await assert.rejects(run({ ...ctx, pauseAfter: 'applied' }), code('INTERRUPTED'));
  fs.writeFileSync(path.join(ctx.root, '.ai-dev-runs/issue-1/workspace/index.html'), 'corrupted');
  const result = await run({ ...ctx, resume: true });
  assert.equal(result.state.status, 'completed'); assert.match(artifact(ctx.root, 'workspace/index.html'), /<!DOCTYPE html>/);
});
test('中断後に入力、元ソース、モード変更があれば再開拒否', async t => {
  const ctx = setup(t);
  await assert.rejects(run({ ...ctx, pauseAfter: 'planned' }), code('INTERRUPTED'));
  const changed = structuredClone(ctx.task); changed.description += '変更';
  await assert.rejects(run({ ...ctx, task: changed, resume: true }), code('RESUME_INPUT_CHANGED'));
  const changedFixture = structuredClone(ctx.fixture); changedFixture.edits[0].replace += '\n';
  await assert.rejects(run({ ...ctx, fixture: changedFixture, resume: true }), code('RESUME_INPUT_CHANGED'));
  await assert.rejects(run({ ...ctx, resume: true, dryRun: true }), code('RESUME_MODE_CHANGED'));
  fs.appendFileSync(path.join(ctx.root, 'style.css'), 'x');
  await assert.rejects(run({ ...ctx, resume: true }), code('RESUME_INPUT_CHANGED'));
  assert.equal(state(ctx.root).status, 'interrupted');
});
test('完了済み重複実行と別IDで同一Issueの重複実行を拒否', async t => {
  const ctx = setup(t); await run(ctx);
  await assert.rejects(run(ctx), code('TASK_ALREADY_EXISTS'));
  await assert.rejects(run({ ...ctx, task: { ...ctx.task, id: 'another-id' } }), code('TASK_ALREADY_EXISTS'));
  await assert.rejects(run({ ...ctx, resume: true }), code('TASK_ALREADY_COMPLETED'));
  assert.equal(state(ctx.root).attempts.length, 1);
});
test('同時実行を排他ロックで拒否し、実行終了時に解放', async t => {
  const ctx = setup(t);
  const first = run(ctx);
  await assert.rejects(run(ctx), code('TASK_LOCKED'));
  await first;
  assert.equal(fs.existsSync(path.join(ctx.root, '.ai-dev-runs/issue-1/run.lock')), false);
});
test('hard crash等で残ったロックは自動奪取しない', async t => {
  const ctx = setup(t); const dir = path.join(ctx.root, '.ai-dev-runs/issue-1');
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'run.lock'), 'unknown owner');
  await assert.rejects(run({ ...ctx, resume: true }), code('TASK_LOCKED'));
  assert.equal(fs.readFileSync(path.join(dir, 'run.lock'), 'utf8'), 'unknown owner');
});
test('AbortSignalで中断状態を保存してから再開できる', async t => {
  const ctx = setup(t); const controller = new AbortController(); controller.abort();
  await assert.rejects(run({ ...ctx, signal: controller.signal }), code('INTERRUPTED'));
  assert.equal(state(ctx.root).status, 'interrupted');
  assert.equal((await run({ ...ctx, resume: true })).state.status, 'completed');
});
test('累積時間上限に達した再開を拒否し失敗ログを保存', async t => {
  const ctx = setup(t);
  await assert.rejects(run({ ...ctx, pauseAfter: 'planned' }), code('INTERRUPTED'));
  const previous = state(ctx.root); previous.durationMs = ctx.task.budget.maxSeconds * 1000;
  fs.writeFileSync(path.join(ctx.root, '.ai-dev-runs/issue-1/state.json'), JSON.stringify(previous));
  await assert.rejects(run({ ...ctx, resume: true }), code('TIME_BUDGET_EXCEEDED'));
  assert.equal(state(ctx.root).status, 'failed'); assert.match(artifact(ctx.root, 'events.jsonl'), /TIME_BUDGET_EXCEEDED/);
});
test('構文・Lint・静的サイト・完了条件の失敗を記録', async t => {
  for (const kind of ['syntax', 'lint', 'static', 'criterion']) {
    const ctx = setup(t);
    if (kind === 'syntax') {
      ctx.task.allowedPaths.push('script.js');
      ctx.fixture.edits = [{ path: 'script.js', find: 'const value = 1;', replace: 'const = ;' }];
    }
    if (kind === 'lint') ctx.fixture.edits[0].replace += ' ';
    if (kind === 'static') ctx.fixture.edits[0].replace += '\n<img src="assets/missing.svg">';
    if (kind === 'criterion') ctx.task.acceptanceCriteria[0].value = 'not-present';
    await assert.rejects(run(ctx), code('VERIFICATION_FAILED'));
    assert.equal(state(ctx.root).status, 'failed'); assert.match(artifact(ctx.root, 'report.ja.md'), /failed/);
  }
});
test('人間の完了条件を自動合格にしない', async t => {
  const ctx = setup(t); ctx.task.acceptanceCriteria.push({ id: 'visual-review', kind: 'manual', description: '表示確認' });
  const result = await run(ctx);
  assert.equal(result.state.status, 'awaiting_review'); assert.equal(result.state.criteria.at(-1).status, 'not_run');
});
test('symlink、dangling symlink、認証入力パスを拒否', async t => {
  const ctx = setup(t);
  fs.unlinkSync(path.join(ctx.root, 'index.html')); fs.symlinkSync('/tmp/not-existing-phase1-secret', path.join(ctx.root, 'index.html'));
  await assert.rejects(run(ctx), code('SYMLINK_PATH'));
  assert.throws(() => regularPath(ctx.root, '../escape', false), code('UNSAFE_PATH'));
  assert.throws(() => jsonInput('/tmp/.codex/auth.json'), code('INPUT_PATH_FORBIDDEN'));
});
test('artifact symlinkから外へ書かない', async t => {
  const ctx = setup(t); const target = path.join(ctx.root, 'outside'); fs.mkdirSync(target);
  fs.symlinkSync(target, path.join(ctx.root, '.ai-dev-runs'));
  await assert.rejects(run(ctx), code('SYMLINK_PATH'));
  assert.deepEqual(fs.readdirSync(target), []);
});
test('再開scratch内のdangling symlinkから外へ書かない', async t => {
  const ctx = setup(t);
  await assert.rejects(run({ ...ctx, pauseAfter: 'applied' }), code('INTERRUPTED'));
  const inside = path.join(ctx.root, '.ai-dev-runs/issue-1/workspace/index.html');
  const outside = path.join(ctx.root, 'must-not-be-created');
  fs.unlinkSync(inside); fs.symlinkSync(outside, inside);
  await assert.rejects(run({ ...ctx, resume: true }), code('SYMLINK_PATH'));
  assert.equal(fs.existsSync(outside), false);
});
test('再開scratch内の余分なファイルを実行・削除せず拒否', async t => {
  const ctx = setup(t);
  await assert.rejects(run({ ...ctx, pauseAfter: 'applied' }), code('INTERRUPTED'));
  const extra = path.join(ctx.root, '.ai-dev-runs/issue-1/workspace/extra.js');
  fs.writeFileSync(extra, 'not trusted');
  await assert.rejects(run({ ...ctx, resume: true }), code('WORKSPACE_UNEXPECTED_FILE'));
  assert.equal(fs.readFileSync(extra, 'utf8'), 'not trusted');
});
test('子プロセスにトークン・HOME・NODE_OPTIONS・PATHを継承しない', () => {
  const env = childEnv();
  for (const name of ['GH_TOKEN', 'GITHUB_TOKEN', 'HOME', 'NODE_OPTIONS', 'PATH', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY']) assert.equal(Object.hasOwn(env, name), false);
  const result = spawnSync(process.execPath, ['-e', 'process.stdout.write(JSON.stringify(Object.keys(process.env).sort()))'], { env, encoding: 'utf8' });
  const keys = JSON.parse(result.stdout);
  // macOS may inject this noncredential locale key after exec, independently of inheritance.
  assert.deepEqual(keys.filter(k => k !== '__CF_USER_TEXT_ENCODING'), Object.keys(env).sort());
});
test('秘密らしい入力を固定コードで拒否し値をログに含めない', async t => {
  const ctx = setup(t); const fake = `ghp_${'a'.repeat(30)}`; ctx.task.description = fake;
  await assert.rejects(run(ctx), code('SECRET_LIKE_INPUT'));
  const log = fs.readFileSync(path.join(ctx.root, '.ai-dev-runs/rejections.jsonl'), 'utf8');
  assert.doesNotMatch(log, new RegExp(fake)); assert.match(log, /SECRET_LIKE_INPUT/);
});
test('Actionsは無効な下書きのみ。依存ライブラリなし', () => {
  const draft = fs.readFileSync(path.join(toolRoot, 'drafts/manual-workflow.yml.disabled'), 'utf8');
  assert.match(draft, /workflow_dispatch/); assert.match(draft, /if: \$\{\{ false \}\}/);
  assert.doesNotMatch(draft, /^\s+(?:push|pull_request|schedule):/m);
  const pkg = JSON.parse(fs.readFileSync(path.join(toolRoot, 'package.json')));
  assert.equal(pkg.dependencies, undefined); assert.equal(pkg.devDependencies, undefined);
});
test('生成JavaScriptの構文検査でコード本体を実行しない', async t => {
  const ctx = setup(t); const sentinel = path.join(ctx.root, 'should-never-exist');
  ctx.task.allowedPaths = ['script.js'];
  ctx.task.acceptanceCriteria = [{ id: 'syntax-only', kind: 'js_syntax', path: 'script.js' }];
  ctx.fixture.edits = [{ path: 'script.js', find: 'const value = 1;', replace: `const value = 1;\nrequire('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'unsafe');` }];
  assert.equal((await run(ctx)).state.status, 'completed');
  assert.equal(fs.existsSync(sentinel), false);
});
test('adapter実行時間の上限と中断を拒否コードにする', async t => {
  const ctx = setup(t);
  await assert.rejects(propose(ctx.fixture, ctx.root, 0), code('TIME_BUDGET_EXCEEDED'));
  await assert.rejects(propose(ctx.fixture, ctx.root, 1), code('TIME_BUDGET_EXCEEDED'));
  const controller = new AbortController();
  const pending = propose(ctx.fixture, ctx.root, 30000, controller.signal); controller.abort();
  await assert.rejects(pending, code('INTERRUPTED'));
});
