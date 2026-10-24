import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { validateTask } from './task.mjs';
import { propose, validateFixture } from './adapter.mjs';
import { planChanges, patchText, writeWorkspace } from './changes.mjs';
import { notRunChecks, runChecks } from './checks.mjs';
import { atomicJson, canonicalHash, errorCode, GuardError, hash, regularPath, requireThat, safeRead } from './safety.mjs';

export const toolRoot = fileURLToPath(new URL('..', import.meta.url));
export const policy = JSON.parse(fs.readFileSync(path.join(toolRoot, 'policy.json'), 'utf8'));

function engineHash() {
  const files = ['cli.mjs', 'policy.json', 'adapters/fixture.mjs', ...fs.readdirSync(path.join(toolRoot, 'lib')).filter(f => f.endsWith('.mjs')).sort().map(f => `lib/${f}`)];
  return canonicalHash(files.map(f => [f, hash(safeRead(toolRoot, f))]));
}
function artifactDirectory(root, relative) {
  const target = regularPath(root, relative, false);
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  requireThat(fs.realpathSync(target) === target, 'SYMLINK_PATH');
  return target;
}
function appendSafe(root, relative, data) {
  const file = regularPath(root, relative, false);
  fs.appendFileSync(file, `${JSON.stringify(data)}\n`, { mode: 0o600 });
}
function save(state, dir) {
  regularPath(dir, 'state.json', false);
  atomicJson(path.join(dir, 'state.json'), state);
}
function report(state) {
  const names = { executed: '実施', not_run: '未実施', not_applicable: '該当なし' };
  return [
    '# AI開発社員 Phase 1 ローカル報告', '',
    'API未接続・fixtureによる模擬修正。AIによる実運用の自動修正ではありません。',
    `タスク: ${state.taskId} / Issue #${state.issueNumber} / ${state.priority}`,
    `結果: ${state.status} / モード: ${state.mode} / チェックポイント: ${state.stage}`,
    `エラーコード: ${state.errorCode ?? 'なし'}`,
    `累積実行時間: ${state.durationMs} ms（実行処理のみ・中断待機時間は含まない）`,
    '実料金 USD: 未取得 (null)。fixtureに有料API呼出しなし。料金取得・請求連携なし。',
    `変更量: ${state.metrics ? JSON.stringify(state.metrics) : '未確定'}`, '',
    ...state.checks.map(c => `- ${c.name}: ${names[c.status]}${c.outcome ? ` / ${c.outcome}` : ''} / ${c.reason ?? c.method ?? ''}`),
    ...state.criteria.map(c => `- 完了条件 ${c.id}: ${names[c.status]}${c.outcome ? ` / ${c.outcome}` : ''}${c.reason ? ` / ${c.reason}` : ''}`), '',
    '変更先はこの実行のworkspaceだけです。元サイト、main、GitHub Issueは変更していません。',
    'push・PR作成・本番公開・外部送信: 未実施。ブラウザ確認・人間レビューは別途必要です。',
    'ローカルMac実行です。クラウド実行・Macスリープ非依存は未達成です。', ''
  ].join('\n');
}

