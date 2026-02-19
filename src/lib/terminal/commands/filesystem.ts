import { CommandRegistry, CommandResult } from '../CommandRegistry';
import { ParsedCommand } from '../CommandParser';
import { CommandContext } from '../CommandContext';

export function registerFilesystemCommands(registry: CommandRegistry): void {
  registry.register('pwd', handlePwd);
  registry.register('cd', handleCd);
  registry.register('ls', handleLs);
  registry.register('cat', handleCat);
  registry.register('mkdir', handleMkdir);
  registry.register('touch', handleTouch);
  registry.register('rm', handleRm);
  registry.register('cp', handleCp);
  registry.register('mv', handleMv);
  registry.register('find', handleFind);
  registry.register('grep', handleGrep);
  registry.register('head', handleHead);
  registry.register('tail', handleTail);
  registry.register('wc', handleWc);
  registry.register('tree', handleTree);
  registry.registerAlias('ll', 'ls');
}

function handlePwd(_cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  return { output: ctx.cwd, exitCode: 0 };
}

function handleCd(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  const target = cmd.args[0] || ctx.env.HOME;
  let resolvedPath: string;

  if (target === '-') {
    resolvedPath = ctx.env.OLDPWD || ctx.cwd;
  } else {
    resolvedPath = ctx.resolvePath(target);
  }

  if (!ctx.fs.exists(resolvedPath, '/')) {
    return { output: `cd: ${target}: No such file or directory`, exitCode: 1 };
  }
  if (!ctx.fs.isDirectory(resolvedPath, '/')) {
    return { output: `cd: ${target}: Not a directory`, exitCode: 1 };
  }

  ctx.env.OLDPWD = ctx.cwd;
  ctx.cwd = resolvedPath;
  ctx.env.PWD = resolvedPath;
  return { output: '', exitCode: 0 };
}

function handleLs(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  const target = cmd.args[0] || '.';
  const showAll = cmd.flags['a'] === true || cmd.flags['la'] === true;
  const longFormat = cmd.flags['l'] === true || cmd.flags['la'] === true
    || cmd.rawArgs.includes('-la') || cmd.rawArgs.includes('-al');

  const resolvedPath = ctx.resolvePath(target);
  const entries = ctx.fs.listDir(resolvedPath, '/');

  if (entries === null) {
    // Check if it's a file
    if (ctx.fs.isFile(resolvedPath, '/')) {
      const node = ctx.fs.resolve(resolvedPath, '/');
      if (longFormat && node) {
        return { output: formatLongEntry(node), exitCode: 0 };
      }
      return { output: target, exitCode: 0 };
    }
    return { output: `ls: cannot access '${target}': No such file or directory`, exitCode: 2 };
  }

  let filtered = entries;
  if (!showAll) {
    filtered = entries.filter(e => !e.name.startsWith('.'));
  }

  filtered.sort((a, b) => a.name.localeCompare(b.name));

  if (longFormat) {
    const lines = [`total ${filtered.length}`];
    for (const entry of filtered) {
      lines.push(formatLongEntry(entry));
    }
    return { output: lines.join('\n'), exitCode: 0 };
  }

  const names = filtered.map(e => {
    if (e.type === 'directory') return `\x1b[34m${e.name}\x1b[0m`;
    if (e.name.endsWith('.sh') || e.permissions?.includes('x')) return `\x1b[32m${e.name}\x1b[0m`;
    return e.name;
  });

  // Format in columns
  if (names.length === 0) return { output: '', exitCode: 0 };
  return { output: names.join('  '), exitCode: 0 };
}

function formatLongEntry(entry: import('../VirtualFileSystem').FSNode): string {
  const perms = entry.permissions || (entry.type === 'directory' ? 'drwxr-xr-x' : '-rw-r--r--');
  const size = entry.type === 'file' ? (entry.content?.length || 0).toString() : '4096';
  const date = 'Jan 15 08:32';
  const name = entry.type === 'directory' ? `\x1b[34m${entry.name}\x1b[0m` : entry.name;
  return `${perms} 1 candidate candidate ${size.padStart(6)} ${date} ${name}`;
}

function handleCat(cmd: ParsedCommand, ctx: CommandContext, stdin?: string): CommandResult {
  if (cmd.args.length === 0) {
    // Cat from stdin (for pipes)
    return { output: stdin || '', exitCode: 0 };
  }

  const outputs: string[] = [];
  for (const arg of cmd.args) {
    const resolvedPath = ctx.resolvePath(arg);
    const content = ctx.fs.readFile(resolvedPath, '/');
    if (content === null) {
      if (ctx.fs.isDirectory(resolvedPath, '/')) {
        return { output: `cat: ${arg}: Is a directory`, exitCode: 1 };
      }
      return { output: `cat: ${arg}: No such file or directory`, exitCode: 1 };
    }
    outputs.push(content);
  }
  return { output: outputs.join(''), exitCode: 0 };
}

