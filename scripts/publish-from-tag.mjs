#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

const ref = process.env.GITHUB_REF_NAME || '';
const branch = ref.split('/')[1] || 'develop';
const tag = branch === 'main' ? 'latest' : branch;
run('npm', ['publish', '--access', 'public', '--tag', tag]);
