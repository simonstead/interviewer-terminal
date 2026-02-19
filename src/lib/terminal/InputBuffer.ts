export class InputBuffer {
  private buffer: string = '';
  private cursorPos: number = 0;
  private history: string[] = [];
  private historyIndex: number = -1;
  private tempBuffer: string = '';
  private completionCallback?: (partial: string) => string[];

  /** Set the tab completion provider */
  setCompletionProvider(cb: (partial: string) => string[]): void {
    this.completionCallback = cb;
  }

  /** Get the current buffer contents */
  getBuffer(): string {
    return this.buffer;
  }

  /** Get cursor position */
  getCursorPos(): number {
    return this.cursorPos;
  }

  /** Clear the buffer */
  clear(): void {
    this.buffer = '';
    this.cursorPos = 0;
    this.historyIndex = -1;
  }

  /** Insert a character at cursor position */
  insert(char: string): string {
    const before = this.buffer.slice(0, this.cursorPos);
    const after = this.buffer.slice(this.cursorPos);
    this.buffer = before + char + after;
    this.cursorPos += char.length;

    // Return the output to write to the terminal
    if (after.length > 0) {
      // Need to redraw from cursor to end, then move cursor back
      return char + after + `\x1b[${after.length}D`;
    }
    return char;
  }

  /** Handle backspace */
  backspace(): string {
    if (this.cursorPos === 0) return '';

    const before = this.buffer.slice(0, this.cursorPos - 1);
    const after = this.buffer.slice(this.cursorPos);
    this.buffer = before + after;
    this.cursorPos--;

    if (after.length > 0) {
      // Move back, write rest of line + space to clear, move cursor back
      return `\x1b[D${after} \x1b[${after.length + 1}D`;
    }
    return '\x1b[D \x1b[D';
  }

  /** Handle delete key */
  delete(): string {
    if (this.cursorPos >= this.buffer.length) return '';

    const before = this.buffer.slice(0, this.cursorPos);
    const after = this.buffer.slice(this.cursorPos + 1);
    this.buffer = before + after;

    return after + ' ' + `\x1b[${after.length + 1}D`;
  }

  /** Move cursor left */
  moveLeft(): string {
    if (this.cursorPos === 0) return '';
    this.cursorPos--;
    return '\x1b[D';
  }

  /** Move cursor right */
  moveRight(): string {
    if (this.cursorPos >= this.buffer.length) return '';
    this.cursorPos++;
    return '\x1b[C';
  }

  /** Move to beginning of line (Home/Ctrl+A) */
  moveToStart(): string {
    if (this.cursorPos === 0) return '';
    const moves = this.cursorPos;
    this.cursorPos = 0;
    return `\x1b[${moves}D`;
  }

  /** Move to end of line (End/Ctrl+E) */
  moveToEnd(): string {
    if (this.cursorPos >= this.buffer.length) return '';
    const moves = this.buffer.length - this.cursorPos;
    this.cursorPos = this.buffer.length;
    return `\x1b[${moves}C`;
  }

  /** Kill to end of line (Ctrl+K) */
  killToEnd(): string {
    if (this.cursorPos >= this.buffer.length) return '';
    const killed = this.buffer.length - this.cursorPos;
    this.buffer = this.buffer.slice(0, this.cursorPos);
    return ' '.repeat(killed) + `\x1b[${killed}D`;
  }

  /** Kill to beginning of line (Ctrl+U) */
  killToStart(): string {
    if (this.cursorPos === 0) return '';
    const killed = this.cursorPos;
    this.buffer = this.buffer.slice(this.cursorPos);
    this.cursorPos = 0;
    // Move to start, write new buffer + spaces, move to start
    return `\x1b[${killed}D` + this.buffer + ' '.repeat(killed) + `\x1b[${this.buffer.length + killed}D`;
  }

  /** Delete word backwards (Ctrl+W) */
  deleteWordBack(): string {
    if (this.cursorPos === 0) return '';
    const before = this.buffer.slice(0, this.cursorPos);
    const after = this.buffer.slice(this.cursorPos);

    // Find word boundary
    let newPos = this.cursorPos - 1;
    while (newPos > 0 && this.buffer[newPos - 1] === ' ') newPos--;
    while (newPos > 0 && this.buffer[newPos - 1] !== ' ') newPos--;

    const deleted = this.cursorPos - newPos;
    this.buffer = before.slice(0, newPos) + after;
    this.cursorPos = newPos;

    return `\x1b[${deleted}D` + after + ' '.repeat(deleted) + `\x1b[${after.length + deleted}D`;
  }

  /** Navigate history up */
  historyUp(): string {
    if (this.history.length === 0) return '';

    if (this.historyIndex === -1) {
      this.tempBuffer = this.buffer;
      this.historyIndex = this.history.length - 1;
    } else if (this.historyIndex > 0) {
      this.historyIndex--;
    } else {
      return '';
    }

    return this.replaceLine(this.history[this.historyIndex]);
  }

  /** Navigate history down */
  historyDown(): string {
    if (this.historyIndex === -1) return '';

    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      return this.replaceLine(this.history[this.historyIndex]);
    } else {
      this.historyIndex = -1;
      return this.replaceLine(this.tempBuffer);
    }
  }

  /** Replace the entire current line */
  private replaceLine(newContent: string): string {
    // Move to start, clear line, write new content
    const clearLen = this.buffer.length;
    let output = '';

    if (this.cursorPos > 0) {
      output += `\x1b[${this.cursorPos}D`;
    }
    output += ' '.repeat(clearLen);
    if (clearLen > 0) {
      output += `\x1b[${clearLen}D`;
    }
    output += newContent;

    this.buffer = newContent;
    this.cursorPos = newContent.length;
    return output;
  }

  /** Handle tab completion */
  tabComplete(): string {
    if (!this.completionCallback) return '';

    // Get the word being completed
    const beforeCursor = this.buffer.slice(0, this.cursorPos);
    const tokens = beforeCursor.split(/\s+/);
    const partial = tokens[tokens.length - 1] || '';

    const candidates = this.completionCallback(partial);
    if (candidates.length === 0) return '';

    if (candidates.length === 1) {
      // Complete the word
      const completion = candidates[0];
      const toAdd = completion.slice(partial.length);
      // Add space after completion unless it ends with /
      const suffix = completion.endsWith('/') ? '' : ' ';
      return this.insert(toAdd + suffix);
    }

    // Multiple candidates: find common prefix
    const commonPrefix = this.findCommonPrefix(candidates);
    if (commonPrefix.length > partial.length) {
      const toAdd = commonPrefix.slice(partial.length);
      return this.insert(toAdd);
    }

    // Show all candidates
    const display = '\r\n' + candidates.join('  ') + '\r\n';
    return display;
  }

  private findCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
      while (!strings[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
      }
    }
    return prefix;
  }

  /** Submit the current buffer (Enter pressed) */
  submit(): string {
    const command = this.buffer.trim();
    if (command) {
      this.history.push(command);
    }
    this.buffer = '';
    this.cursorPos = 0;
    this.historyIndex = -1;
    return command;
  }

  /** Get history for the `history` command */
  getHistory(): string[] {
    return [...this.history];
  }

  /** Insert text directly (for paste) */
  insertText(text: string): string {
    let output = '';
    for (const char of text) {
      if (char === '\n' || char === '\r') continue;
      output += this.insert(char);
    }
    return output;
  }
}
