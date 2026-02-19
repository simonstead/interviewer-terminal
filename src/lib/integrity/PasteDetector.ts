export interface PasteEvent {
  content: string;
  timestamp: number;
  detectedBy: 'clipboard_api' | 'burst' | 'both';
  charCount: number;
}

export class PasteDetector {
  private pasteEvents: PasteEvent[] = [];
  private clipboardApiAvailable: boolean = false;

  constructor() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      this.clipboardApiAvailable = true;
    }
  }

  recordClipboardPaste(content: string): PasteEvent {
    const event: PasteEvent = {
      content,
      timestamp: Date.now(),
      detectedBy: 'clipboard_api',
      charCount: content.length,
    };
    this.pasteEvents.push(event);
    return event;
  }

  recordBurstPaste(charCount: number): PasteEvent {
    const event: PasteEvent = {
      content: `[burst: ${charCount} chars]`,
      timestamp: Date.now(),
      detectedBy: 'burst',
      charCount,
    };
    this.pasteEvents.push(event);
    return event;
  }

  getPasteEvents(): PasteEvent[] {
    return [...this.pasteEvents];
  }

  getTotalPastedChars(): number {
    return this.pasteEvents.reduce((sum, e) => sum + e.charCount, 0);
  }

  getPasteCount(): number {
    return this.pasteEvents.length;
  }

  isClipboardApiAvailable(): boolean {
    return this.clipboardApiAvailable;
  }
}
