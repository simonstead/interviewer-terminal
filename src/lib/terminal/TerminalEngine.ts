import { VirtualFileSystem, FSNodeJSON } from './VirtualFileSystem';
import { CommandParser } from './CommandParser';
import { CommandRegistry } from './CommandRegistry';
import { CommandContext, ChallengeState } from './CommandContext';
import { PipelineExecutor } from './PipelineExecutor';
import { InputBuffer } from './InputBuffer';
import { registerFilesystemCommands } from './commands/filesystem';
import { registerSystemCommands } from './commands/system';
import { registerDockerCommands } from './commands/docker';
import { registerGitCommands } from './commands/git';
import { registerNodeCommands } from './commands/node';
import { registerPythonCommands } from './commands/python';
import { registerNetworkCommands } from './commands/network';
import { registerChallengeCommands, getObjectivesForLevel, getObjectiveTitle } from './commands/challenge';
import { LevelEvaluator } from '../challenges/LevelEvaluator';

export type WriteCallback = (data: string) => void;

export interface TerminalEngineOptions {
  seniority?: ChallengeState['seniority'];
  filesystem?: Record<string, FSNodeJSON>;
  onEvent?: (event: TerminalEvent) => void;
}

export interface TerminalEvent {
  type: 'command' | 'output' | 'key' | 'paste';
  data: string;
  timestamp: number;
  exitCode?: number;
}

export class TerminalEngine {
  private fs: VirtualFileSystem;
  private parser: CommandParser;
  private registry: CommandRegistry;
  private ctx: CommandContext;
  private executor: PipelineExecutor;
  private inputBuffer: InputBuffer;
  private write: WriteCallback = () => {};
  private onEvent?: (event: TerminalEvent) => void;
  private multiLineMode: { delimiter: string; lines: string[]; command: string } | null = null;
  private processing: boolean = false;

  constructor(options: TerminalEngineOptions = {}) {
    this.fs = new VirtualFileSystem();
    this.parser = new CommandParser();
    this.registry = new CommandRegistry();
    this.ctx = new CommandContext(this.fs, options.seniority || 'mid');
    this.executor = new PipelineExecutor(this.parser, this.registry);
    this.inputBuffer = new InputBuffer();
    this.onEvent = options.onEvent;

    // Register commands
    registerFilesystemCommands(this.registry);
    registerSystemCommands(this.registry);
    registerDockerCommands(this.registry);
    registerGitCommands(this.registry);
    registerNodeCommands(this.registry);
    registerPythonCommands(this.registry);
    registerNetworkCommands(this.registry);
    registerChallengeCommands(this.registry);

    // Override history command to use actual history
    this.registry.register('history', () => {
      const hist = this.inputBuffer.getHistory();
      const output = hist.map((cmd, i) => `  ${(i + 1).toString().padStart(4)}  ${cmd}`).join('\n');
      return { output, exitCode: 0 };
    });

    // Set up tab completion
    this.inputBuffer.setCompletionProvider((partial) => this.getCompletions(partial));

    // Load filesystem if provided
    if (options.filesystem) {
      this.fs.loadFromJSON(options.filesystem);
    }
  }

  /** Set the write callback (called to send data to xterm.js) */
  setWriter(write: WriteCallback): void {
    this.write = write;
  }

  /** Initialize the terminal with welcome message and first prompt */
  boot(): void {
    const welcome = [
      '\x1b[1;36m╔══════════════════════════════════════════════════════════════╗\x1b[0m',
      '\x1b[1;36m║\x1b[0m  \x1b[1;37mFleetCore Interview Platform\x1b[0m                               \x1b[1;36m║\x1b[0m',
      '\x1b[1;36m║\x1b[0m  \x1b[33mFleet Management System — Technical Assessment\x1b[0m              \x1b[1;36m║\x1b[0m',
      '\x1b[1;36m╚══════════════════════════════════════════════════════════════╝\x1b[0m',
      '',
      `  \x1b[37mRole:\x1b[0m ${this.ctx.challenge.seniority}`,
      `  \x1b[37mLevel:\x1b[0m ${this.ctx.challenge.currentLevel}/4`,
      '',
      '  Type \x1b[1mhelp\x1b[0m to see available commands.',
      '  Type \x1b[1mstatus\x1b[0m to see your current objectives.',
      '',
    ];

    this.write(welcome.join('\r\n') + '\r\n');
    this.writePrompt();
  }

