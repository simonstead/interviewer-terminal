'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { TerminalEngine, TerminalEvent } from '@/lib/terminal/TerminalEngine';
import type { FSNodeJSON } from '@/lib/terminal/VirtualFileSystem';

interface UseTerminalOptions {
  sessionId: string;
  seniority: 'junior' | 'mid' | 'senior' | 'lead' | 'principal';
  filesystem: Record<string, FSNodeJSON> | null;
}

interface UseTerminalReturn {
  events: TerminalEvent[];
  engine: TerminalEngine | null;
  level: number;
  objectivesCompleted: number;
  objectivesTotal: number;
  handleEngineReady: (engine: TerminalEngine) => void;
  handleEvent: (event: TerminalEvent) => void;
}

export function useTerminal({ sessionId, seniority }: UseTerminalOptions): UseTerminalReturn {
  const [events, setEvents] = useState<TerminalEvent[]>([]);
  const [engine, setEngine] = useState<TerminalEngine | null>(null);
  const [level, setLevel] = useState(1);
  const [objectivesCompleted, setObjectivesCompleted] = useState(0);
  const [objectivesTotal, setObjectivesTotal] = useState(5);
  const eventBufferRef = useRef<TerminalEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Flush events to server periodically
  const flushEvents = useCallback(async () => {
    if (eventBufferRef.current.length === 0) return;

    const batch = [...eventBufferRef.current];
    eventBufferRef.current = [];

    try {
      await fetch(`/api/sessions/${sessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      });
    } catch {
      // Re-add events if flush failed
      eventBufferRef.current = [...batch, ...eventBufferRef.current];
    }
  }, [sessionId]);

  useEffect(() => {
    flushTimerRef.current = setInterval(flushEvents, 5000);
    return () => {
      clearInterval(flushTimerRef.current);
      flushEvents(); // Final flush on unmount
    };
  }, [flushEvents]);

  const handleEvent = useCallback((event: TerminalEvent) => {
    setEvents(prev => [...prev, event]);
    eventBufferRef.current.push(event);
  }, []);

  const handleEngineReady = useCallback((eng: TerminalEngine) => {
    setEngine(eng);
    // Update level/objectives from context periodically
    const checkInterval = setInterval(() => {
      const ctx = eng.getContext();
      setLevel(ctx.challenge.currentLevel);
      setObjectivesCompleted(ctx.challenge.completedObjectives.length);
    }, 1000);

    return () => clearInterval(checkInterval);
  }, []);

  return {
    events,
    engine,
    level,
    objectivesCompleted,
    objectivesTotal,
    handleEngineReady,
    handleEvent,
  };
}
