import { exactKeys, noSecrets, requireThat, string } from './safety.mjs';

export function validateTask(task, policy) {
  noSecrets(task);
  exactKeys(task, ['schemaVersion', 'id', 'issue', 'priority', 'description', 'allowedPaths', 'acceptanceCriteria', 'budget']);
  requireThat(task.schemaVersion === 1, 'SCHEMA_VERSION');
  requireThat(typeof task.id === 'string' && /^[a-z0-9][a-z0-9-]{2,63}$/.test(task.id), 'INVALID_TASK_ID');
  exactKeys(task.issue, ['repository', 'number', 'title', 'url']);
  requireThat(task.issue.repository === policy.repository, 'REPOSITORY_MISMATCH');
  requireThat(Number.isSafeInteger(task.issue.number) && task.issue.number > 0, 'INVALID_ISSUE');
  string(task.issue.title, 1, 200);
  requireThat(task.issue.url === `https://github.com/${policy.repository}/issues/${task.issue.number}`, 'ISSUE_URL_MISMATCH');
  requireThat(['P0', 'P1', 'P2', 'P3'].includes(task.priority), 'INVALID_PRIORITY');
  string(task.description, 1, 4000);
  requireThat(Array.isArray(task.allowedPaths) && task.allowedPaths.length > 0 && new Set(task.allowedPaths).size === task.allowedPaths.length, 'INVALID_ALLOWED_PATHS');
  requireThat(task.allowedPaths.every(p => policy.allowedPaths.includes(p)), 'PATH_NOT_ALLOWED');
  requireThat(Array.isArray(task.acceptanceCriteria) && task.acceptanceCriteria.length > 0 && task.acceptanceCriteria.length <= 20, 'MISSING_ACCEPTANCE');
  const ids = new Set();
  for (const criterion of task.acceptanceCriteria) {
    requireThat(['file_contains', 'file_not_contains', 'js_syntax', 'manual'].includes(criterion.kind), 'INVALID_CRITERION');
    exactKeys(criterion, criterion.kind === 'manual' ? ['id', 'kind', 'description'] : criterion.kind === 'js_syntax' ? ['id', 'kind', 'path'] : ['id', 'kind', 'path', 'value']);
    requireThat(typeof criterion.id === 'string' && /^[a-z0-9-]{1,64}$/.test(criterion.id) && !ids.has(criterion.id), 'INVALID_CRITERION_ID');
    ids.add(criterion.id);
    if (criterion.kind === 'manual') string(criterion.description);
    else {
      requireThat(task.allowedPaths.includes(criterion.path), 'CRITERION_PATH_NOT_ALLOWED');
      if (criterion.kind === 'js_syntax') requireThat(criterion.path.endsWith('.js'), 'INVALID_CRITERION');
      else string(criterion.value, 1, 2000);
    }
  }
  exactKeys(task.budget, ['maxSeconds', 'maxUsd']);
  requireThat(Number.isFinite(task.budget.maxSeconds) && task.budget.maxSeconds >= 0.01 && task.budget.maxSeconds <= policy.maxTaskSeconds, 'TIME_BUDGET_EXCEEDED');
  requireThat(Number.isFinite(task.budget.maxUsd) && task.budget.maxUsd >= 0 && task.budget.maxUsd <= policy.maxTaskUsd, 'COST_BUDGET_EXCEEDED');
  return task;
}

export function prioritize(tasks, policy) {
  tasks.forEach(t => validateTask(t, policy));
  requireThat(new Set(tasks.map(t => t.id)).size === tasks.length, 'DUPLICATE_TASK_ID');
  return [...tasks].sort((a, b) => a.priority.localeCompare(b.priority) || a.issue.number - b.issue.number || a.id.localeCompare(b.id));
}
