#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { run, policy, toolRoot } from './lib/runner.mjs';
import { prioritize, validateTask } from './lib/task.mjs';
import { childEnv, errorCode, jsonInput, requireThat } from './lib/safety.mjs';

const root = path.resolve(toolRoot, '..');
const args = process.argv.slice(2); const command = args.shift();
const controller = new AbortController();
process.once('SIGINT', () => controller.abort());
process.once('SIGTERM', () => controller.abort());
try {
  if (command === 'self-check') {
    requireThat(args.length === 0, 'UNKNOWN_ARGUMENT');
    const files = ['cli.mjs', ...['lib', 'adapters', 'test'].flatMap(dir => fs.readdirSync(path.join(toolRoot, dir)).filter(f => f.endsWith('.mjs')).map(f => `${dir}/${f}`))];
    for (const file of files) {
      const result = spawnSync(process.execPath, ['--check', path.join(toolRoot, file)], { env: childEnv(), stdio: 'ignore', timeout: 10000 });
      requireThat(result.status === 0, 'TOOL_SYNTAX_FAILED');
      requireThat(!/[\t ]+$/m.test(fs.readFileSync(path.join(toolRoot, file), 'utf8')), 'TOOL_WHITESPACE_FAILED');
    }
    console.log(JSON.stringify({ status: 'executed', outcome: 'passed', files: files.length, method: 'node --check + trailing whitespace' }));
  } else if (command === 'queue') {
    requireThat(args.length > 0 && args.every(a => !a.startsWith('-')), 'TASK_FILES_REQUIRED');
    console.log(JSON.stringify(prioritize(args.map(jsonInput), policy).map(t => ({ id: t.id, issue: t.issue.number, priority: t.priority })), null, 2));
  } else if (['validate', 'run', 'resume'].includes(command)) {
    const options = {};
    while (args.length) {
      const flag = args.shift();
      requireThat(['--task', '--fixture', '--dry-run', '--pause-after'].includes(flag) && !Object.hasOwn(options, flag), 'UNKNOWN_ARGUMENT');
      options[flag] = flag === '--dry-run' ? true : args.shift();
      requireThat(options[flag] !== undefined, 'MISSING_ARGUMENT');
    }
    requireThat(options['--task'], 'TASK_REQUIRED');
    const task = jsonInput(options['--task']);
    if (command === 'validate') {
      validateTask(task, policy);
      requireThat(Object.keys(options).length === 1, 'UNKNOWN_ARGUMENT');
      console.log(JSON.stringify({ status: 'valid', id: task.id, priority: task.priority }));
    } else {
      requireThat(options['--fixture'], 'FIXTURE_REQUIRED');
      const result = await run({ root, task, fixture: jsonInput(options['--fixture']), resume: command === 'resume', dryRun: !!options['--dry-run'], pauseAfter: options['--pause-after'], signal: controller.signal });
      console.log(JSON.stringify({ status: result.state.status, mode: result.state.mode, apiConnected: false, actualCostUsd: null, directory: path.relative(root, result.directory) }));
    }
  } else {
    console.log('API未接続・fixture限定。run/resume --task task.json --fixture fixture.json [--dry-run] [--pause-after planned|applied]\nvalidate --task task.json\nqueue task1.json task2.json\nself-check');
    process.exitCode = 2;
  }
} catch (error) {
  // Fixed codes only: never echo task text, paths from errors, tokens or stacks.
  console.error(JSON.stringify({ status: 'refused_or_failed', code: errorCode(error), apiConnected: false, actualCostUsd: null }));
  process.exitCode = errorCode(error) === 'INTERRUPTED' ? 130 : 1;
}
