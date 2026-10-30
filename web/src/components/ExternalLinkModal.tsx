'use client';

import React from 'react';
import { ExternalLink, AlertTriangle, X, ShieldAlert } from 'lucide-react';

interface ExternalLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
}

export function ExternalLinkModal({ isOpen, onClose, url }: ExternalLinkModalProps) {
  if (!isOpen || !url) return null;

  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = url;
  }

  const handleProceed = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 flex flex-col space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h3 className="font-heading font-bold text-base text-ink-main leading-tight">
            Você está saindo do PORChat
          </h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            O link abaixo redireciona para um site externo à plataforma. Tenha cautela ao fornecer senhas ou dados confidenciais.
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200 break-all text-xs font-mono text-ink-main select-all">
          <span className="text-gray-400 block text-[10px] font-sans font-bold uppercase tracking-wider mb-0.5">
            Destino: {hostname}
          </span>
          <span className="text-brand-primary">{url}</span>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer"
          >
            Voltar ao Chat
          </button>
          <button
            type="button"
            onClick={handleProceed}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <span>Continuar</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
