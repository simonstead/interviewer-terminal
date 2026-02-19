import { SessionEvent } from './KeystrokeRecorder';

export interface ReplayState {
  events: SessionEvent[];
  currentIndex: number;
  isPlaying: boolean;
  speed: number;
  startTime: number;
  elapsedTime: number;
}

export class SessionReplay {
  private events: SessionEvent[] = [];
  private currentIndex: number = 0;
  private isPlaying: boolean = false;
  private speed: number = 1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onEvent?: (event: SessionEvent) => void;
  private onStateChange?: (state: ReplayState) => void;

  constructor(
    events: SessionEvent[],
    onEvent?: (event: SessionEvent) => void,
    onStateChange?: (state: ReplayState) => void,
  ) {
    this.events = events.sort((a, b) => a.timestamp - b.timestamp);
    this.onEvent = onEvent;
    this.onStateChange = onStateChange;
  }

  play(): void {
    if (this.currentIndex >= this.events.length) {
      this.currentIndex = 0;
    }
    this.isPlaying = true;
    this.notifyStateChange();
    this.scheduleNext();
  }

  pause(): void {
    this.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.notifyStateChange();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    if (this.isPlaying) {
      // Restart scheduling with new speed
      if (this.timer) clearTimeout(this.timer);
      this.scheduleNext();
    }
    this.notifyStateChange();
  }

  seekTo(index: number): void {
    this.currentIndex = Math.max(0, Math.min(index, this.events.length - 1));
    this.notifyStateChange();
  }

  seekToTime(timestamp: number): void {
    const baseTime = this.events[0]?.timestamp || 0;
    const target = baseTime + timestamp;
    const idx = this.events.findIndex(e => e.timestamp >= target);
    if (idx !== -1) {
      this.currentIndex = idx;
    }
    this.notifyStateChange();
  }

  getState(): ReplayState {
    const baseTime = this.events[0]?.timestamp || 0;
    const currentTime = this.events[this.currentIndex]?.timestamp || baseTime;

    return {
      events: this.events,
      currentIndex: this.currentIndex,
      isPlaying: this.isPlaying,
      speed: this.speed,
      startTime: baseTime,
      elapsedTime: currentTime - baseTime,
    };
  }

  getTotalDuration(): number {
    if (this.events.length < 2) return 0;
    return this.events[this.events.length - 1].timestamp - this.events[0].timestamp;
  }

  private scheduleNext(): void {
    if (!this.isPlaying || this.currentIndex >= this.events.length) {
      this.isPlaying = false;
      this.notifyStateChange();
      return;
    }

    const event = this.events[this.currentIndex];
    this.onEvent?.(event);
    this.currentIndex++;

    if (this.currentIndex >= this.events.length) {
      this.isPlaying = false;
      this.notifyStateChange();
      return;
    }

    // Calculate delay to next event
    const nextEvent = this.events[this.currentIndex];
    let delay = (nextEvent.timestamp - event.timestamp) / this.speed;

    // Cap maximum delay to avoid long pauses
    delay = Math.min(delay, 2000 / this.speed);

    this.timer = setTimeout(() => this.scheduleNext(), delay);
  }

  private notifyStateChange(): void {
    this.onStateChange?.(this.getState());
  }
}