export async function run({ root, task, fixture, resume = false, dryRun = false, pauseAfter, signal }) {
  root = fs.realpathSync(root);
  const runs = artifactDirectory(root, '.ai-dev-runs');
  try {
    validateTask(task, policy); validateFixture(fixture);
    requireThat(!pauseAfter || ['planned', 'applied'].includes(pauseAfter), 'INVALID_PAUSE_STAGE');
  } catch (error) {
    appendSafe(runs, 'rejections.jsonl', { at: new Date().toISOString(), code: errorCode(error) });
    throw error;
  }
  // Key by Issue, not just user-supplied ID: alternate IDs cannot duplicate the same issue.
  const dir = artifactDirectory(runs, `issue-${task.issue.number}`);
  const lock = regularPath(dir, 'run.lock', false);
  let lockHandle;
  try { lockHandle = fs.openSync(lock, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') {
      appendSafe(runs, 'rejections.jsonl', { at: new Date().toISOString(), issueNumber: task.issue.number, code: 'TASK_LOCKED' });
      throw new GuardError('TASK_LOCKED');
    }
    throw error;
  }
  fs.writeSync(lockHandle, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
  const started = performance.now();
  let state; let priorDuration = 0; let ownsState = false;
  const duration = () => Math.ceil(priorDuration + performance.now() - started);
  const remainingMs = () => {
    requireThat(!signal?.aborted, 'INTERRUPTED');
    const remaining = task.budget.maxSeconds * 1000 - duration();
    requireThat(remaining > 0, 'TIME_BUDGET_EXCEEDED');
    return remaining;
  };
  const event = (type, extra = {}) => appendSafe(dir, 'events.jsonl', { at: new Date().toISOString(), type, ...extra });
  const checkpoint = stage => {
    state.stage = stage; state.durationMs = duration();
    save(state, dir); event('checkpoint', { stage });
    remainingMs();
    if (pauseAfter === stage) throw new GuardError('INTERRUPTED');
  };
  try {
    const originals = Object.fromEntries(policy.allowedPaths.map(name => [name, safeRead(root, name, policy.maxFileBytes)]));
    const inputs = { task: canonicalHash(task), fixture: canonicalHash(fixture), engine: engineHash(), source: canonicalHash(originals) };
    const stateFile = regularPath(dir, 'state.json', false);
    if (fs.existsSync(stateFile)) {
      requireThat(resume, 'TASK_ALREADY_EXISTS');
      state = JSON.parse(safeRead(dir, 'state.json', 1048576));
      requireThat(!['completed', 'dry_run_completed', 'awaiting_review'].includes(state.status), 'TASK_ALREADY_COMPLETED');
      requireThat(canonicalHash(state.inputs) === canonicalHash(inputs), 'RESUME_INPUT_CHANGED');
      requireThat(Number.isFinite(state.durationMs) && state.durationMs >= 0, 'INVALID_STATE');
      priorDuration = state.durationMs;
    } else {
      requireThat(!resume, 'NO_STATE_TO_RESUME');
      state = {
        version: 1, taskId: task.id, issueNumber: task.issue.number, priority: task.priority,
        mode: dryRun ? 'dry-run-plan-only' : 'fixture-workspace-only',
        status: 'running', stage: 'initialized', inputs, apiConnected: false,
        cost: { actualUsd: null, upperBoundUsd: 0, source: 'fixture-no-api-no-billing-data' },
        startedAt: new Date().toISOString(), durationMs: 0, attempts: [],
        checks: notRunChecks(), criteria: task.acceptanceCriteria.map(c => ({ id: c.id, status: 'not_run', reason: '検証未到達' }))
      };
    }
    requireThat(state.mode === (dryRun ? 'dry-run-plan-only' : 'fixture-workspace-only'), 'RESUME_MODE_CHANGED');
    ownsState = true;
    state.status = 'running'; state.errorCode = null;
    state.attempts.push({ startedAt: new Date().toISOString(), resumed: resume });
    save(state, dir); event(resume ? 'resumed' : 'started'); remainingMs();
    const adapterCwd = artifactDirectory(dir, 'adapter-cwd');
    // Recompute any persisted proposal from validated fixture and hashes. Never trust scratch outputs on resume.
    let edits;
    if (resume && state.stage !== 'initialized') {
      edits = fixture.edits;
      event('proposal-restored');
    } else {
      const proposal = await propose(fixture, adapterCwd, remainingMs(), signal);
      requireThat(proposal.costUpperBoundUsd <= task.budget.maxUsd, 'COST_BUDGET_EXCEEDED');
      edits = proposal.edits;
    }
    const { changes, metrics } = planChanges(edits, originals, task, policy);
    state.metrics = metrics;
    checkpoint('planned');
    // Patch is a review artifact, not applied to the repository.
    const patch = regularPath(dir, 'proposal.diff', false);
    fs.writeFileSync(patch, patchText(changes), { mode: 0o600 });
    if (dryRun) {
      state.status = 'dry_run_completed'; state.stage = 'dry-run-complete';
      state.checks = notRunChecks().map(c => c.status === 'not_run' ? { ...c, reason: 'dry-runは提案と制限検証のみ。変更適用・サイト検証は未実施' } : c);
    } else {
      const workspace = artifactDirectory(dir, 'workspace');
      // Reconstruct after interruption, including a crash in the middle of writing files.
      writeWorkspace(workspace, originals, changes); checkpoint('applied');
      const validation = runChecks(workspace, root, task, changes, remainingMs);
      state.checks = validation.checks; state.criteria = validation.criteria;
      checkpoint('verified');
      requireThat(validation.passed, 'VERIFICATION_FAILED');
      state.status = validation.manualPending ? 'awaiting_review' : 'completed';
    }
    remainingMs(); event('finished', { status: state.status });
  } catch (error) {
    if (ownsState) {
      state.errorCode = errorCode(error);
      state.status = state.errorCode === 'INTERRUPTED' ? 'interrupted' : 'failed';
      event('stopped', { code: state.errorCode, stage: state.stage });
    } else {
      appendSafe(runs, 'rejections.jsonl', { at: new Date().toISOString(), issueNumber: task.issue.number, code: errorCode(error) });
    }
    throw error;
  } finally {
    try {
      if (ownsState) {
        state.durationMs = duration(); state.updatedAt = new Date().toISOString();
        const attempt = state.attempts.at(-1);
        attempt.durationMs = Math.ceil(performance.now() - started); attempt.status = state.status;
        save(state, dir);
        fs.writeFileSync(regularPath(dir, 'report.ja.md', false), report(state), { mode: 0o600 });
      }
    } finally {
      fs.closeSync(lockHandle); fs.unlinkSync(lock);
    }
  }
  return { state, directory: dir };
}
