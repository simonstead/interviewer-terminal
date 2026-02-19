import { CommandRegistry, CommandResult } from '../CommandRegistry';
import { ParsedCommand } from '../CommandParser';
import { CommandContext } from '../CommandContext';

interface GitState {
  branch: string;
  stagedFiles: string[];
  modifiedFiles: string[];
  commits: Array<{ hash: string; message: string; author: string; date: string }>;
  initialized: boolean;
}

const gitState: GitState = {
  branch: 'main',
  stagedFiles: [],
  modifiedFiles: [],
  commits: [
    { hash: 'a3f2e1d', message: 'feat: add vehicle tracking endpoints', author: 'dev@fleetcore.io', date: '2024-01-14 16:30:00 +0000' },
    { hash: 'b4c3d2e', message: 'fix: resolve Redis connection timeout', author: 'dev@fleetcore.io', date: '2024-01-14 14:15:00 +0000' },
    { hash: 'c5d4e3f', message: 'chore: update Docker compose configuration', author: 'dev@fleetcore.io', date: '2024-01-13 10:00:00 +0000' },
    { hash: 'd6e5f4a', message: 'feat: implement driver management API', author: 'dev@fleetcore.io', date: '2024-01-12 11:30:00 +0000' },
    { hash: 'e7f6a5b', message: 'initial commit', author: 'dev@fleetcore.io', date: '2024-01-10 09:00:00 +0000' },
  ],
  initialized: true,
};

export function registerGitCommands(registry: CommandRegistry): void {
  registry.register('git', handleGit);
}

function handleGit(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  const subcommand = cmd.args[0];

  switch (subcommand) {
    case 'status':
      return gitStatus(ctx);
    case 'log':
      return gitLog(cmd);
    case 'branch':
      return gitBranch(cmd);
    case 'checkout':
      return gitCheckout(cmd);
    case 'add':
      return gitAdd(cmd, ctx);
    case 'commit':
      return gitCommit(cmd);
    case 'diff':
      return gitDiff(cmd, ctx);
    case 'remote':
      return gitRemote(cmd);
    case 'init':
      return { output: 'Reinitialized existing Git repository in /opt/fleetcore/.git/', exitCode: 0 };
    case 'stash':
      return { output: 'No local changes to save', exitCode: 0 };
    case 'pull':
      return { output: 'Already up to date.', exitCode: 0 };
    case 'push':
      return { output: `To github.com:fleetcore/fleetcore-api.git\n   ${gitState.commits[0].hash}..HEAD  ${gitState.branch} -> ${gitState.branch}`, exitCode: 0 };
    case '--version':
    case 'version':
      return { output: 'git version 2.43.0', exitCode: 0 };
    default:
      return { output: `git: '${subcommand}' is not a git command. See 'git --help'.`, exitCode: 1 };
  }
}

function gitStatus(ctx: CommandContext): CommandResult {
  const lines: string[] = [`On branch ${gitState.branch}`];

  if (gitState.stagedFiles.length > 0) {
    lines.push('Changes to be committed:');
    lines.push('  (use "git restore --staged <file>..." to unstage)');
    for (const f of gitState.stagedFiles) {
      lines.push(`\t\x1b[32mnew file:   ${f}\x1b[0m`);
    }
    lines.push('');
  }

  if (gitState.modifiedFiles.length > 0) {
    lines.push('Changes not staged for commit:');
    lines.push('  (use "git add <file>..." to update what will be committed)');
    for (const f of gitState.modifiedFiles) {
      lines.push(`\t\x1b[31mmodified:   ${f}\x1b[0m`);
    }
    lines.push('');
  }

  if (gitState.stagedFiles.length === 0 && gitState.modifiedFiles.length === 0) {
    lines.push('nothing to commit, working tree clean');
  }

  return { output: lines.join('\n'), exitCode: 0 };
}

function gitLog(cmd: ParsedCommand): CommandResult {
  const oneline = cmd.flags['oneline'] === true || cmd.rawArgs.includes('--oneline');
  const n = parseInt(cmd.flags['n'] as string) || gitState.commits.length;
  const commits = gitState.commits.slice(0, n);

  if (oneline) {
    const lines = commits.map(c =>
      `\x1b[33m${c.hash}\x1b[0m ${c.message}`
    );
    return { output: lines.join('\n'), exitCode: 0 };
  }

  const lines = commits.map(c => [
    `\x1b[33mcommit ${c.hash}${'0'.repeat(33)}\x1b[0m`,
    `Author: FleetCore Dev <${c.author}>`,
    `Date:   ${c.date}`,
    '',
    `    ${c.message}`,
    '',
  ].join('\n'));

  return { output: lines.join('\n'), exitCode: 0 };
}

