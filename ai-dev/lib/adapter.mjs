import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { childEnv, exactKeys, GuardError, noSecrets, requireThat, string } from './safety.mjs';

export function validateFixture(fixture) {
  noSecrets(fixture);
  exactKeys(fixture, ['edits']);
  requireThat(Array.isArray(fixture.edits) && fixture.edits.length > 0 && fixture.edits.length <= 10, 'INVALID_FIXTURE');
  for (const edit of fixture.edits) {
    exactKeys(edit, ['path', 'find', 'replace']);
    string(edit.path, 1, 200); string(edit.find, 1, 8192);
    requireThat(typeof edit.replace === 'string' && edit.replace.length <= 8192 && !edit.replace.includes('\0'), 'INVALID_REPLACEMENT');
  }
  return fixture;
}

export async function propose(fixture, cwd, remainingMs, signal) {
  validateFixture(fixture);
  requireThat(remainingMs > 0, 'TIME_BUDGET_EXCEEDED');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL('../adapters/fixture.mjs', import.meta.url))], {
      cwd, env: childEnv(), stdio: ['pipe', 'pipe', 'ignore'], timeout: Math.ceil(remainingMs), signal
    });
    let output = ''; let tooLarge = false;
    child.stdout.on('data', chunk => {
      if (output.length + chunk.length > 65536) { tooLarge = true; child.kill(); }
      else output += chunk;
    });
    child.stdin.on('error', () => {});
    child.on('error', () => reject(new GuardError(signal?.aborted ? 'INTERRUPTED' : 'ADAPTER_FAILED')));
    child.on('close', (code, childSignal) => {
      if (signal?.aborted) return reject(new GuardError('INTERRUPTED'));
      if (tooLarge) return reject(new GuardError('ADAPTER_OUTPUT_LIMIT'));
      if (childSignal) return reject(new GuardError('TIME_BUDGET_EXCEEDED'));
      if (code !== 0) return reject(new GuardError('ADAPTER_FAILED'));
      try {
        const result = JSON.parse(output);
        exactKeys(result, ['protocol', 'edits', 'apiConnected', 'costUpperBoundUsd']);
        requireThat(result.protocol === 1 && result.apiConnected === false && result.costUpperBoundUsd === 0, 'ADAPTER_CONTRACT');
        validateFixture({ edits: result.edits });
        resolve(result);
      } catch { reject(new GuardError('ADAPTER_CONTRACT')); }
    });
    child.stdin.end(JSON.stringify({ protocol: 1, adapter: 'fixture', fixture }));
  });
}
