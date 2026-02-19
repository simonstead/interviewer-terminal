import { CommandParser, Pipeline, ParsedCommand } from './CommandParser';
import { CommandRegistry, CommandResult } from './CommandRegistry';
import { CommandContext } from './CommandContext';

export class PipelineExecutor {
  private parser: CommandParser;
  private registry: CommandRegistry;

  constructor(parser: CommandParser, registry: CommandRegistry) {
    this.parser = parser;
    this.registry = registry;
  }

  async execute(input: string, ctx: CommandContext): Promise<CommandResult> {
    const pipeline = this.parser.parse(input);

    if (pipeline.commands.length === 0) {
      return { output: '', exitCode: 0 };
    }

    if (pipeline.commands.length === 1 && pipeline.operators.length === 0) {
      return this.executeCommand(pipeline.commands[0], ctx);
    }

    return this.executePipeline(pipeline, ctx);
  }

  private async executePipeline(pipeline: Pipeline, ctx: CommandContext): Promise<CommandResult> {
    let lastResult: CommandResult = { output: '', exitCode: 0 };
    let pipeInput: string | undefined;
    let i = 0;

    for (i = 0; i < pipeline.commands.length; i++) {
      const cmd = pipeline.commands[i];
      const operator = i > 0 ? pipeline.operators[i - 1] : undefined;

      // Check operator conditions
      if (operator === '&&' && lastResult.exitCode !== 0) {
        break;
      }
      if (operator === '||' && lastResult.exitCode === 0) {
        break;
      }

      // Execute command
      if (operator === '|') {
        // Pipe: pass previous output as stdin
        lastResult = await this.executeCommand(cmd, ctx, pipeInput);
        pipeInput = lastResult.output;
      } else {
        lastResult = await this.executeCommand(cmd, ctx, pipeInput);
        pipeInput = undefined;
      }

      // If next operator is a pipe, set up pipe input
      if (i < pipeline.operators.length && pipeline.operators[i] === '|') {
        pipeInput = lastResult.output;
      }
    }

    return lastResult;
  }

  private async executeCommand(
    cmd: ParsedCommand,
    ctx: CommandContext,
    stdin?: string
  ): Promise<CommandResult> {
    if (!cmd.command) {
      return { output: '', exitCode: 0 };
    }

    // Handle variable assignment (VAR=value)
    if (cmd.command.includes('=') && !cmd.command.startsWith('=')) {
      const eqIdx = cmd.command.indexOf('=');
      const key = cmd.command.slice(0, eqIdx);
      const value = cmd.command.slice(eqIdx + 1);
      if (/^[A-Za-z_]\w*$/.test(key)) {
        ctx.env[key] = value;
        return { output: '', exitCode: 0 };
      }
    }

    const handler = this.registry.get(cmd.command);
    if (!handler) {
      return {
        output: `${cmd.command}: command not found`,
        exitCode: 127,
      };
    }

    try {
      const result = await handler(cmd, ctx, stdin);
      ctx.exitCode = result.exitCode;

      // Handle output redirect
      if (cmd.outputRedirect) {
        const filePath = ctx.resolvePath(cmd.outputRedirect.file);
        if (cmd.outputRedirect.append) {
          ctx.fs.appendFile(filePath, result.output + '\n', '/');
        } else {
          ctx.fs.writeFile(filePath, result.output + '\n', '/');
        }
        return { output: '', exitCode: result.exitCode };
      }

      return result;
    } catch (err) {
      return {
        output: `${cmd.command}: internal error`,
        exitCode: 1,
      };
    }
  }
}
