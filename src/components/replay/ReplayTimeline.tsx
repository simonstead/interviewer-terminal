'use client';

import React from 'react';
import type { SessionEvent } from '@/lib/integrity/KeystrokeRecorder';

interface ReplayTimelineProps {
  events: SessionEvent[];
  currentIndex: number;
  onSeek: (index: number) => void;
}

export function ReplayTimeline({ events, currentIndex, onSeek }: ReplayTimelineProps) {
  if (events.length === 0) return null;

  const baseTime = events[0].timestamp;
  const totalDuration = events[events.length - 1].timestamp - baseTime;

  // Create event markers for significant events
  const markers = events
    .map((e, i) => ({ event: e, index: i }))
    .filter(({ event }) =>
      event.type === 'command' ||
      event.type === 'paste' ||
      event.type === 'objective_complete' ||
      event.type === 'level_advance'
    );

  const getMarkerColor = (type: string): string => {
    switch (type) {
      case 'command': return 'bg-blue-400';
      case 'paste': return 'bg-red-400';
      case 'objective_complete': return 'bg-green-400';
      case 'level_advance': return 'bg-purple-400';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="relative w-full h-8 bg-[#1a1b26] rounded">
      {/* Markers */}
      {markers.map(({ event, index }) => {
        const position = totalDuration > 0
          ? ((event.timestamp - baseTime) / totalDuration) * 100
          : 0;

        return (
          <div
            key={index}
            className={`absolute top-1 w-1 h-6 rounded-sm cursor-pointer hover:opacity-80 ${getMarkerColor(event.type)}`}
            style={{ left: `${position}%` }}
            onClick={() => onSeek(index)}
            title={`${event.type} at ${((event.timestamp - baseTime) / 1000).toFixed(1)}s`}
          />
        );
      })}

      {/* Current position indicator */}
      {events.length > 0 && (
        <div
          className="absolute top-0 w-0.5 h-full bg-white"
          style={{
            left: `${totalDuration > 0 ? ((events[currentIndex]?.timestamp - baseTime) / totalDuration) * 100 : 0}%`,
          }}
        />
      )}
    </div>
  );
}
