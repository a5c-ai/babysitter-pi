#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: options.stdio || 'inherit', encoding: options.encoding });
  if (result.status !== 0 && !options.allowFailure) process.exit(result.status || 1);
  return result;
}

function npmView(packageSpec) {
  return run('npm', ['view', packageSpec, 'version'], { allowFailure: true, stdio: 'pipe', encoding: 'utf8' }).status === 0;
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const ref = process.env.GITHUB_REF_NAME || '';
const branch = ref.split('/')[1] || 'develop';
const tag = branch === 'main' ? 'latest' : branch;

if (!process.env.NODE_AUTH_TOKEN) {
  console.log('NODE_AUTH_TOKEN is not configured; skipping npm publish.');
  process.exit(0);
}

if (npmView(pkg.name + '@' + pkg.version)) {
  console.log(pkg.name + '@' + pkg.version + ' already exists; ensuring dist-tag ' + tag + '.');
  run('npm', ['dist-tag', 'add', pkg.name + '@' + pkg.version, tag], { allowFailure: true });
  process.exit(0);
}

for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
  for (const [name, version] of Object.entries(pkg[field] || {})) {
    if (!name.startsWith('@a5c-ai/') || version.startsWith('^') || version.startsWith('~') || version === '*' || version.startsWith('workspace:')) continue;
    if (!npmView(name + '@' + version)) {
      console.log('Required internal dependency ' + name + '@' + version + ' is not published yet; skipping npm publish.');
      process.exit(0);
    }
  }
}

run('npm', ['publish', '--access', 'public', '--tag', tag]);
