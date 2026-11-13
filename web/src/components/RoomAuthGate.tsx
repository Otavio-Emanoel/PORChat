'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { AuthModal } from '@/components/AuthModal';
import type { User } from '@/lib/auth';

interface RoomAuthGateProps {
  isAuthModalOpen: boolean;
  authMode: 'login' | 'register';
  onOpenAuth: (mode: 'login' | 'register') => void;
  onCloseAuth: () => void;
  onAuthSuccess: (user: User) => void;
}

/**
 * Private authentication gate shown before entering a chat room when unauthenticated.
 */
export const RoomAuthGate: React.FC<RoomAuthGateProps> = ({
  isAuthModalOpen,
  authMode,
  onOpenAuth,
  onCloseAuth,
  onAuthSuccess,
}) => {
  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center p-4 font-body relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-56 bg-brand-primary" />
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-8 sm:p-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-brand-primary/10 flex items-center justify-center text-brand-primary mb-4 shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight">
            Acesso Privado ao PORChat
          </h1>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            Assim como no WhatsApp, todas as conversas e grupos são privados e restritos à sua conta. Entre com seu perfil para acessar.
          </p>

          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-brand-primary text-white font-bold text-sm hover:bg-brand-primary/90 transition-all shadow-xs cursor-pointer"
            >
              Entrar com Email & Senha
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-gray-100 text-ink-main font-bold text-sm hover:bg-gray-200 transition-all cursor-pointer"
            >
              Criar Nova Conta
            </button>
          </div>

          <div className="mt-6">
            <Link
              href="/"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors inline-flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar para a Página Inicial
            </Link>
          </div>
        </div>

        <div className="bg-gray-50 px-8 py-3.5 border-t border-gray-100 flex items-center justify-center gap-2 text-xs text-gray-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Suas conversas e grupos são 100% privados e nunca compartilhados publicamente.</span>
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={onCloseAuth}
        initialMode={authMode}
        onSuccess={onAuthSuccess}
      />
    </div>
  );
};
