'use client';

import React, { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserNickname?: string;
}

export function CreateRoomModal({ isOpen, onClose, currentUserNickname }: CreateRoomModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
      const res = await fetch(`${apiBase}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase() || undefined,
          created_by: currentUserNickname || 'Anônimo',
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao criar sala');
      }

      const room = await res.json();
      onClose();
      router.push(`/room/${room.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar sala');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden font-body">
        <div className="h-3 bg-gradient-to-r from-brand-mint via-brand-primary to-brand-action" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Fechar modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary mb-3">
              <Plus className="w-6 h-6" />
            </div>
            <h2 className="font-heading text-2xl text-ink-main tracking-tight">
              Criar Nova Sala
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              Crie um espaço exclusivo para você e seus amigos conversarem e jogarem
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Nome da Sala</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Sexta dos Cria, Arena dos Nerds..."
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Código Personalizado <span className="text-gray-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ex: AMIGOS-10"
                maxLength={10}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none uppercase font-mono tracking-wider transition-all"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Se deixar em branco, geraremos um código automático (ex: POR-4821).
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full mt-2 py-3 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl font-bold text-sm shadow-md tactile-btn transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Criar Sala e Entrar
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
