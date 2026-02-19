'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { terminalTheme } from '../terminal/TerminalTheme';
import { SessionReplay, ReplayState } from '@/lib/integrity/SessionReplay';
import { ReplayControls } from './ReplayControls';
import type { SessionEvent } from '@/lib/integrity/KeystrokeRecorder';

interface ReplayTerminalProps {
  events: SessionEvent[];
}

export function ReplayTerminal({ events }: ReplayTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const replayRef = useRef<SessionReplay | null>(null);
  const [replayState, setReplayState] = useState<ReplayState | null>(null);

  const handleReplayEvent = useCallback((event: SessionEvent) => {
    const xterm = xtermRef.current;
    if (!xterm) return;

    switch (event.type) {
      case 'key':
        xterm.write((event as { key: string }).key);
        break;
      case 'output':
        xterm.write((event as { content: string }).content + '\r\n');
        break;
      case 'command':
        // Command events could be shown as prompt + command
        break;
    }
  }, []);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const xterm = new Terminal({
      theme: terminalTheme,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      lineHeight: 1.4,
      cursorBlink: false,
      cursorStyle: 'block',
      scrollback: 5000,
      disableStdin: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;

    const replay = new SessionReplay(
      events,
      handleReplayEvent,
      setReplayState,
    );
    replayRef.current = replay;

    const observer = new ResizeObserver(() => fitAddon.fit());
    observer.observe(terminalRef.current);

    return () => {
      observer.disconnect();
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [events, handleReplayEvent]);

  const handlePlay = useCallback(() => {
    replayRef.current?.play();
  }, []);

  const handlePause = useCallback(() => {
    replayRef.current?.pause();
  }, []);

  const handleSetSpeed = useCallback((speed: number) => {
    replayRef.current?.setSpeed(speed);
  }, []);

  const handleSeek = useCallback((index: number) => {
    replayRef.current?.seekTo(index);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 bg-[#1a1b26]" style={{ padding: '8px' }}>
        <div ref={terminalRef} className="w-full h-full" />
      </div>
      <ReplayControls
        state={replayState}
        totalEvents={events.length}
        totalDuration={replayRef.current?.getTotalDuration() || 0}
        onPlay={handlePlay}
        onPause={handlePause}
        onSetSpeed={handleSetSpeed}
        onSeek={handleSeek}
      />
    </div>
  );
}
