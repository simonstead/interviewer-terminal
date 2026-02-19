import { CommandRegistry, CommandResult } from '../CommandRegistry';
import { ParsedCommand } from '../CommandParser';
import { CommandContext } from '../CommandContext';

export function registerNodeCommands(registry: CommandRegistry): void {
  registry.register('node', handleNode);
  registry.register('npm', handleNpm);
  registry.register('npx', handleNpx);
}

function handleNode(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  if (cmd.args.length === 0 || cmd.args[0] === '--version' || cmd.args[0] === '-v') {
    return { output: 'v20.11.0', exitCode: 0 };
  }

  const flag = cmd.args[0];
  if (flag === '-e' || flag === '--eval') {
    const code = cmd.args.slice(1).join(' ');
    return evaluateJS(code, ctx);
  }

  // Running a file
  const filePath = ctx.resolvePath(cmd.args[0]);
  const content = ctx.fs.readFile(filePath, '/');
  if (content === null) {
    return {
      output: `node:internal/modules/cjs/loader:1147\n  throw err;\n  ^\n\nError: Cannot find module '${cmd.args[0]}'`,
      exitCode: 1,
    };
  }

  // Simple pattern matching for expected solutions
  return evaluateFileContent(content, cmd.args[0], ctx);
}

function handleNpm(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  const subcommand = cmd.args[0];

  switch (subcommand) {
    case '--version':
    case '-v':
      return { output: '10.2.4', exitCode: 0 };

    case 'install':
    case 'i':
      return npmInstall(cmd);

    case 'run':
      return npmRun(cmd, ctx);

    case 'test':
      return npmTest(ctx);

    case 'start':
      return {
        output: `\n> fleetcore-api@2.4.1 start\n> node dist/server.js\n\n[INFO] FleetCore API running on port 3000`,
        exitCode: 0,
      };

    case 'list':
    case 'ls':
      return {
        output: `fleetcore-api@2.4.1 /opt/fleetcore\n├── express@4.18.2\n├── knex@3.1.0\n├── pg@8.11.3\n├── redis@4.6.12\n├── bull@4.12.0\n├── jsonwebtoken@9.0.2\n├── helmet@7.1.0\n├── cors@2.8.5\n├── winston@3.11.0\n└── joi@17.11.0`,
        exitCode: 0,
      };

    case 'audit':
      return {
        output: `found 0 vulnerabilities`,
        exitCode: 0,
      };

    default:
      return { output: `Unknown command: "${subcommand}"`, exitCode: 1 };
  }
}

function npmInstall(cmd: ParsedCommand): CommandResult {
  const packages = cmd.args.slice(1);
  if (packages.length === 0) {
    return {
      output: `\nadded 287 packages, and audited 288 packages in 8s\n\n42 packages are looking for funding\n  run \`npm fund\` for details\n\nfound 0 vulnerabilities`,
      exitCode: 0,
    };
  }

  return {
    output: `\nadded ${packages.length} package${packages.length > 1 ? 's' : ''}, and audited ${288 + packages.length} packages in 3s\n\nfound 0 vulnerabilities`,
    exitCode: 0,
  };
}

function npmRun(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  const script = cmd.args[1];

  switch (script) {
    case 'dev':
      return {
        output: `\n> fleetcore-api@2.4.1 dev\n> ts-node-dev --respawn src/server.ts\n\n[INFO] ts-node-dev ver. 2.0.0\n[INFO] Compilation success\n[INFO] FleetCore API running on port 3000 (development)`,
        exitCode: 0,
      };

    case 'build':
      return {
        output: `\n> fleetcore-api@2.4.1 build\n> tsc\n\nCompilation complete. Output: ./dist`,
        exitCode: 0,
      };

    case 'test':
      return npmTest(ctx);

    case 'lint':
      return {
        output: `\n> fleetcore-api@2.4.1 lint\n> eslint src/\n\n✨ No issues found.`,
        exitCode: 0,
      };

    case 'migrate':
      return {
        output: `\n> fleetcore-api@2.4.1 migrate\n> knex migrate:latest\n\nBatch 1 run: 2 migrations\n  20240101_create_vehicles.ts\n  20240102_create_drivers.ts`,
        exitCode: 0,
      };

    case 'seed':
      return {
        output: `\n> fleetcore-api@2.4.1 seed\n> knex seed:run\n\nRan 1 seed files\n  seed_vehicles.ts`,
        exitCode: 0,
      };

    default:
      if (!script) {
        return {
          output: `Lifecycle scripts included in fleetcore-api@2.4.1:\n  start\n    node dist/server.js\n  test\n    jest --coverage\n\navailable via \`npm run-script\`:\n  dev\n  build\n  lint\n  migrate\n  seed`,
          exitCode: 0,
        };
      }
      return {
        output: `npm ERR! Missing script: "${script}"`,
        exitCode: 1,
      };
  }
}