  /** Handle input data from xterm.js */
  async handleInput(data: string): Promise<void> {
    if (this.processing) return;

    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      const code = char.charCodeAt(0);

      // Escape sequences
      if (char === '\x1b' && i + 1 < data.length) {
        if (data[i + 1] === '[') {
          const seq = data.slice(i + 2, i + 4);
          if (seq.startsWith('A')) { // Up arrow
            this.write(this.inputBuffer.historyUp());
            i += 2;
            continue;
          }
          if (seq.startsWith('B')) { // Down arrow
            this.write(this.inputBuffer.historyDown());
            i += 2;
            continue;
          }
          if (seq.startsWith('C')) { // Right arrow
            this.write(this.inputBuffer.moveRight());
            i += 2;
            continue;
          }
          if (seq.startsWith('D')) { // Left arrow
            this.write(this.inputBuffer.moveLeft());
            i += 2;
            continue;
          }
          if (seq.startsWith('H')) { // Home
            this.write(this.inputBuffer.moveToStart());
            i += 2;
            continue;
          }
          if (seq.startsWith('F')) { // End
            this.write(this.inputBuffer.moveToEnd());
            i += 2;
            continue;
          }
          if (seq === '3~') { // Delete
            this.write(this.inputBuffer.delete());
            i += 3;
            continue;
          }
        }
        continue;
      }

      // Ctrl+C - cancel current input
      if (code === 3) {
        if (this.multiLineMode) {
          this.multiLineMode = null;
          this.write('^C\r\n');
          this.writePrompt();
          this.inputBuffer.clear();
          continue;
        }
        this.write('^C\r\n');
        this.inputBuffer.clear();
        this.writePrompt();
        continue;
      }

      // Ctrl+D - EOF
      if (code === 4) {
        if (this.inputBuffer.getBuffer().length === 0) {
          this.write('\r\n');
          // Don't exit, just ignore
        }
        continue;
      }

      // Ctrl+L - clear screen
      if (code === 12) {
        this.write('\x1b[2J\x1b[H');
        this.writePrompt();
        this.write(this.inputBuffer.getBuffer());
        continue;
      }

      // Ctrl+A - move to start
      if (code === 1) {
        this.write(this.inputBuffer.moveToStart());
        continue;
      }

      // Ctrl+E - move to end
      if (code === 5) {
        this.write(this.inputBuffer.moveToEnd());
        continue;
      }

      // Ctrl+K - kill to end of line
      if (code === 11) {
        this.write(this.inputBuffer.killToEnd());
        continue;
      }

      // Ctrl+U - kill to start of line
      if (code === 21) {
        this.write(this.inputBuffer.killToStart());
        continue;
      }

      // Ctrl+W - delete word back
      if (code === 23) {
        this.write(this.inputBuffer.deleteWordBack());
        continue;
      }

      // Tab
      if (code === 9) {
        const result = this.inputBuffer.tabComplete();
        if (result.includes('\r\n')) {
          // Multiple completions shown - redraw prompt
          this.write(result);
          this.writePrompt();
          this.write(this.inputBuffer.getBuffer());
        } else {
          this.write(result);
        }
        continue;
      }

      // Backspace
      if (code === 127 || code === 8) {
        this.write(this.inputBuffer.backspace());
        continue;
      }

      // Enter
      if (char === '\r' || char === '\n') {
        this.write('\r\n');
        const command = this.inputBuffer.submit();
        await this.processCommand(command);
        continue;
      }

      // Printable characters
      if (code >= 32) {
        this.write(this.inputBuffer.insert(char));
        this.emitEvent({ type: 'key', data: char, timestamp: Date.now() });
      }
    }
  }

  /** Handle pasted text */
  handlePaste(text: string): void {
    // Filter out control characters except newlines
    const filtered = text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

    // Check for multi-line paste (might contain newlines)
    const lines = filtered.split(/\r?\n/);
    if (lines.length === 1) {
      this.write(this.inputBuffer.insertText(lines[0]));
    } else {
      // Execute each line as a command
      this.executePastedLines(lines);
    }

    this.emitEvent({ type: 'paste', data: text, timestamp: Date.now() });
  }

  private async executePastedLines(lines: string[]): Promise<void> {
    for (const line of lines) {
      if (line.trim()) {
        this.write(line + '\r\n');
        await this.processCommand(line.trim());
      }
    }
  }

  /** Process a submitted command */
  private async processCommand(raw: string): Promise<void> {
    if (!raw) {
      this.writePrompt();
      return;
    }

    // Handle multi-line mode (heredoc)
    if (this.multiLineMode) {
      if (raw === this.multiLineMode.delimiter) {
        // End of heredoc - process the collected lines
        const content = this.multiLineMode.lines.join('\n');
        const fullCommand = this.multiLineMode.command;
        this.multiLineMode = null;

        // Parse the heredoc target (e.g., "cat << EOF > file.txt")
        const redirectMatch = fullCommand.match(/>\s*(\S+)/);
        if (redirectMatch) {
          const filePath = this.ctx.resolvePath(redirectMatch[1]);
          this.ctx.fs.writeFile(filePath, content + '\n', '/');
        }

        this.emitEvent({ type: 'command', data: fullCommand, timestamp: Date.now() });
        this.checkObjectiveCompletion(fullCommand, 0);
        this.writePrompt();
        return;
      }
      this.multiLineMode.lines.push(raw);
      this.write('> ');
      return;
    }

    // Check for heredoc syntax
    const heredocMatch = raw.match(/<<\s*['"]?(\w+)['"]?/);
    if (heredocMatch) {
      this.multiLineMode = {
        delimiter: heredocMatch[1],
        lines: [],
        command: raw,
      };
      this.write('> ');
      return;
    }

    this.emitEvent({ type: 'command', data: raw, timestamp: Date.now() });

    this.processing = true;
    try {
      const result = await this.executor.execute(raw, this.ctx);
      if (result.output) {
        // Handle clear command specially
        if (result.output === '\x1b[2J\x1b[H') {
          this.write(result.output);
        } else {
          // Convert bare \n to \r\n for xterm.js
          const output = result.output.replace(/\r?\n/g, '\r\n');
          this.write(output + '\r\n');
        }
        this.emitEvent({ type: 'output', data: result.output, timestamp: Date.now(), exitCode: result.exitCode });
      }

      // Auto-track objective completion based on commands
      this.checkObjectiveCompletion(raw, result.exitCode);
    } catch (err) {
      this.write(`Error: ${err}\r\n`);
    } finally {
      this.processing = false;
    }

    this.writePrompt();
  }

  private writePrompt(): void {
    this.write(this.ctx.prompt);
  }

  /** Check if a command triggers automatic objective completion */
  private checkObjectiveCompletion(raw: string, exitCode: number): void {
    const newlyCompleted = LevelEvaluator.evaluate(this.ctx, raw, exitCode);
    if (newlyCompleted.length === 0) return;

    const completed = this.ctx.challenge.completedObjectives;
    for (const id of newlyCompleted) {
      completed.push(id);
      const title = getObjectiveTitle(id) ?? id;
      this.write(`\r\n\x1b[32m✓ Objective completed: ${title}\x1b[0m\r\n`);
      this.emitEvent({ type: 'output', data: `objective_complete:${id}`, timestamp: Date.now() });
    }

    // Check if all objectives for the current level are now complete
    const level = this.ctx.challenge.currentLevel;
    const { total, ids } = getObjectivesForLevel(level, this.ctx.challenge.seniority);
    const completedCount = ids.filter(id => completed.includes(id)).length;
    if (completedCount >= total && level < 4) {
      this.write(`\r\n\x1b[1;32m🎉 Level ${level} complete!\x1b[0m\r\n`);
      this.write(`Type \x1b[1mnext-level\x1b[0m to advance to Level ${level + 1}.\r\n`);
    } else if (completedCount >= total && level >= 4) {
      this.write(`\r\n\x1b[1;36m🎉 Congratulations! You have completed all levels!\x1b[0m\r\n`);
    }
  }

  private getCompletions(partial: string): string[] {
    // If partial contains a path separator, complete path
    if (partial.includes('/') || partial.startsWith('.') || partial.startsWith('~')) {
      return this.ctx.fs.completePath(partial, this.ctx.cwd);
    }

    // Get the current buffer to determine if this is a command or argument
    const buffer = this.inputBuffer.getBuffer();
    const tokens = buffer.trim().split(/\s+/);

    if (tokens.length <= 1) {
      // Complete command names
      const commands = this.registry.getCommandNames();
      return commands.filter(c => c.startsWith(partial));
    }

    // Complete paths for arguments
    return this.ctx.fs.completePath(partial, this.ctx.cwd);
  }

  private emitEvent(event: TerminalEvent): void {
    this.onEvent?.(event);
  }

  /** Get current context (for external use) */
  getContext(): CommandContext {
    return this.ctx;
  }

  /** Get objective progress for the current level */
  getObjectiveProgress(): { completed: number; total: number } {
    const ctx = this.ctx;
    const { total, ids } = getObjectivesForLevel(ctx.challenge.currentLevel, ctx.challenge.seniority);
    const completedCount = ids.filter(id => ctx.challenge.completedObjectives.includes(id)).length;
    return { completed: completedCount, total };
  }

  /** Get the filesystem (for snapshots) */
  getFileSystem(): VirtualFileSystem {
    return this.fs;
  }

  /** Load filesystem data */
  loadFileSystem(data: Record<string, FSNodeJSON>): void {
    this.fs.loadFromJSON(data);
  }

  /** Get the command registry (to register additional commands) */
  getRegistry(): CommandRegistry {
    return this.registry;
  }
}
