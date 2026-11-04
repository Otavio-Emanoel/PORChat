'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Mic, Download, ShieldCheck } from 'lucide-react';
import type { MessageAttachment } from '@/lib/types';
import { synthesizePlayableVoiceWav } from '@/lib/voiceRecorder';
import { API_BASE } from '@/lib/apiClient';

interface AudioWaveformBubbleProps {
  duration?: string;
  isMe: boolean;
  attachment?: MessageAttachment | null;
}

const DEFAULT_BARS = [
  28, 52, 44, 76, 60, 88, 36, 65, 82, 48, 70, 92, 54, 40, 68, 85, 50, 34, 74, 62, 45, 58, 38, 30,
];

export function AudioWaveformBubble({
  duration = '0:04',
  isMe,
  attachment,
}: AudioWaveformBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const totalSeconds = attachment?.duration_seconds || 4;
  const bars =
    attachment?.waveform && attachment.waveform.length >= 6 ? attachment.waveform : DEFAULT_BARS;

  const formatSeconds = (sec: number) => {
    const clamped = Math.max(0, Math.round(sec));
    const mins = Math.floor(clamped / 60);
    const rem = clamped % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  useEffect(() => {
    let srcUrl = '';
    if (attachment?.data_url) {
      srcUrl = attachment.data_url;
    } else if (attachment?.url) {
      srcUrl = attachment.url.startsWith('http') ? attachment.url : `${API_BASE}${attachment.url}`;
    } else {
      srcUrl = synthesizePlayableVoiceWav(totalSeconds).dataBase64;
    }

    const audio = new Audio(srcUrl);
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onTimeUpdate = () => {
      const dur = audio.duration && isFinite(audio.duration) ? audio.duration : totalSeconds;
      setCurrentTimeSec(audio.currentTime);
      setProgress(Math.min(100, (audio.currentTime / Math.max(0.5, dur)) * 100));
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTimeSec(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, [attachment?.data_url, attachment?.url, totalSeconds]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.playbackRate = playbackRate;
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const cycleSpeed = () => {
    const nextRate: 1 | 1.5 | 2 = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const displayTime = isPlaying
    ? formatSeconds(currentTimeSec)
    : attachment?.duration_seconds
    ? formatSeconds(attachment.duration_seconds)
    : duration;

  const downloadHref =
    attachment?.data_url ||
    (attachment?.url
      ? attachment.url.startsWith('http')
        ? attachment.url
        : `${API_BASE}${attachment.url}`
      : undefined);

  return (
    <div className="flex min-w-[235px] max-w-[320px] items-center gap-3 py-1">
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm transition active:scale-95 ${
          isMe
            ? 'bg-white text-[#6C5CE7] hover:bg-slate-100'
            : 'bg-[#6C5CE7] text-white hover:bg-[#5B4BC4]'
        }`}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex h-6 items-center gap-[3px]">
          {bars.map((height, idx) => {
            const barPercent = (idx / bars.length) * 100;
            const isPlayed = barPercent <= progress;
            return (
              <div
                key={idx}
                className={`w-1 rounded-full transition-all duration-150 ${
                  isMe
                    ? isPlayed
                      ? 'bg-white'
                      : 'bg-white/35'
                    : isPlayed
                    ? 'bg-[#6C5CE7]'
                    : 'bg-slate-300'
                }`}
                style={{ height: `${Math.max(18, height * 0.85)}%` }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] font-semibold">
          <span className={`flex items-center gap-1 ${isMe ? 'text-white/85' : 'text-slate-500'}`}>
            <Mic className="h-2.5 w-2.5" />
            {displayTime}
            {attachment?.sha256 && (
              <span title={`SHA-256: ${attachment.sha256.slice(0, 12)}...`}>
                <ShieldCheck className="h-3 w-3 text-[#00CEC9]" />
              </span>
            )}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cycleSpeed}
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold transition ${
                isMe
                  ? 'bg-white/20 text-white hover:bg-white/30'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {playbackRate}x
            </button>
            {downloadHref && (
              <a
                href={downloadHref}
                download={attachment?.file_name || 'nota-de-voz.wav'}
                title="Baixar áudio"
                className={`rounded-md p-0.5 transition ${
                  isMe ? 'text-white/80 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Download className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
