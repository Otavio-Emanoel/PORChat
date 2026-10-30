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

  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleSeek = (index: number) => {
    const newProgress = (index / bars.length) * 100;
    setProgress(newProgress);
    if (!isPlaying) setIsPlaying(true);
  };

  const toggleSpeed = () => {
    setSpeed((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1));
  };

  const bars = [
    30, 60, 45, 80, 95, 40, 70, 85, 50, 65, 90, 75, 40, 60, 80, 55, 35, 70, 90, 45,
  ];

  const currentSeconds = Math.floor((progress / 100) * durationSeconds);
  const displayTime = `0:${currentSeconds.toString().padStart(2, '0')}`;

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-2xl ${
        isCurrentUser ? 'bg-emerald-100/60' : 'bg-gray-100/80'
      }`}
    >
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all tactile-btn cursor-pointer ${
          isCurrentUser
            ? 'bg-brand-primary text-white shadow-xs hover:bg-brand-primary/90'
            : 'bg-ink-main text-white hover:bg-ink-main/90'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      {/* Interactive Clickable Waveform Bars */}
      <div className="flex items-center gap-1 h-7 flex-1 min-w-[140px] cursor-pointer" title="Clique para navegar no áudio">
        {bars.map((height, i) => {
          const barProgress = (i / bars.length) * 100;
          const isPassed = progress >= barProgress;
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleSeek(i)}
              className={`w-1 rounded-full transition-all duration-150 hover:opacity-80 ${
                isPassed
                  ? isCurrentUser
                    ? 'bg-brand-primary'
                    : 'bg-ink-main'
                  : 'bg-gray-300'
              }`}
              style={{
                height: isPlaying ? `${Math.max(25, Math.sin(Date.now() / 200 + i) * 75 + 25)}%` : `${height}%`,
              }}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[11px] font-mono text-ink-muted w-8 text-right">
          {isPlaying ? displayTime : `0:${durationSeconds}`}
        </span>
        <button
          type="button"
          onClick={toggleSpeed}
          className="px-1.5 py-0.5 rounded bg-black/5 hover:bg-black/10 text-[10px] font-mono font-bold text-gray-600 transition-colors cursor-pointer"
          title="Alternar velocidade"
        >
          {speed}x
        </button>
      </div>
    </div>
  );
}
