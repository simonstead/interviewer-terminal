export interface KeyMeta {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

export type SessionEvent =
  | { type: 'key'; key: string; timestamp: number; meta: KeyMeta }
  | { type: 'paste'; content: string; timestamp: number; detectedBy: 'clipboard_api' | 'burst' | 'both' }
  | { type: 'output'; content: string; timestamp: number }
  | { type: 'command'; raw: string; timestamp: number; exitCode: number }
  | { type: 'objective_complete'; objectiveId: string; timestamp: number }
  | { type: 'level_advance'; level: number; timestamp: number }
  | { type: 'hint_used'; hintId: string; timestamp: number }
  | { type: 'focus_change'; focused: boolean; timestamp: number }
  | { type: 'resize'; cols: number; rows: number; timestamp: number };

export class KeystrokeRecorder {
  private events: SessionEvent[] = [];
  private onFlush?: (events: SessionEvent[]) => void;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private burstDetector: BurstDetector;

  constructor(onFlush?: (events: SessionEvent[]) => void) {
    this.onFlush = onFlush;
    this.burstDetector = new BurstDetector();
  }

  start(): void {
    // Flush every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }

  recordKey(key: string, meta: KeyMeta): void {
    const event: SessionEvent = {
      type: 'key',
      key,
      timestamp: Date.now(),
      meta,
    };
    this.events.push(event);

    // Check for burst (potential paste)
    const burstResult = this.burstDetector.addKeystroke(event.timestamp);
    if (burstResult) {
      this.events.push({
        type: 'paste',
        content: `[burst detected: ${burstResult.count} chars in ${burstResult.duration}ms]`,
        timestamp: Date.now(),
        detectedBy: 'burst',
      });
    }
  }

  recordPaste(content: string): void {
    const hasBurst = this.burstDetector.isInBurst();
    this.events.push({
      type: 'paste',
      content,
      timestamp: Date.now(),
      detectedBy: hasBurst ? 'both' : 'clipboard_api',
    });
  }

  recordCommand(raw: string, exitCode: number): void {
    this.events.push({
      type: 'command',
      raw,
      timestamp: Date.now(),
      exitCode,
    });
  }

  recordOutput(content: string): void {
    this.events.push({
      type: 'output',
      content,
      timestamp: Date.now(),
    });
  }

  recordFocusChange(focused: boolean): void {
    this.events.push({
      type: 'focus_change',
      focused,
      timestamp: Date.now(),
    });
  }

  recordResize(cols: number, rows: number): void {
    this.events.push({
      type: 'resize',
      cols,
      rows,
      timestamp: Date.now(),
    });
  }

  recordObjectiveComplete(objectiveId: string): void {
    this.events.push({
      type: 'objective_complete',
      objectiveId,
      timestamp: Date.now(),
    });
  }

  recordLevelAdvance(level: number): void {
    this.events.push({
      type: 'level_advance',
      level,
      timestamp: Date.now(),
    });
  }

  recordHintUsed(hintId: string): void {
    this.events.push({
      type: 'hint_used',
      hintId,
      timestamp: Date.now(),
    });
  }

  getEvents(): SessionEvent[] {
    return [...this.events];
  }

  flush(): void {
    if (this.events.length === 0) return;
    const batch = [...this.events];
    this.events = [];
    this.onFlush?.(batch);
  }
}

class BurstDetector {
  private timestamps: number[] = [];
  private readonly BURST_THRESHOLD = 50; // ms between keystrokes
  private readonly BURST_MIN_CHARS = 30; // minimum chars for a burst

  addKeystroke(timestamp: number): { count: number; duration: number } | null {
    this.timestamps.push(timestamp);

    // Keep only recent timestamps
    const cutoff = timestamp - 5000;
    this.timestamps = this.timestamps.filter(t => t > cutoff);

    // Check for burst pattern
    if (this.timestamps.length < this.BURST_MIN_CHARS) return null;

    // Count consecutive rapid keystrokes
    let burstCount = 1;
    let burstStart = this.timestamps.length - 1;

    for (let i = this.timestamps.length - 1; i > 0; i--) {
      const gap = this.timestamps[i] - this.timestamps[i - 1];
      if (gap <= this.BURST_THRESHOLD) {
        burstCount++;
        burstStart = i - 1;
      } else {
        break;
      }
    }

    if (burstCount >= this.BURST_MIN_CHARS) {
      const duration = timestamp - this.timestamps[burstStart];
      this.timestamps = []; // Reset after detection
      return { count: burstCount, duration };
    }

    return null;
  }

  isInBurst(): boolean {
    if (this.timestamps.length < 5) return false;
    const recent = this.timestamps.slice(-5);
    const avgGap = (recent[4] - recent[0]) / 4;
    return avgGap < this.BURST_THRESHOLD;
  }
}