function gitBranch(cmd: ParsedCommand): CommandResult {
  if (cmd.flags['a'] === true || cmd.rawArgs.includes('-a')) {
    return {
      output: `* \x1b[32m${gitState.branch}\x1b[0m\n  remotes/origin/main\n  remotes/origin/feature/gps-tracking\n  remotes/origin/fix/redis-timeout`,
      exitCode: 0,
    };
  }
  if (cmd.args.length > 1) {
    // Creating a new branch
    return { output: '', exitCode: 0 };
  }
  return { output: `* \x1b[32m${gitState.branch}\x1b[0m`, exitCode: 0 };
}

function gitCheckout(cmd: ParsedCommand): CommandResult {
  const target = cmd.args[1];
  if (!target) {
    return { output: 'error: switch `\' requires a value', exitCode: 1 };
  }
  if (cmd.flags['b'] === true) {
    gitState.branch = target;
    return { output: `Switched to a new branch '${target}'`, exitCode: 0 };
  }
  gitState.branch = target;
  return { output: `Switched to branch '${target}'`, exitCode: 0 };
}

function gitAdd(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  if (cmd.args.length < 2) {
    return { output: 'Nothing specified, nothing added.', exitCode: 0 };
  }

  const target = cmd.args[1];
  if (target === '.' || target === '-A') {
    // Stage all modified files
    gitState.stagedFiles.push(...gitState.modifiedFiles);
    gitState.modifiedFiles = [];
  } else {
    const idx = gitState.modifiedFiles.indexOf(target);
    if (idx !== -1) {
      gitState.modifiedFiles.splice(idx, 1);
      gitState.stagedFiles.push(target);
    } else {
      gitState.stagedFiles.push(target);
    }
  }
  return { output: '', exitCode: 0 };
}

function gitCommit(cmd: ParsedCommand): CommandResult {
  const message = cmd.flags['m'] as string;
  if (!message && !cmd.rawArgs.includes('-m')) {
    return { output: 'Aborting commit due to empty commit message.', exitCode: 1 };
  }

  // Extract message from args after -m
  let commitMsg = message;
  if (!commitMsg) {
    const mIdx = cmd.args.indexOf('-m');
    if (mIdx !== -1 && mIdx + 1 < cmd.args.length) {
      commitMsg = cmd.args[mIdx + 1];
    }
  }

  const hash = Math.random().toString(16).slice(2, 9);
  const fileCount = gitState.stagedFiles.length || 1;

  gitState.commits.unshift({
    hash,
    message: commitMsg || 'update',
    author: 'candidate@fleetcore.io',
    date: new Date().toISOString(),
  });
  gitState.stagedFiles = [];

  return {
    output: `[${gitState.branch} ${hash}] ${commitMsg || 'update'}\n ${fileCount} file${fileCount > 1 ? 's' : ''} changed`,
    exitCode: 0,
  };
}

function gitDiff(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  if (gitState.modifiedFiles.length === 0 && gitState.stagedFiles.length === 0) {
    return { output: '', exitCode: 0 };
  }

  const lines = [
    `diff --git a/src/api/vehicles.ts b/src/api/vehicles.ts`,
    `index abc1234..def5678 100644`,
    `--- a/src/api/vehicles.ts`,
    `+++ b/src/api/vehicles.ts`,
    `@@ -15,6 +15,15 @@ vehicleRoutes.get('/:id', async (req, res, next) => {`,
    ` });`,
    ` `,
    ` // TODO: POST, PUT, DELETE endpoints`,
    `\x1b[32m+vehicleRoutes.post('/', async (req, res, next) => {\x1b[0m`,
    `\x1b[32m+  try {\x1b[0m`,
    `\x1b[32m+    const vehicle = await service.create(req.body);\x1b[0m`,
    `\x1b[32m+    res.status(201).json({ data: vehicle });\x1b[0m`,
    `\x1b[32m+  } catch (err) {\x1b[0m`,
    `\x1b[32m+    next(err);\x1b[0m`,
    `\x1b[32m+  }\x1b[0m`,
    `\x1b[32m+});\x1b[0m`,
  ];

  return { output: lines.join('\n'), exitCode: 0 };
}

function gitRemote(cmd: ParsedCommand): CommandResult {
  const sub = cmd.args[1];
  if (sub === '-v' || cmd.flags['v'] === true) {
    return {
      output: 'origin\tgit@github.com:fleetcore/fleetcore-api.git (fetch)\norigin\tgit@github.com:fleetcore/fleetcore-api.git (push)',
      exitCode: 0,
    };
  }
  return { output: 'origin', exitCode: 0 };
}
