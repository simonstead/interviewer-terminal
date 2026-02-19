import { CommandRegistry, CommandResult } from '../CommandRegistry';
import { ParsedCommand } from '../CommandParser';
import { CommandContext } from '../CommandContext';

export function registerPythonCommands(registry: CommandRegistry): void {
  registry.register('python', handlePython);
  registry.register('python3', handlePython);
  registry.register('pip', handlePip);
  registry.register('pip3', handlePip);
}

function handlePython(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  if (cmd.args.length === 0 || cmd.args[0] === '--version' || cmd.args[0] === '-V') {
    return { output: 'Python 3.12.1', exitCode: 0 };
  }

  if (cmd.args[0] === '-c') {
    const code = cmd.args.slice(1).join(' ');
    return evaluatePython(code);
  }

  // Running a file
  const filePath = ctx.resolvePath(cmd.args[0]);
  const content = ctx.fs.readFile(filePath, '/');
  if (content === null) {
    return {
      output: `python3: can't open file '${cmd.args[0]}': [Errno 2] No such file or directory`,
      exitCode: 2,
    };
  }

  return { output: `[executed ${cmd.args[0]}]`, exitCode: 0 };
}

function handlePip(cmd: ParsedCommand): CommandResult {
  const subcommand = cmd.args[0];

  switch (subcommand) {
    case '--version':
    case '-V':
      return { output: 'pip 23.3.2 from /usr/local/lib/python3.12/site-packages/pip (python 3.12)', exitCode: 0 };

    case 'install':
      const packages = cmd.args.slice(1).filter(a => !a.startsWith('-'));
      if (packages.length === 0) {
        return { output: 'ERROR: You must give at least one requirement to install', exitCode: 1 };
      }
      return {
        output: packages.map(p => `Collecting ${p}\n  Downloading ${p}-latest.tar.gz\nInstalling collected packages: ${p}\nSuccessfully installed ${p}-latest`).join('\n'),
        exitCode: 0,
      };

    case 'list':
      return {
        output: 'Package    Version\n---------- -------\npip        23.3.2\nsetuptools 69.0.3',
        exitCode: 0,
      };

    case 'freeze':
      return { output: '', exitCode: 0 };

    default:
      return { output: `ERROR: unknown command "${subcommand}"`, exitCode: 1 };
  }
}

function evaluatePython(code: string): CommandResult {
  // Handle simple print statements
  const printMatch = code.match(/print\((.+)\)/);
  if (printMatch) {
    const arg = printMatch[1].trim();
    if (arg.startsWith('"') || arg.startsWith("'") || arg.startsWith('f"') || arg.startsWith("f'")) {
      const cleaned = arg.replace(/^f?['"]|['"]$/g, '');
      return { output: cleaned, exitCode: 0 };
    }
    if (/^[\d+\-*/() .]+$/.test(arg)) {
      try {
        return { output: String(eval(arg)), exitCode: 0 };
      } catch {
        return { output: 'SyntaxError', exitCode: 1 };
      }
    }
    return { output: arg, exitCode: 0 };
  }

  return { output: '', exitCode: 0 };
}
