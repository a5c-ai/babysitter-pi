import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import activate from '../extensions/index.ts';

function makePi(execImpl = async () => ({ stdout: '{}\n', stderr: '', code: 0, killed: false })) {
  const handlers = new Map();
  const sent = [];
  const execCalls = [];
  const pi = {
    events: { emit() {} },
    on(name, handler) {
      handlers.set(name, handler);
      return () => handlers.delete(name);
    },
    registerCommand() {},
    sendUserMessage(message, options) {
      sent.push({ message, options });
    },
    async exec(command, args, options) {
      execCalls.push({ command, args, options });
      return execImpl(command, args, options);
    },
  };
  activate(pi);
  return { handlers, sent, execCalls };
}

function makeCtx(sessionId = 'pi-session-1', signal) {
  return {
    cwd: '/tmp/babysitter-pi-test',
    signal,
    sessionManager: { getSessionId: () => sessionId },
    ui: { notify() {} },
    mode: 'tui',
    hasUI: true,
    isIdle: () => true,
    isProjectTrusted: () => true,
    abort() {},
    hasPendingMessages: () => false,
    shutdown() {},
    getContextUsage: () => undefined,
    compact() {},
    getSystemPrompt: () => '',
  };
}

test('syncs session identity before agent work, not only session_start', async () => {
  const previousPi = process.env.PI_SESSION_ID;
  const previousBabysitter = process.env.BABYSITTER_SESSION_ID;
  delete process.env.PI_SESSION_ID;
  delete process.env.BABYSITTER_SESSION_ID;
  try {
    const { handlers } = makePi();
    assert.equal(typeof handlers.get('before_agent_start'), 'function');
    await handlers.get('before_agent_start')({ type: 'before_agent_start' }, makeCtx('late-session'));
    assert.equal(process.env.PI_SESSION_ID, 'late-session');
    assert.equal(process.env.BABYSITTER_SESSION_ID, 'late-session');
  } finally {
    if (previousPi === undefined) delete process.env.PI_SESSION_ID;
    else process.env.PI_SESSION_ID = previousPi;
    if (previousBabysitter === undefined) delete process.env.BABYSITTER_SESSION_ID;
    else process.env.BABYSITTER_SESSION_ID = previousBabysitter;
  }
});

test('babysit skill documents the missing-session fail-closed guard', async () => {
  const skill = await readFile(new URL('../skills/babysit/SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /PI_SESSION_ID/);
  assert.match(skill, /exit 2/);
  assert.match(skill, /BABYSITTER_SESSION_ID/);
});

test('fails closed when Pi session identity is missing', async () => {
  const { handlers, execCalls, sent } = makePi();
  assert.equal(typeof handlers.get('agent_before_settle'), 'function');

  await handlers.get('session_start')({ type: 'session_start' }, makeCtx(''));
  const result = await handlers.get('agent_before_settle')(
    { type: 'agent_before_settle', outcome: 'completed' },
    makeCtx(''),
  );

  assert.equal(result, undefined);
  assert.equal(execCalls.length, 0);
  assert.deepEqual(sent, []);
});

test('continues through Pi settle boundary without sendUserMessage re-entry', async () => {
  const controller = new AbortController();
  const { handlers, execCalls, sent } = makePi(async () => ({
    stdout: JSON.stringify({ decision: 'block', reason: 'continue babysitter run' }) + '\n',
    stderr: '',
    code: 0,
    killed: false,
  }));

  const result = await handlers.get('agent_before_settle')(
    { type: 'agent_before_settle', outcome: 'completed' },
    makeCtx('pi-session-1', controller.signal),
  );

  assert.deepEqual(sent, []);
  assert.equal(execCalls.length, 1);
  assert.equal(execCalls[0].options.signal, controller.signal);
  assert.equal(typeof execCalls[0].options.timeout, 'number');
  assert.ok(execCalls[0].options.timeout > 0);
  assert.equal(result.continue, true);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].type, 'custom_message');
  assert.equal(result.entries[0].display, false);
  assert.equal(result.entries[0].content, 'continue babysitter run');
});

test('does not continue after cancellation or a non-blocking stop hook result', async () => {
  const { handlers, execCalls } = makePi();

  const aborted = await handlers.get('agent_before_settle')(
    { type: 'agent_before_settle', outcome: 'aborted' },
    makeCtx('pi-session-1'),
  );
  assert.equal(aborted, undefined);
  assert.equal(execCalls.length, 0);

  const settled = await handlers.get('agent_before_settle')(
    { type: 'agent_before_settle', outcome: 'completed' },
    makeCtx('pi-session-1'),
  );
  assert.equal(settled, undefined);
  assert.equal(execCalls.length, 1);
});