function handleMkdir(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  if (cmd.args.length === 0) {
    return { output: 'mkdir: missing operand', exitCode: 1 };
  }

  const recursive = cmd.flags['p'] === true;

  for (const arg of cmd.args) {
    const resolvedPath = ctx.resolvePath(arg);
    if (!ctx.fs.mkdir(resolvedPath, '/', recursive)) {
      if (ctx.fs.exists(resolvedPath, '/')) {
        return { output: `mkdir: cannot create directory '${arg}': File exists`, exitCode: 1 };
      }
      return { output: `mkdir: cannot create directory '${arg}': No such file or directory`, exitCode: 1 };
    }
  }
  return { output: '', exitCode: 0 };
}

function handleTouch(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  if (cmd.args.length === 0) {
    return { output: 'touch: missing file operand', exitCode: 1 };
  }

  for (const arg of cmd.args) {
    const resolvedPath = ctx.resolvePath(arg);
    if (!ctx.fs.exists(resolvedPath, '/')) {
      ctx.fs.writeFile(resolvedPath, '', '/');
    }
  }
  return { output: '', exitCode: 0 };
}

function handleRm(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  if (cmd.args.length === 0) {
    return { output: 'rm: missing operand', exitCode: 1 };
  }

  const recursive = cmd.flags['r'] === true || cmd.flags['R'] === true || cmd.flags['f'] === true;
  const force = cmd.flags['f'] === true;

  for (const arg of cmd.args) {
    const resolvedPath = ctx.resolvePath(arg);
    if (!ctx.fs.exists(resolvedPath, '/')) {
      if (!force) {
        return { output: `rm: cannot remove '${arg}': No such file or directory`, exitCode: 1 };
      }
      continue;
    }
    if (!ctx.fs.rm(resolvedPath, '/', recursive)) {
      return { output: `rm: cannot remove '${arg}': Is a directory`, exitCode: 1 };
    }
  }
  return { output: '', exitCode: 0 };
}

function handleCp(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  if (cmd.args.length < 2) {
    return { output: 'cp: missing file operand', exitCode: 1 };
  }

  const src = ctx.resolvePath(cmd.args[0]);
  const dest = ctx.resolvePath(cmd.args[1]);
  const content = ctx.fs.readFile(src, '/');

  if (content === null) {
    return { output: `cp: cannot stat '${cmd.args[0]}': No such file or directory`, exitCode: 1 };
  }

  // If dest is a directory, copy into it
  if (ctx.fs.isDirectory(dest, '/')) {
    const srcName = src.split('/').pop()!;
    ctx.fs.writeFile(dest + '/' + srcName, content, '/');
  } else {
    ctx.fs.writeFile(dest, content, '/');
  }

  return { output: '', exitCode: 0 };
}

function handleMv(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  if (cmd.args.length < 2) {
    return { output: 'mv: missing file operand', exitCode: 1 };
  }

  const src = ctx.resolvePath(cmd.args[0]);
  const dest = ctx.resolvePath(cmd.args[1]);
  const content = ctx.fs.readFile(src, '/');

  if (content === null) {
    return { output: `mv: cannot stat '${cmd.args[0]}': No such file or directory`, exitCode: 1 };
  }

  if (ctx.fs.isDirectory(dest, '/')) {
    const srcName = src.split('/').pop()!;
    ctx.fs.writeFile(dest + '/' + srcName, content, '/');
  } else {
    ctx.fs.writeFile(dest, content, '/');
  }

  ctx.fs.rm(src, '/');
  return { output: '', exitCode: 0 };
}

function handleFind(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  const basePath = cmd.args[0] || '.';
  let namePattern = '*';

  const nameIdx = cmd.args.indexOf('-name');
  if (nameIdx !== -1 && nameIdx + 1 < cmd.args.length) {
    namePattern = cmd.args[nameIdx + 1];
  }

  const resolvedBase = ctx.resolvePath(basePath);
  const results = ctx.fs.find(resolvedBase, namePattern, '/');
  return { output: results.join('\n'), exitCode: 0 };
}

function handleGrep(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  const recursive = cmd.flags['r'] === true || cmd.flags['R'] === true;
  const caseInsensitive = cmd.flags['i'] === true;

  if (cmd.args.length < 2 && !recursive) {
    return { output: 'Usage: grep [OPTIONS] PATTERN FILE...', exitCode: 2 };
  }

  let pattern = cmd.args[0];
  if (caseInsensitive) pattern = '(?i)' + pattern;

  const files = cmd.args.slice(1);
  const allResults: string[] = [];

  for (const file of files.length > 0 ? files : ['.']) {
    const resolvedPath = ctx.resolvePath(file);
    const results = ctx.fs.grep(pattern, resolvedPath, '/', recursive);
    for (const r of results) {
      if (files.length > 1 || recursive) {
        allResults.push(`\x1b[35m${r.file}\x1b[0m:\x1b[32m${r.line}\x1b[0m:${r.content}`);
      } else {
        allResults.push(r.content);
      }
    }
  }

  return {
    output: allResults.join('\n'),
    exitCode: allResults.length > 0 ? 0 : 1,
  };
}

