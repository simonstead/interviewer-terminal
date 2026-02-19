'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { TerminalHeader } from '@/components/terminal/TerminalHeader';
import type { TerminalEngine, TerminalEvent } from '@/lib/terminal/TerminalEngine';
import type { FSNodeJSON } from '@/lib/terminal/VirtualFileSystem';

// Dynamic import to avoid SSR issues with xterm.js
const TerminalView = dynamic(
  () => import('@/components/terminal/TerminalView').then(m => ({ default: m.TerminalView })),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#1a1b26] flex items-center justify-center text-gray-500">Loading terminal...</div> }
);

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function SessionPage({ params }: PageProps) {
  const [sessionId, setSessionId] = useState<string>('');
  const [filesystem, setFilesystem] = useState<Record<string, FSNodeJSON> | null>(null);
  const [loading, setLoading] = useState(true);
  const [seniority] = useState<'junior' | 'mid' | 'senior' | 'lead' | 'principal'>('mid');
  const [level, setLevel] = useState(1);
  const [objectivesCompleted, setObjectivesCompleted] = useState(0);
  const [objectivesTotal, setObjectivesTotal] = useState(5);
  const startTimeRef = useRef(Date.now());
  const engineRef = useRef<TerminalEngine | null>(null);

  // Resolve params
  useEffect(() => {
    params.then(p => setSessionId(p.sessionId));
  }, [params]);

  // Load filesystem
  useEffect(() => {
    if (!sessionId) return;
    loadFilesystem().then(fs => {
      setFilesystem(fs);
      setLoading(false);
    });
  }, [sessionId]);

  // Poll engine context for challenge state updates
  useEffect(() => {
    const interval = setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      const ctx = engine.getContext();
      const progress = engine.getObjectiveProgress();
      setLevel(ctx.challenge.currentLevel);
      setObjectivesCompleted(progress.completed);
      setObjectivesTotal(progress.total);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const onEvent = useCallback((event: TerminalEvent) => {
    // Flush events to server
    if (sessionId) {
      // Batch would be better, but for now send immediately on commands
      if (event.type === 'command' || event.type === 'paste') {
        fetch(`/api/sessions/${sessionId}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: [event] }),
        }).catch(() => {});
      }
    }
  }, [sessionId]);

  const onEngineReady = useCallback((engine: TerminalEngine) => {
    engineRef.current = engine;
  }, []);

  if (loading || !filesystem) {
    return (
      <div className="h-screen bg-[#1a1b26] flex items-center justify-center">
        <div className="text-center">
          <div className="text-cyan-400 text-2xl font-bold mb-2">FleetCore</div>
          <div className="text-gray-400">Initializing terminal environment...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#1a1b26]">
      <TerminalHeader
        level={level}
        maxLevel={4}
        seniority={seniority}
        startTime={startTimeRef.current}
        objectivesCompleted={objectivesCompleted}
        objectivesTotal={objectivesTotal}
      />
      <div className="flex-1 overflow-hidden">
        <TerminalView
          filesystem={filesystem}
          seniority={seniority}
          onEvent={onEvent}
          onEngineReady={onEngineReady}
        />
      </div>
    </div>
  );
}

async function loadFilesystem(): Promise<Record<string, FSNodeJSON>> {
  try {
    const res = await fetch('/api/filesystem');
    if (res.ok) {
      return res.json();
    }
  } catch {
    // Fall through to default
  }

  return getDefaultFilesystem();
}

function getDefaultFilesystem(): Record<string, FSNodeJSON> {
  return {
    home: {
      name: 'home',
      type: 'directory',
      children: {
        candidate: {
          name: 'candidate',
          type: 'directory',
          children: {},
        },
      },
    },
    opt: {
      name: 'opt',
      type: 'directory',
      children: {
        fleetcore: {
          name: 'fleetcore',
          type: 'directory',
          children: {
            'README.md': {
              name: 'README.md',
              type: 'file',
              content: '# FleetCore\nFleet Management Platform\n',
            },
          },
        },
      },
    },
    tmp: { name: 'tmp', type: 'directory', children: {} },
  };
}
