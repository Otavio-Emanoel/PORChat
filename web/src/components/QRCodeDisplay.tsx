'use client';

import React from 'react';
import { QrCode, Smartphone, ExternalLink } from 'lucide-react';

interface QRCodeDisplayProps {
  roomCode: string;
  url: string;
  size?: number;
}

export function QRCodeDisplay({ roomCode, url, size = 180 }: QRCodeDisplayProps) {
  // Use Google Chart API or QR server for 100% reliable crisp QR generation without heavy node packages
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    url
  )}&bgcolor=FFFFFF&color=1E1E2E&margin=2`;

  return (
    <div className="flex flex-col items-center justify-center p-5 rounded-3xl bg-white text-ink-main shadow-2xl border-4 border-brand-reward/40 max-w-[240px] text-center animate-pop-in">
      {/* QR Code Container */}
      <div className="relative rounded-2xl overflow-hidden p-2 bg-white shadow-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrImageUrl}
          alt={`QR Code para entrar na sala ${roomCode}`}
          width={size}
          height={size}
          className="rounded-xl"
        />
      </div>

      {/* Room PIN pill */}
      <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-tv text-white font-mono font-black text-sm tracking-wider shadow-xs">
        <Smartphone className="w-3.5 h-3.5 text-brand-reward" />
        <span>{roomCode}</span>
      </div>

      <span className="text-[10px] text-gray-500 font-medium mt-1.5 leading-tight">
        Aponte a câmera do celular para entrar direto!
      </span>
    </div>
  );
}
