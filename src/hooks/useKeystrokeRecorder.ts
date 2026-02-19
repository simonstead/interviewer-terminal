'use client';

import { useRef, useEffect, useCallback } from 'react';
import { KeystrokeRecorder, SessionEvent } from '@/lib/integrity/KeystrokeRecorder';
import { PasteDetector } from '@/lib/integrity/PasteDetector';

interface UseKeystrokeRecorderOptions {
  sessionId: string;
  enabled?: boolean;
}

export function useKeystrokeRecorder({ sessionId, enabled = true }: UseKeystrokeRecorderOptions) {
  const recorderRef = useRef<KeystrokeRecorder | null>(null);
  const pasteDetectorRef = useRef<PasteDetector>(new PasteDetector());

  const flushToServer = useCallback(async (events: SessionEvent[]) => {
    if (!sessionId || events.length === 0) return;

    try {
      await fetch(`/api/sessions/${sessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
    } catch (err) {
      console.error('Failed to flush events:', err);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!enabled) return;

    const recorder = new KeystrokeRecorder(flushToServer);
    recorderRef.current = recorder;
    recorder.start();

    // Track focus/blur
    const handleFocus = () => recorder.recordFocusChange(true);
    const handleBlur = () => recorder.recordFocusChange(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      recorder.stop();
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled, flushToServer]);

  const recordKey = useCallback((key: string, meta: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }) => {
    recorderRef.current?.recordKey(key, meta);
  }, []);

  const recordPaste = useCallback((content: string) => {
    recorderRef.current?.recordPaste(content);
    pasteDetectorRef.current.recordClipboardPaste(content);
  }, []);

  const recordCommand = useCallback((raw: string, exitCode: number) => {
    recorderRef.current?.recordCommand(raw, exitCode);
  }, []);

  const getRecorder = useCallback(() => recorderRef.current, []);
  const getPasteDetector = useCallback(() => pasteDetectorRef.current, []);

  return {
    recordKey,
    recordPaste,
    recordCommand,
    getRecorder,
    getPasteDetector,
  };
}
