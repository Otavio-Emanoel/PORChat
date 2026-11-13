'use client';

import React from 'react';

interface SessionTerminatedModalProps {
  notice: string | null;
  onRelogin: () => void;
}

/**
 * Alert modal displayed when the server terminates an older WebSocket session.
 */
export const SessionTerminatedModal: React.FC<SessionTerminatedModalProps> = ({
  notice,
  onRelogin,
}) => {
  if (!notice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="w-14 h-14 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-black text-ink-main mb-2">Sessão Encerrada</h3>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">{notice}</p>
        <button
          onClick={onRelogin}
          className="w-full py-3 px-4 bg-brand-primary text-white font-bold rounded-2xl shadow-md hover:bg-brand-primary/90 transition"
        >
          Fazer Login Novamente
        </button>
      </div>
    </div>
  );
};
