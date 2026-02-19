'use client';

import React from 'react';
import type { ReplayState } from '@/lib/integrity/SessionReplay';

interface ReplayControlsProps {
  state: ReplayState | null;
  totalEvents: number;
  totalDuration: number;
  onPlay: () => void;
  onPause: () => void;
  onSetSpeed: (speed: number) => void;
  onSeek: (index: number) => void;
}

export function ReplayControls({
  state,
  totalEvents,
  totalDuration,
  onPlay,
  onPause,
  onSetSpeed,
  onSeek,
}: ReplayControlsProps) {
  const isPlaying = state?.isPlaying || false;
  const currentIndex = state?.currentIndex || 0;
  const speed = state?.speed || 1;
  const elapsed = state?.elapsedTime || 0;

  const formatTime = (ms: number): string => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = totalEvents > 0 ? (currentIndex / totalEvents) * 100 : 0;

  return (
    <div className="bg-[#16161e] border-t border-[#33467c] px-4 py-3">
      {/* Timeline bar */}
      <div
        className="w-full h-1.5 bg-[#1a1b26] rounded-full mb-3 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const fraction = (e.clientX - rect.left) / rect.width;
          onSeek(Math.floor(fraction * totalEvents));
        }}
      >
        <div
          className="h-full bg-cyan-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={isPlaying ? onPause : onPlay}
            className="w-8 h-8 flex items-center justify-center bg-[#33467c] rounded-lg hover:bg-[#445588] transition-colors"
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-white">
                <rect x="2" y="1" width="4" height="12" rx="1" />
                <rect x="8" y="1" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-white">
                <path d="M3 1.5L12 7L3 12.5V1.5Z" />
              </svg>
            )}
          </button>

          {/* Speed controls */}
          <div className="flex items-center gap-1">
            {[1, 2, 4, 8].map(s => (
              <button
                key={s}
                onClick={() => onSetSpeed(s)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  speed === s
                    ? 'bg-cyan-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Time display */}
        <div className="text-sm text-gray-400 tabular-nums">
          {formatTime(elapsed)} / {formatTime(totalDuration)}
          <span className="ml-3 text-gray-500">
            {currentIndex}/{totalEvents} events
          </span>
        </div>
      </div>
    </div>
  );
}
