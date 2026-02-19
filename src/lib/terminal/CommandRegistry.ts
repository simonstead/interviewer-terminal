import { ParsedCommand } from './CommandParser';
import { CommandContext } from './CommandContext';

export interface CommandResult {
  output: string;
  exitCode: number;
}

export type CommandHandler = (
  cmd: ParsedCommand,
  ctx: CommandContext,
  stdin?: string
) => CommandResult | Promise<CommandResult>;

export class CommandRegistry {
  private handlers: Map<string, CommandHandler> = new Map();
  private aliases: Map<string, string> = new Map();

  register(name: string, handler: CommandHandler): void {
    this.handlers.set(name, handler);
  }

  registerAlias(alias: string, target: string): void {
    this.aliases.set(alias, target);
  }

  get(name: string): CommandHandler | undefined {
    const resolved = this.aliases.get(name) || name;
    return this.handlers.get(resolved);
  }

  has(name: string): boolean {
    const resolved = this.aliases.get(name) || name;
    return this.handlers.has(resolved);
  }

  getCommandNames(): string[] {
    const names = Array.from(this.handlers.keys());
    const aliasNames = Array.from(this.aliases.keys());
    return [...new Set([...names, ...aliasNames])].sort();
  }
}
