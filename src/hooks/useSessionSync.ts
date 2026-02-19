'use client';

import { useRef, useEffect, useCallback } from 'react';

interface UseSessionSyncOptions {
  sessionId: string;
  interval?: number;
}

export function useSessionSync({ sessionId, interval = 5000 }: UseSessionSyncOptions) {
  const bufferRef = useRef<unknown[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const flush = useCallback(async () => {
    if (bufferRef.current.length === 0 || !sessionId) return;

    const batch = [...bufferRef.current];
    bufferRef.current = [];

    try {
      await fetch(`/api/sessions/${sessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      });
    } catch {
      // Re-add on failure
      bufferRef.current = [...batch, ...bufferRef.current];
    }
  }, [sessionId]);

  useEffect(() => {
    timerRef.current = setInterval(flush, interval);
    return () => {
      clearInterval(timerRef.current);
      flush();
    };
  }, [flush, interval]);

  const addEvent = useCallback((event: unknown) => {
    bufferRef.current.push(event);
  }, []);

  return { addEvent, flush };
}
