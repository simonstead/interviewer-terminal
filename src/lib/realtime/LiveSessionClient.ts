export type LiveEventHandler = (event: unknown) => void;

export class LiveSessionClient {
  private eventSource: EventSource | null = null;
  private sessionId: string;
  private onEvent: LiveEventHandler;
  private onConnect?: () => void;
  private onDisconnect?: () => void;

  constructor(
    sessionId: string,
    onEvent: LiveEventHandler,
    options?: { onConnect?: () => void; onDisconnect?: () => void }
  ) {
    this.sessionId = sessionId;
    this.onEvent = onEvent;
    this.onConnect = options?.onConnect;
    this.onDisconnect = options?.onDisconnect;
  }

  connect(): void {
    this.eventSource = new EventSource(`/api/sessions/${this.sessionId}/live`);

    this.eventSource.onopen = () => {
      this.onConnect?.();
    };

    this.eventSource.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        this.onEvent(event);
      } catch {
        // Ignore parse errors
      }
    };

    this.eventSource.onerror = () => {
      this.onDisconnect?.();
    };
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}
