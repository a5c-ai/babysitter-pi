import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initI18n, t } from './i18n.js';

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HOOK_TIMEOUT_MS = 30_000;
const CONTINUATION_TYPE = 'babysitter-pi/continuation';

const COMMANDS = [
  'assimilate',
  'call',
  'cleanup',
  'contrib',
  'doctor',
  'forever',
  'help',
  'observe',
  'plan',
  'plugins',
  'project-install',
  'resume',
  'retrospect',
  'user-install',
  'yolo',
];

const RESERVED_PI_COMMANDS = new Set(['resume']);

function toSkillPrompt(name, args) {
  return `/skill:${name}${args ? ` ${args}` : ''}`;
}

function readSessionId(ctx) {
  const sessionId = ctx?.sessionManager?.getSessionId?.();
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : undefined;
}

export function syncSessionEnvironment(ctx) {
  const sessionId = readSessionId(ctx);
  if (!sessionId) {
    process.env.PI_PLUGIN_ROOT = PLUGIN_ROOT;
    return undefined;
  }
  process.env.PI_SESSION_ID = sessionId;
  process.env.BABYSITTER_SESSION_ID = sessionId;
  process.env.PI_PLUGIN_ROOT = PLUGIN_ROOT;
  return sessionId;
}

export function hookInput(event, ctx) {
  const sessionId = syncSessionEnvironment(ctx);
  if (!sessionId) return undefined;
  return { event, cwd: ctx?.cwd ?? process.cwd(), session_id: sessionId };
}

export async function runProxiedHook(pi, scriptName, inputData, ctx, timeout = HOOK_TIMEOUT_MS) {
  if (!inputData) return {};
  const scriptPath = path.join(PLUGIN_ROOT, 'hooks', scriptName);
  try {
    const result = await pi.exec(
      'sh',
      ['-c', 'printf %s "$1" | bash "$2"', 'babysitter-pi-hook', JSON.stringify(inputData), scriptPath],
      { cwd: inputData.cwd ?? process.cwd(), timeout, signal: ctx?.signal },
    );
    if (result?.code !== 0 || result?.killed) return {};
    const stdout = String(result?.stdout ?? '').trim();
    return stdout ? JSON.parse(stdout) : {};
  } catch {
    return {};
  }
}

export function continuationFromStopHook(result) {
  if (!result || result.decision !== 'block') return undefined;
  const text =
    typeof result.reason === 'string' && result.reason.trim()
      ? result.reason.trim()
      : typeof result.systemMessage === 'string'
        ? result.systemMessage.trim()
        : '';
  if (!text) return undefined;
  return {
    type: 'custom_message',
    customType: CONTINUATION_TYPE,
    content: text,
    display: false,
    details: { source: 'babysitter-stop-hook' },
  };
}

export function activateBabysitterPi(pi) {
  initI18n(pi);

  pi.on('session_start', async (_event, ctx) => {
    const input = hookInput('session_start', ctx);
    if (input) await runProxiedHook(pi, 'babysitter-proxied-session-start.sh', input, ctx);
  });

  pi.on('before_agent_start', (_event, ctx) => {
    syncSessionEnvironment(ctx);
  });

  let stopHookInFlight = false;
  pi.on('agent_before_settle', async (event, ctx) => {
    if (stopHookInFlight || event?.outcome !== 'completed') return undefined;
    const input = hookInput('stop', ctx);
    if (!input) return undefined;

    stopHookInFlight = true;
    try {
      const result = await runProxiedHook(pi, 'babysitter-proxied-stop.sh', input, ctx);
      const continuation = continuationFromStopHook(result);
      return continuation ? { entries: [continuation], continue: true } : undefined;
    } finally {
      stopHookInFlight = false;
    }
  });

  syncSessionEnvironment();

  const forwardSkill = (name) => async (args, ctx) => {
    const sessionId = syncSessionEnvironment(ctx);
    if (!sessionId) {
      ctx?.ui?.notify?.('Babysitter needs a Pi session id before it can start a run.', 'error');
      return;
    }
    pi.sendUserMessage(toSkillPrompt(name, String(args ?? '').trim()), { expandPromptTemplates: true });
  };

  const forwardBabysit = forwardSkill('babysit');
  pi.registerCommand('babysit', {
    description: 'Load the Babysitter orchestration skill',
    handler: forwardBabysit,
  });

  pi.registerCommand('babysitter', {
    description: 'Alias for /babysit',
    handler: forwardBabysit,
  });

  for (const name of COMMANDS) {
    const forward = forwardSkill(name);

    if (!RESERVED_PI_COMMANDS.has(name)) {
      pi.registerCommand(name, {
        description: name === 'doctor'
          ? t('command.doctor.description', 'Open the Babysitter doctor skill')
          : `Open the Babysitter ${name} skill`,
        handler: forward,
      });
    }

    pi.registerCommand(`babysitter:${name}`, {
      description: name === 'doctor'
        ? t('command.doctor.aliasDescription', 'Alias for /doctor')
        : RESERVED_PI_COMMANDS.has(name)
          ? `Open the Babysitter ${name} skill`
          : `Alias for /${name}`,
      handler: forward,
    });
  }
}
