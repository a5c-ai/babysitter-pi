#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

const branch = process.env.GITHUB_REF_NAME || 'develop';
const sha = (process.env.GITHUB_SHA || '').slice(0, 12);
const version = existsSync('package.json') ? JSON.parse(readFileSync('package.json', 'utf8')).version : JSON.parse(readFileSync('versions.json', 'utf8')).sdkVersion;
const normalized = String(version).replace(/[^0-9A-Za-z._-]/g, '-');
const tag = 'release/' + branch + '/v' + normalized + '-' + sha;
run('git', ['config', 'user.name', 'github-actions[bot]']);
run('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com']);
run('git', ['tag', tag]);
run('git', ['push', 'origin', tag]);
