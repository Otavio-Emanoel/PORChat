'use client';

import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { loginWithCredentials, registerWithCredentials, loginDemoUser, type User } from '@/lib/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  initialMode?: 'login' | 'register';
}

export function AuthModal({ isOpen, onClose, onSuccess, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await loginWithCredentials(email, password);
        onSuccess(res.user);
        onClose();
      } else {
        if (!nickname.trim()) {
          throw new Error('Informe um apelido');
        }
        const res = await registerWithCredentials(nickname.trim(), email, password);
        onSuccess(res.user);
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (profile: 'Otavio' | 'Pedro' | 'Raul') => {
    setError(null);
    setLoading(true);
    try {
      const res = await loginDemoUser(profile);
      onSuccess(res.user);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha no login demo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden font-body">
        {/* Top Gradient Banner */}
        <div className="h-3 bg-gradient-to-r from-brand-primary via-brand-action to-brand-reward" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Fechar modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-primary/10 text-brand-primary mb-3">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 className="font-heading text-2xl text-ink-main tracking-tight">
              {mode === 'login' ? 'Bem-vindo ao PORChat' : 'Crie sua Conta'}
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              {mode === 'login'
                ? 'Conecte-se para bater papo, votar no Tribunal e jogar Quiz'
                : 'Junte-se à festa em menos de 30 segundos'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'login' ? 'bg-white text-ink-main shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'register' ? 'bg-white text-ink-main shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Cadastrar
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Como quer ser chamado?</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Seu Apelido ou Nome"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl font-bold text-sm shadow-md tactile-btn transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {mode === 'login' ? 'Entrar no PORChat' : 'Criar Minha Conta'}
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center mb-3">
              Demonstração Rápida (1-Clique)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(['Otavio', 'Pedro', 'Raul'] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleQuickDemo(name)}
                  disabled={loading}
                  className="p-2 rounded-xl bg-gray-50 hover:bg-brand-primary/10 hover:text-brand-primary border border-gray-100 text-xs font-bold text-ink-main transition-all text-center flex flex-col items-center gap-1 group"
                >
                  <span className="w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary text-[10px] flex items-center justify-center group-hover:bg-brand-primary group-hover:text-white transition-colors">
                    {name[0]}
                  </span>
                  <span>{name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
