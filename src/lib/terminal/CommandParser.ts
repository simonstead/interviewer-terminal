export interface ParsedCommand {
  command: string;
  args: string[];
  rawArgs: string;
  flags: Record<string, string | boolean>;
  inputRedirect?: string;
  outputRedirect?: { file: string; append: boolean };
}

export interface Pipeline {
  commands: ParsedCommand[];
  operators: Array<'|' | '&&' | '||' | ';'>;
}

export class CommandParser {
  /** Parse raw input into a Pipeline (handles pipes, &&, ||, ;) */
  parse(input: string): Pipeline {
    const segments = this.splitPipeline(input);
    const commands: ParsedCommand[] = [];
    const operators: Array<'|' | '&&' | '||' | ';'> = [];

    for (const seg of segments) {
      if (seg.type === 'operator') {
        operators.push(seg.value as '|' | '&&' | '||' | ';');
      } else {
        commands.push(this.parseCommand(seg.value));
      }
    }

    return { commands, operators };
  }

  private splitPipeline(input: string): Array<{ type: 'command' | 'operator'; value: string }> {
    const results: Array<{ type: 'command' | 'operator'; value: string }> = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        current += char;
        continue;
      }

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        current += char;
        continue;
      }

      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        current += char;
        continue;
      }

      if (inSingleQuote || inDoubleQuote) {
        current += char;
        continue;
      }

      // Check for operators
      if (char === '|' && input[i + 1] === '|') {
        if (current.trim()) results.push({ type: 'command', value: current.trim() });
        results.push({ type: 'operator', value: '||' });
        current = '';
        i++; // skip next |
        continue;
      }

      if (char === '&' && input[i + 1] === '&') {
        if (current.trim()) results.push({ type: 'command', value: current.trim() });
        results.push({ type: 'operator', value: '&&' });
        current = '';
        i++; // skip next &
        continue;
      }

      if (char === '|') {
        if (current.trim()) results.push({ type: 'command', value: current.trim() });
        results.push({ type: 'operator', value: '|' });
        current = '';
        continue;
      }

      if (char === ';') {
        if (current.trim()) results.push({ type: 'command', value: current.trim() });
        results.push({ type: 'operator', value: ';' });
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim()) results.push({ type: 'command', value: current.trim() });
    return results;
  }

  parseCommand(input: string): ParsedCommand {
    const tokens = this.tokenize(input);
    if (tokens.length === 0) {
      return { command: '', args: [], rawArgs: '', flags: {} };
    }

    const command = tokens[0];
    const args: string[] = [];
    const flags: Record<string, string | boolean> = {};
    let outputRedirect: { file: string; append: boolean } | undefined;
    let inputRedirect: string | undefined;

    let i = 1;
    while (i < tokens.length) {
      const token = tokens[i];

      // Output redirect
      if (token === '>>' && i + 1 < tokens.length) {
        outputRedirect = { file: tokens[i + 1], append: true };
        i += 2;
        continue;
      }
      if (token === '>' && i + 1 < tokens.length) {
        outputRedirect = { file: tokens[i + 1], append: false };
        i += 2;
        continue;
      }
      // Handle >> and > attached to a file name
      if (token.startsWith('>>')) {
        outputRedirect = { file: token.slice(2), append: true };
        i++;
        continue;
      }
      if (token.startsWith('>') && token.length > 1) {
        outputRedirect = { file: token.slice(1), append: false };
        i++;
        continue;
      }

      // Input redirect
      if (token === '<' && i + 1 < tokens.length) {
        inputRedirect = tokens[i + 1];
        i += 2;
        continue;
      }

      // Long flags (--flag=value or --flag value or --flag)
      if (token.startsWith('--')) {
        const eqIndex = token.indexOf('=');
        if (eqIndex !== -1) {
          flags[token.slice(2, eqIndex)] = token.slice(eqIndex + 1);
        } else if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
          flags[token.slice(2)] = tokens[i + 1];
          i++;
        } else {
          flags[token.slice(2)] = true;
        }
        i++;
        continue;
      }

      // Short flags (-f, -rf, -p value)
      if (token.startsWith('-') && token.length > 1 && !token.startsWith('-')) {
        // This handles single-char flags, potentially combined
        const flagChars = token.slice(1);
        for (const ch of flagChars) {
          flags[ch] = true;
        }
        i++;
        continue;
      }

      args.push(token);
      i++;
    }

    const rawArgs = tokens.slice(1).join(' ');

    return { command, args, rawArgs, flags, outputRedirect, inputRedirect };
  }

  /** Tokenize input respecting quotes */
  tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === '\\' && !inSingleQuote) {
        escaped = true;
        continue;
      }

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        continue;
      }

      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }

      if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }

      current += char;
    }

    if (current) tokens.push(current);
    return tokens;
  }
}
