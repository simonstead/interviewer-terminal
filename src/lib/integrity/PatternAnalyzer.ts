import { SessionEvent } from './KeystrokeRecorder';

export interface TypingPattern {
  averageWPM: number;
  maxWPM: number;
  backspaceRatio: number;
  idleBurstCount: number;
  tabAwayCount: number;
  sustainedHighSpeedSegments: number;
  perfectCodeSegments: number;
}

export class PatternAnalyzer {
  analyze(events: SessionEvent[]): TypingPattern {
    const keyEvents = events.filter(e => e.type === 'key') as Array<SessionEvent & { type: 'key' }>;
    const focusEvents = events.filter(e => e.type === 'focus_change') as Array<SessionEvent & { type: 'focus_change' }>;

    return {
      averageWPM: this.calculateAverageWPM(keyEvents),
      maxWPM: this.calculateMaxWPM(keyEvents),
      backspaceRatio: this.calculateBackspaceRatio(keyEvents),
      idleBurstCount: this.detectIdleBursts(keyEvents),
      tabAwayCount: focusEvents.filter(e => !e.focused).length,
      sustainedHighSpeedSegments: this.detectSustainedHighSpeed(keyEvents),
      perfectCodeSegments: this.detectPerfectCode(keyEvents),
    };
  }

  private calculateAverageWPM(keyEvents: Array<SessionEvent & { type: 'key' }>): number {
    if (keyEvents.length < 2) return 0;

    const totalTime = (keyEvents[keyEvents.length - 1].timestamp - keyEvents[0].timestamp) / 1000 / 60;
    if (totalTime === 0) return 0;

    // Approximate: 5 chars per word
    const charCount = keyEvents.filter(e => e.key.length === 1 && e.key !== '\b').length;
    return Math.round(charCount / 5 / totalTime);
  }

  private calculateMaxWPM(keyEvents: Array<SessionEvent & { type: 'key' }>): number {
    if (keyEvents.length < 10) return 0;

    let maxWPM = 0;
    // Sliding window of 10 keystrokes
    for (let i = 0; i < keyEvents.length - 10; i++) {
      const windowTime = (keyEvents[i + 10].timestamp - keyEvents[i].timestamp) / 1000 / 60;
      if (windowTime > 0) {
        const wpm = 10 / 5 / windowTime; // 10 chars / 5 chars-per-word / minutes
        maxWPM = Math.max(maxWPM, wpm);
      }
    }

    return Math.round(maxWPM);
  }

  private calculateBackspaceRatio(keyEvents: Array<SessionEvent & { type: 'key' }>): number {
    if (keyEvents.length === 0) return 0;

    const backspaceCount = keyEvents.filter(e =>
      e.key === '\b' || e.key === 'Backspace' || e.key.charCodeAt(0) === 127
    ).length;

    return backspaceCount / keyEvents.length;
  }

  private detectIdleBursts(keyEvents: Array<SessionEvent & { type: 'key' }>): number {
    let count = 0;
    const IDLE_THRESHOLD = 10000; // 10 seconds of idle
    const BURST_THRESHOLD = 100; // followed by rapid typing (100ms gaps)
    const BURST_MIN_LENGTH = 20; // at least 20 chars

    for (let i = 1; i < keyEvents.length; i++) {
      const gap = keyEvents[i].timestamp - keyEvents[i - 1].timestamp;
      if (gap >= IDLE_THRESHOLD) {
        // Check for burst after idle
        let burstLen = 0;
        for (let j = i; j < keyEvents.length - 1; j++) {
          if (keyEvents[j + 1].timestamp - keyEvents[j].timestamp < BURST_THRESHOLD) {
            burstLen++;
          } else {
            break;
          }
        }
        if (burstLen >= BURST_MIN_LENGTH) {
          count++;
        }
      }
    }

    return count;
  }

  private detectSustainedHighSpeed(keyEvents: Array<SessionEvent & { type: 'key' }>): number {
    const HIGH_SPEED_WPM = 200;
    const SUSTAINED_CHARS = 50;
    let count = 0;

    for (let i = 0; i < keyEvents.length - SUSTAINED_CHARS; i++) {
      const windowTime = (keyEvents[i + SUSTAINED_CHARS].timestamp - keyEvents[i].timestamp) / 1000 / 60;
      if (windowTime > 0) {
        const wpm = SUSTAINED_CHARS / 5 / windowTime;
        if (wpm > HIGH_SPEED_WPM) {
          count++;
          i += SUSTAINED_CHARS; // Skip ahead to avoid double-counting
        }
      }
    }

    return count;
  }

  private detectPerfectCode(keyEvents: Array<SessionEvent & { type: 'key' }>): number {
    // Detect segments of 100+ chars with near-zero backspace ratio
    const SEGMENT_SIZE = 100;
    const MAX_BACKSPACE_RATIO = 0.02; // less than 2% backspaces
    let count = 0;

    for (let i = 0; i < keyEvents.length - SEGMENT_SIZE; i += SEGMENT_SIZE) {
      const segment = keyEvents.slice(i, i + SEGMENT_SIZE);
      const backspaces = segment.filter(e =>
        e.key === '\b' || e.key === 'Backspace' || e.key.charCodeAt(0) === 127
      ).length;

      if (backspaces / SEGMENT_SIZE < MAX_BACKSPACE_RATIO) {
        count++;
      }
    }

    return count;
  }
}
