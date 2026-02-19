import { SessionEvent } from './KeystrokeRecorder';
import { PatternAnalyzer, TypingPattern } from './PatternAnalyzer';
import { PasteDetector } from './PasteDetector';

export type FlagSeverity = 'high' | 'medium' | 'low';

export interface IntegrityFlag {
  severity: FlagSeverity;
  type: string;
  description: string;
  deduction: number;
  timestamp?: number;
}

export interface IntegrityReport {
  score: number;
  flags: IntegrityFlag[];
  patterns: TypingPattern;
  summary: string;
  pasteCount: number;
  totalPastedChars: number;
  tabAwayCount: number;
  hintsUsed: number;
  totalKeystrokes: number;
  sessionDuration: number;
}

const SEVERITY_DEDUCTIONS: Record<FlagSeverity, number> = {
  high: 30,
  medium: 15,
  low: 5,
};

export class IntegrityScorer {
  private analyzer: PatternAnalyzer;

  constructor() {
    this.analyzer = new PatternAnalyzer();
  }

  generateReport(events: SessionEvent[], pasteDetector: PasteDetector): IntegrityReport {
    const patterns = this.analyzer.analyze(events);
    const flags: IntegrityFlag[] = [];
    let score = 100;

    // Paste detection flags
    const pasteCount = pasteDetector.getPasteCount();
    const pastedChars = pasteDetector.getTotalPastedChars();

    if (pasteCount > 5) {
      const flag: IntegrityFlag = {
        severity: 'high',
        type: 'excessive_paste',
        description: `${pasteCount} paste events detected (${pastedChars} total characters)`,
        deduction: SEVERITY_DEDUCTIONS.high,
      };
      flags.push(flag);
      score -= flag.deduction;
    } else if (pasteCount > 2) {
      const flag: IntegrityFlag = {
        severity: 'medium',
        type: 'moderate_paste',
        description: `${pasteCount} paste events detected`,
        deduction: SEVERITY_DEDUCTIONS.medium,
      };
      flags.push(flag);
      score -= flag.deduction;
    }

    // Typing speed anomalies
    if (patterns.sustainedHighSpeedSegments > 0) {
      const flag: IntegrityFlag = {
        severity: 'medium',
        type: 'speed_anomaly',
        description: `${patterns.sustainedHighSpeedSegments} segments with sustained >200 WPM typing speed`,
        deduction: SEVERITY_DEDUCTIONS.medium,
      };
      flags.push(flag);
      score -= flag.deduction;
    }

    // Perfect code detection
    if (patterns.perfectCodeSegments > 2) {
      const flag: IntegrityFlag = {
        severity: 'medium',
        type: 'perfect_code',
        description: `${patterns.perfectCodeSegments} code segments with near-zero backspace ratio (>100 chars)`,
        deduction: SEVERITY_DEDUCTIONS.medium,
      };
      flags.push(flag);
      score -= flag.deduction;
    }

    // Idle-burst patterns
    if (patterns.idleBurstCount > 3) {
      const flag: IntegrityFlag = {
        severity: 'low',
        type: 'idle_burst',
        description: `${patterns.idleBurstCount} idle-then-burst typing patterns detected`,
        deduction: SEVERITY_DEDUCTIONS.low,
      };
      flags.push(flag);
      score -= flag.deduction;
    }

    // Tab away frequency
    if (patterns.tabAwayCount > 10) {
      const flag: IntegrityFlag = {
        severity: 'low',
        type: 'frequent_tab_away',
        description: `Tab away detected ${patterns.tabAwayCount} times`,
        deduction: SEVERITY_DEDUCTIONS.low,
      };
      flags.push(flag);
      score -= flag.deduction;
    }

    // Calculate session duration
    const keyEvents = events.filter(e => e.type === 'key');
    const sessionDuration = keyEvents.length >= 2
      ? (keyEvents[keyEvents.length - 1].timestamp - keyEvents[0].timestamp) / 1000
      : 0;

    const hintsUsed = events.filter(e => e.type === 'hint_used').length;

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      flags,
      patterns,
      summary: generateSummary(score, flags),
      pasteCount,
      totalPastedChars: pastedChars,
      tabAwayCount: patterns.tabAwayCount,
      hintsUsed,
      totalKeystrokes: keyEvents.length,
      sessionDuration,
    };
  }
}

function generateSummary(score: number, flags: IntegrityFlag[]): string {
  if (score >= 90) return 'Clean session - no significant integrity concerns.';
  if (score >= 70) return `Minor concerns detected: ${flags.map(f => f.type).join(', ')}. Review recommended.`;
  if (score >= 50) return `Multiple integrity flags raised. Careful review required.`;
  return `Significant integrity concerns. Session should be reviewed carefully before scoring.`;
}
