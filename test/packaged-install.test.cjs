const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('package includes runtime files needed by the Pi extension', () => {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const parsed = JSON.parse(result.stdout);
  const pack = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0];
  const files = new Set(pack.files.map((file) => file.path));

  for (const file of [
    'extensions/index.ts',
    'extensions/runtime.js',
    'extensions/i18n.js',
    'extensions/i18n.ts',
    'hooks/babysitter-proxied-stop.sh',
    'hooks/babysitter-proxied-session-start.sh',
  ]) {
    assert.ok(files.has(file), `${file} missing from package`);
  }
});
