'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

interface AudioWaveformBubbleProps {
  durationSeconds?: number;
  isCurrentUser: boolean;
}

export function AudioWaveformBubble({
  durationSeconds = 14,
  isCurrentUser,
}: AudioWaveformBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 100 / (durationSeconds * 10);
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, durationSeconds]);

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const bars = [
    30, 60, 45, 80, 95, 40, 70, 85, 50, 65, 90, 75, 40, 60, 80, 55, 35, 70, 90, 45,
  ];

  const currentSeconds = Math.floor((progress / 100) * durationSeconds);
  const displayTime = `0:${currentSeconds.toString().padStart(2, '0')}`;

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-2xl ${
        isCurrentUser ? 'bg-brand-primary/10' : 'bg-gray-100/80'
      }`}
    >
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all tactile-btn ${
          isCurrentUser
            ? 'bg-brand-primary text-white shadow-sm'
            : 'bg-ink-main text-white'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      {/* Waveform Bars */}
      <div className="flex items-center gap-0.5 h-7 flex-1 min-w-[140px]">
        {bars.map((height, i) => {
          const barProgress = (i / bars.length) * 100;
          const isPassed = progress >= barProgress;
          return (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-150 ${
                isPassed
                  ? isCurrentUser
                    ? 'bg-brand-primary'
                    : 'bg-ink-main'
                  : 'bg-gray-300'
              }`}
              style={{
                height: isPlaying ? `${Math.max(20, Math.sin(Date.now() / 200 + i) * 80 + 20)}%` : `${height}%`,
              }}
            />
          );
        })}
      </div>

      <span className="text-[11px] font-mono text-ink-muted shrink-0 w-8 text-right">
        {isPlaying ? displayTime : `0:${durationSeconds}`}
      </span>
    </div>
  );
}
