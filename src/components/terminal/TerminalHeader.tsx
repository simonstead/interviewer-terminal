'use client';

import React, { useState, useEffect } from 'react';

interface TerminalHeaderProps {
  level: number;
  maxLevel: number;
  seniority: string;
  startTime: number;
  objectivesCompleted: number;
  objectivesTotal: number;
}

export function TerminalHeader({
  level,
  maxLevel,
  seniority,
  startTime,
  objectivesCompleted,
  objectivesTotal,
}: TerminalHeaderProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = objectivesTotal > 0 ? (objectivesCompleted / objectivesTotal) * 100 : 0;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#16161e] border-b border-[#33467c] text-sm font-mono">
      <div className="flex items-center gap-4">
        <span className="text-cyan-400 font-bold">FleetCore</span>
        <span className="text-gray-400">|</span>
        <span className="text-yellow-400">Level {level}/{maxLevel}</span>
        <span className="text-gray-400">|</span>
        <span className="text-purple-400 capitalize">{seniority}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">Progress</span>
          <div className="w-32 h-2 bg-[#1a1b26] rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-gray-300 text-xs">
            {objectivesCompleted}/{objectivesTotal}
          </span>
        </div>
        <span className="text-gray-400">|</span>
        <span className="text-gray-300 tabular-nums">{formatTime(elapsed)}</span>
      </div>
    </div>
  );
}
