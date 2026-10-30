'use client';

import React from 'react';
import Link from 'next/link';
import { Tv, LogIn, LogOut, PlusCircle, ShieldCheck } from 'lucide-react';
import type { User } from '@/lib/auth';

interface NavbarProps {
  currentUser: User | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenCreateRoom: () => void;
  onLogout: () => void;
}

export function Navbar({ currentUser, onOpenAuth, onOpenCreateRoom, onLogout }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-gray-200/80 font-body transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-2xl bg-brand-primary flex items-center justify-center text-white font-heading font-bold text-xl shadow-xs group-hover:scale-105 transition-transform">
            P
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-xl font-bold tracking-tight text-ink-main leading-none">
                PORChat
              </span>
              <span className="px-2 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary font-bold text-[10px] tracking-wide uppercase">
                Privado
              </span>
            </div>
            <span className="text-[11px] text-ink-muted block mt-0.5 font-medium">
              Pedro, Otavio & Raul Ecosystem
            </span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-7">
          <a
            href="#como-funciona"
            className="text-xs font-bold text-ink-muted hover:text-brand-primary transition-colors uppercase tracking-wider"
          >
            Como Funciona
          </a>
          <a
            href="#modos-de-jogo"
            className="text-xs font-bold text-ink-muted hover:text-brand-primary transition-colors uppercase tracking-wider"
          >
            Modos de Jogo
          </a>
          <a
            href="#privacidade-seguranca"
            className="text-xs font-bold text-ink-muted hover:text-brand-primary transition-colors uppercase tracking-wider flex items-center gap-1"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Privacidade</span>
          </a>
          <Link
            href="/tv"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-tv text-white text-xs font-bold hover:bg-surface-tv/90 shadow-2xs transition-all tactile-btn"
          >
            <Tv className="w-3.5 h-3.5 text-brand-reward" />
            <span>Abrir Telão (TV)</span>
          </Link>
        </nav>

        {/* Right Action Area */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenCreateRoom}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold shadow-xs hover:bg-brand-primary/90 transition-all tactile-btn cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Grupo</span>
          </button>

          {currentUser ? (
            <div className="flex items-center gap-3 pl-2 border-l border-gray-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-reward/30 text-brand-primary font-heading font-bold text-sm flex items-center justify-center border border-brand-reward/40">
                  {currentUser.nickname.slice(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-xs font-bold text-ink-main">{currentUser.nickname}</div>
                  <div className="text-[10px] text-brand-mint font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-mint" />
                    Online
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Sair da Conta"
                className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="px-4 py-2 rounded-xl border border-gray-200 text-ink-main hover:border-brand-primary hover:text-brand-primary text-sm font-bold transition-all bg-white"
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="hidden sm:inline-flex px-4 py-2 rounded-xl bg-brand-action text-white text-sm font-bold shadow-sm hover:bg-brand-action/90 transition-all tactile-btn"
              >
                Cadastrar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