function npmTest(ctx: CommandContext): CommandResult {
  return {
    output: `\n> fleetcore-api@2.4.1 test\n> jest --coverage\n\n PASS  src/__tests__/vehicles.test.ts\n  Vehicle API\n    ✓ GET /api/v1/vehicles returns vehicle list (23ms)\n    ✓ GET /api/v1/vehicles/:id returns single vehicle (15ms)\n    ✓ POST /api/v1/vehicles creates a vehicle (31ms)\n\n PASS  src/__tests__/health.test.ts\n  Health Check\n    ✓ GET /health returns 200 (8ms)\n\n----------|---------|----------|---------|---------|-------------------\nFile      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s\n----------|---------|----------|---------|---------|-------------------\nAll files |   72.34 |    58.33 |   68.75 |   71.43 |\n----------|---------|----------|---------|---------|-------------------\n\nTest Suites: 2 passed, 2 total\nTests:       4 passed, 4 total\nTime:        2.341s`,
    exitCode: 0,
  };
}

function handleNpx(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  const tool = cmd.args[0];
  if (!tool) {
    return { output: 'npx: requires at least one argument', exitCode: 1 };
  }

  switch (tool) {
    case 'tsc':
      return { output: 'Version 5.3.3', exitCode: 0 };
    case 'jest':
      return npmTest(ctx);
    case 'ts-node':
      if (cmd.args[1]) {
        return handleNode({ ...cmd, args: cmd.args.slice(1) }, ctx);
      }
      return { output: 'ts-node v10.9.2', exitCode: 0 };
    default:
      return { output: `npx: command not found: ${tool}`, exitCode: 1 };
  }
}

function evaluateJS(code: string, ctx: CommandContext): CommandResult {
  // Simple evaluation for common patterns
  try {
    if (code.includes('console.log')) {
      const match = code.match(/console\.log\((.+)\)/);
      if (match) {
        const arg = match[1].trim();
        if (arg.startsWith('"') || arg.startsWith("'") || arg.startsWith('`')) {
          return { output: arg.slice(1, -1), exitCode: 0 };
        }
        // Try to eval simple expressions
        if (/^[\d+\-*/() .]+$/.test(arg)) {
          return { output: String(eval(arg)), exitCode: 0 };
        }
        return { output: arg, exitCode: 0 };
      }
    }
    if (/^[\d+\-*/() .]+$/.test(code)) {
      return { output: String(eval(code)), exitCode: 0 };
    }
    return { output: 'undefined', exitCode: 0 };
  } catch {
    return { output: `SyntaxError: Unexpected token`, exitCode: 1 };
  }
}

function evaluateFileContent(content: string, filename: string, ctx: CommandContext): CommandResult {
  // Check if the file looks like a server/express app
  if (content.includes('express') && content.includes('listen')) {
    return {
      output: `[INFO] Server started from ${filename}\n[INFO] Listening on port 3000`,
      exitCode: 0,
    };
  }

  // Check for test files
  if (content.includes('describe') || content.includes('test(') || content.includes('it(')) {
    return npmTest(ctx);
  }

  // Default: "run" the file
  return { output: `[executed ${filename}]`, exitCode: 0 };
}