function handleHead(cmd: ParsedCommand, ctx: CommandContext, stdin?: string): CommandResult {
  const lines = parseInt(cmd.flags['n'] as string) || 10;

  if (cmd.args.length === 0 && stdin) {
    return { output: stdin.split('\n').slice(0, lines).join('\n'), exitCode: 0 };
  }

  if (cmd.args.length === 0) {
    return { output: 'head: missing file operand', exitCode: 1 };
  }

  const resolvedPath = ctx.resolvePath(cmd.args[0]);
  const content = ctx.fs.readFile(resolvedPath, '/');
  if (content === null) {
    return { output: `head: cannot open '${cmd.args[0]}' for reading: No such file or directory`, exitCode: 1 };
  }

  return { output: content.split('\n').slice(0, lines).join('\n'), exitCode: 0 };
}

function handleTail(cmd: ParsedCommand, ctx: CommandContext, stdin?: string): CommandResult {
  const lines = parseInt(cmd.flags['n'] as string) || 10;

  if (cmd.args.length === 0 && stdin) {
    const allLines = stdin.split('\n');
    return { output: allLines.slice(-lines).join('\n'), exitCode: 0 };
  }

  if (cmd.args.length === 0) {
    return { output: 'tail: missing file operand', exitCode: 1 };
  }

  const resolvedPath = ctx.resolvePath(cmd.args[0]);
  const content = ctx.fs.readFile(resolvedPath, '/');
  if (content === null) {
    return { output: `tail: cannot open '${cmd.args[0]}' for reading: No such file or directory`, exitCode: 1 };
  }

  const allLines = content.split('\n');
  return { output: allLines.slice(-lines).join('\n'), exitCode: 0 };
}

function handleWc(cmd: ParsedCommand, ctx: CommandContext, stdin?: string): CommandResult {
  const getText = (): { text: string; name: string } | null => {
    if (cmd.args.length === 0 && stdin) return { text: stdin, name: '' };
    if (cmd.args.length === 0) return null;
    const resolvedPath = ctx.resolvePath(cmd.args[0]);
    const content = ctx.fs.readFile(resolvedPath, '/');
    if (content === null) return null;
    return { text: content, name: cmd.args[0] };
  };

  const result = getText();
  if (!result) {
    return { output: cmd.args.length > 0 ? `wc: ${cmd.args[0]}: No such file or directory` : '', exitCode: 1 };
  }

  const { text, name } = result;
  const lineCount = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const charCount = text.length;

  if (cmd.flags['l']) return { output: `${lineCount} ${name}`.trim(), exitCode: 0 };
  if (cmd.flags['w']) return { output: `${wordCount} ${name}`.trim(), exitCode: 0 };
  if (cmd.flags['c']) return { output: `${charCount} ${name}`.trim(), exitCode: 0 };

  return { output: `  ${lineCount}  ${wordCount} ${charCount} ${name}`.trim(), exitCode: 0 };
}

function handleTree(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  const target = cmd.args[0] || '.';
  const resolvedPath = ctx.resolvePath(target);
  const node = ctx.fs.resolve(resolvedPath, '/');

  if (!node || node.type !== 'directory') {
    return { output: `${target} [error opening dir]`, exitCode: 2 };
  }

  const lines: string[] = [resolvedPath === '/' ? '/' : target];
  let dirCount = 0;
  let fileCount = 0;
  const maxDepth = parseInt(cmd.flags['L'] as string) || 4;

  buildTree(node, '', 0);

  function buildTree(n: import('../VirtualFileSystem').FSNode, prefix: string, depth: number) {
    if (!n.children || depth >= maxDepth) return;
    const entries = Array.from(n.children.values())
      .filter(e => !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name));

    entries.forEach((entry, i) => {
      const isLast = i === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const name = entry.type === 'directory' ? `\x1b[34m${entry.name}\x1b[0m` : entry.name;
      lines.push(prefix + connector + name);

      if (entry.type === 'directory') {
        dirCount++;
        buildTree(entry, prefix + (isLast ? '    ' : '│   '), depth + 1);
      } else {
        fileCount++;
      }
    });
  }

  lines.push('');
  lines.push(`${dirCount} directories, ${fileCount} files`);
  return { output: lines.join('\n'), exitCode: 0 };
}
