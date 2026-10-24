// Single adapter protocol: JSON request on stdin -> proposed exact text edits on stdout.
// Trusted fixture interpreter only. No model, network, shell, repository, .git or credentials.
let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 65536) process.exit(2);
}
try {
  const request = JSON.parse(input);
  if (request.protocol !== 1 || request.adapter !== 'fixture') process.exit(2);
  process.stdout.write(JSON.stringify({ protocol: 1, edits: request.fixture.edits, apiConnected: false, costUpperBoundUsd: 0 }));
} catch { process.exit(2); }
