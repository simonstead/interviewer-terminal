import { CommandRegistry, CommandResult } from '../CommandRegistry';
import { ParsedCommand } from '../CommandParser';
import { CommandContext } from '../CommandContext';

export function registerSystemCommands(registry: CommandRegistry): void {
  registry.register('echo', handleEcho);
  registry.register('env', handleEnv);
  registry.register('export', handleExport);
  registry.register('clear', handleClear);
  registry.register('history', handleHistory);
  registry.register('whoami', handleWhoami);
  registry.register('hostname', handleHostname);
  registry.register('date', handleDate);
  registry.register('uname', handleUname);
  registry.register('which', handleWhich);
  registry.register('man', handleMan);
  registry.register('help', handleHelp);
  registry.register('true', () => ({ output: '', exitCode: 0 }));
  registry.register('false', () => ({ output: '', exitCode: 1 }));
  registry.register('exit', () => ({ output: 'Session is active. Use Ctrl+D or close the browser to end.', exitCode: 0 }));
  registry.register('sort', handleSort);
  registry.register('uniq', handleUniq);
  registry.register('xargs', handleXargs);
}

function handleEcho(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  // Reconstruct args preserving original spacing
  let output = cmd.args.join(' ');

  // Handle -n flag (no trailing newline - we just return without \n)
  const noNewline = cmd.flags['n'] === true;

  // Expand environment variables
  output = output.replace(/\$(\w+)/g, (_, name) => ctx.env[name] || '');
  output = output.replace(/\$\{(\w+)\}/g, (_, name) => ctx.env[name] || '');

  // Handle -e flag (interpret escape sequences)
  if (cmd.flags['e'] === true) {
    output = output
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }

  if (noNewline) {
    return { output, exitCode: 0 };
  }
  return { output, exitCode: 0 };
}

function handleEnv(_cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  const lines = Object.entries(ctx.env).map(([k, v]) => `${k}=${v}`);
  return { output: lines.join('\n'), exitCode: 0 };
}

function handleExport(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  if (cmd.args.length === 0) {
    const lines = Object.entries(ctx.env).map(([k, v]) => `declare -x ${k}="${v}"`);
    return { output: lines.join('\n'), exitCode: 0 };
  }

  for (const arg of cmd.args) {
    const eqIdx = arg.indexOf('=');
    if (eqIdx !== -1) {
      const key = arg.slice(0, eqIdx);
      const value = arg.slice(eqIdx + 1);
      ctx.env[key] = value;
    }
  }
  return { output: '', exitCode: 0 };
}

function handleClear(): CommandResult {
  // Return special escape code to clear terminal
  return { output: '\x1b[2J\x1b[H', exitCode: 0 };
}

function handleHistory(): CommandResult {
  // History is managed by InputBuffer; this is a stub that returns a placeholder
  return { output: '(history managed by terminal)', exitCode: 0 };
}

function handleWhoami(_cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  return { output: ctx.user, exitCode: 0 };
}

function handleHostname(_cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  return { output: ctx.hostname, exitCode: 0 };
}

function handleDate(): CommandResult {
  const now = new Date();
  return { output: now.toUTCString(), exitCode: 0 };
}

function handleUname(cmd: ParsedCommand): CommandResult {
  if (cmd.flags['a'] === true) {
    return { output: 'Linux fleetcore 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux', exitCode: 0 };
  }
  return { output: 'Linux', exitCode: 0 };
}

function handleWhich(cmd: ParsedCommand): CommandResult {
  if (cmd.args.length === 0) return { output: '', exitCode: 1 };

  const knownCommands: Record<string, string> = {
    node: '/usr/local/bin/node',
    npm: '/usr/local/bin/npm',
    npx: '/usr/local/bin/npx',
    python: '/usr/bin/python3',
    python3: '/usr/bin/python3',
    pip: '/usr/local/bin/pip',
    docker: '/usr/bin/docker',
    'docker-compose': '/usr/local/bin/docker-compose',
    git: '/usr/bin/git',
    curl: '/usr/bin/curl',
    wget: '/usr/bin/wget',
    bash: '/bin/bash',
    sh: '/bin/sh',
    cat: '/bin/cat',
    ls: '/bin/ls',
    grep: '/bin/grep',
    find: '/usr/bin/find',
  };

  const cmdName = cmd.args[0];
  if (knownCommands[cmdName]) {
    return { output: knownCommands[cmdName], exitCode: 0 };
  }
  return { output: `${cmdName} not found`, exitCode: 1 };
}

function handleMan(cmd: ParsedCommand): CommandResult {
  if (cmd.args.length === 0) {
    return { output: 'What manual page do you want?\nFor example, try \'man man\'.', exitCode: 1 };
  }
  return { output: `No manual entry for ${cmd.args[0]}\nTip: Use 'help' to see available commands.`, exitCode: 0 };
}

function handleHelp(): CommandResult {
  const help = `FleetCore Interview Terminal - Available Commands:

  Navigation:     cd, ls, pwd, tree, find
  File ops:       cat, head, tail, touch, mkdir, rm, cp, mv, wc
  Search:         grep, find
  Docker:         docker, docker-compose
  Dev tools:      node, npm, npx, python, pip, git
  Network:        curl, wget
  System:         echo, env, export, clear, history, whoami, date
  Challenge:      status, hint, submit, next-level

  Piping:         cmd1 | cmd2      Redirect:    cmd > file
  Chaining:       cmd1 && cmd2     Append:      cmd >> file

Type 'status' to see your current challenge objectives.`;

  return { output: help, exitCode: 0 };
}

function handleSort(cmd: ParsedCommand, _ctx: CommandContext, stdin?: string): CommandResult {
  const text = stdin || '';
  if (!text) return { output: '', exitCode: 0 };

  let lines = text.split('\n').filter(l => l.length > 0);
  const reverse = cmd.flags['r'] === true;
  const numeric = cmd.flags['n'] === true;
  const unique = cmd.flags['u'] === true;

  if (numeric) {
    lines.sort((a, b) => parseFloat(a) - parseFloat(b));
  } else {
    lines.sort();
  }

  if (reverse) lines.reverse();
  if (unique) lines = [...new Set(lines)];

  return { output: lines.join('\n'), exitCode: 0 };
}

function handleUniq(_cmd: ParsedCommand, _ctx: CommandContext, stdin?: string): CommandResult {
  const text = stdin || '';
  if (!text) return { output: '', exitCode: 0 };

  const lines = text.split('\n');
  const result: string[] = [];
  let prev = '';

  for (const line of lines) {
    if (line !== prev) {
      result.push(line);
      prev = line;
    }
  }

  return { output: result.join('\n'), exitCode: 0 };
}

function handleXargs(cmd: ParsedCommand, _ctx: CommandContext, stdin?: string): CommandResult {
  // Simplified xargs - just returns the command that would be executed with stdin items
  const text = stdin || '';
  const items = text.split(/\s+/).filter(Boolean);
  const subCmd = cmd.args.join(' ');
  return { output: `${subCmd} ${items.join(' ')}`, exitCode: 0 };
}
