'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { terminalTheme } from './TerminalTheme';
import { TerminalEngine, TerminalEngineOptions } from '@/lib/terminal/TerminalEngine';
import type { FSNodeJSON } from '@/lib/terminal/VirtualFileSystem';

interface TerminalViewProps {
  filesystem?: Record<string, FSNodeJSON>;
  seniority?: 'junior' | 'mid' | 'senior' | 'lead' | 'principal';
  onEvent?: TerminalEngineOptions['onEvent'];
  onEngineReady?: (engine: TerminalEngine) => void;
  readOnly?: boolean;
}

export function TerminalView({
  filesystem,
  seniority = 'mid',
  onEvent,
  onEngineReady,
  readOnly = false,
}: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const engineRef = useRef<TerminalEngine | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const initTerminal = useCallback(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const xterm = new Terminal({
      theme: terminalTheme,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 14,
      lineHeight: 1.4,
      cursorBlink: !readOnly,
      cursorStyle: 'block',
      scrollback: 5000,
      allowProposedApi: true,
      disableStdin: readOnly,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    if (!readOnly) {
      // Create engine
      const engine = new TerminalEngine({
        seniority,
        filesystem,
        onEvent,
      });

      engine.setWriter((data: string) => {
        xterm.write(data);
      });

      // Load filesystem if provided
      if (filesystem) {
        engine.loadFileSystem(filesystem);
      }

      // Handle input
      xterm.onData((data: string) => {
        engine.handleInput(data);
      });

      // Handle paste
      xterm.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        // Allow Ctrl+V / Cmd+V for paste
        if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
          return false; // Let browser handle paste
        }
        // Allow Ctrl+C for copy when there's a selection
        if ((event.ctrlKey || event.metaKey) && event.key === 'c' && xterm.hasSelection()) {
          return false; // Let browser handle copy
        }
        return true;
      });

      // Listen for paste events
      terminalRef.current.addEventListener('paste', (e: ClipboardEvent) => {
        const text = e.clipboardData?.getData('text');
        if (text) {
          engine.handlePaste(text);
        }
      });

      engineRef.current = engine;
      onEngineReady?.(engine);

      // Boot the terminal
      engine.boot();
    }

    // Handle resize
    const observer = new ResizeObserver(() => {
      fitAddon.fit();
    });
    observer.observe(terminalRef.current);

    return () => {
      observer.disconnect();
      xterm.dispose();
      xtermRef.current = null;
      engineRef.current = null;
    };
  }, [filesystem, seniority, onEvent, onEngineReady, readOnly]);

  useEffect(() => {
    const cleanup = initTerminal();
    return cleanup;
  }, [initTerminal]);

  return (
    <div
      ref={terminalRef}
      className="w-full h-full bg-[#1a1b26]"
      style={{ padding: '8px' }}
    />
  );
}
