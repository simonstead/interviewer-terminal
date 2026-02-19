type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

// Map of sessionId → array of connected SSE clients
const sessionClients = new Map<string, SSEClient[]>();

export function addSSEClient(sessionId: string, clientId: string, controller: ReadableStreamDefaultController): void {
  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, []);
  }
  sessionClients.get(sessionId)!.push({ id: clientId, controller });
}

export function removeSSEClient(sessionId: string, clientId: string): void {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;

  const filtered = clients.filter(c => c.id !== clientId);
  if (filtered.length === 0) {
    sessionClients.delete(sessionId);
  } else {
    sessionClients.set(sessionId, filtered);
  }
}

export function broadcastToSession(sessionId: string, event: unknown): void {
  const clients = sessionClients.get(sessionId);
  if (!clients || clients.length === 0) return;

  const data = `data: ${JSON.stringify(event)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);

  const deadClients: string[] = [];

  for (const client of clients) {
    try {
      client.controller.enqueue(encoded);
    } catch {
      deadClients.push(client.id);
    }
  }

  // Clean up dead clients
  for (const id of deadClients) {
    removeSSEClient(sessionId, id);
  }
}

export function getActiveSessionIds(): string[] {
  return Array.from(sessionClients.keys());
}

export function getClientCount(sessionId: string): number {
  return sessionClients.get(sessionId)?.length || 0;
}
