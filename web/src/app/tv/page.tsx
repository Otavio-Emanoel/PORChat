'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tv, Sparkles, ArrowRight, Play, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface RoomData {
  id: string;
  name: string;
  code: string;
}

export default function TVLobbyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
    fetch(`${apiBase}/api/rooms`)
      .then((res) => res.json())
      .then((data) => setRooms(data))
      .catch((err) => console.error(err));
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
      const clean = code.trim().toUpperCase();
      const res = await fetch(`${apiBase}/api/rooms/code/${clean}`);
      if (!res.ok) {
        throw new Error('Nenhuma sala encontrada com este código.');
      }
      const room = await res.json();
      router.push(`/tv/${room.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Código inválido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-tv text-white flex flex-col justify-between font-body p-6 sm:p-12 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-brand-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-brand-action/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between z-10">
        <Link
          href="/"
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Voltar para o Início</span>
        </Link>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-xs font-bold text-brand-reward">
          <Tv className="w-4 h-4" />
          <span>PORChat TV Mode Stage</span>
        </div>
      </header>

      {/* Center Stage Box */}
      <main className="max-w-xl mx-auto w-full text-center z-10 my-auto py-12">
        <div className="w-20 h-20 rounded-3xl bg-brand-primary/20 text-brand-reward flex items-center justify-center mx-auto mb-6 shadow-xl border border-white/10">
          <Tv className="w-10 h-10" />
        </div>

        <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight mb-3">
          Conectar Telão
        </h1>
        <p className="text-sm sm:text-base text-gray-400 mb-8 max-w-md mx-auto">
          Digite o código da sala de 4 a 8 dígitos para projetar o palco do jogo na TV ou telão.
        </p>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs max-w-md mx-auto">
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-10">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex: POR-1000"
            className="flex-1 px-5 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-mono text-center sm:text-left text-lg uppercase tracking-widest placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all"
          />
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="px-6 py-4 rounded-2xl bg-brand-action hover:bg-brand-action/90 text-white font-heading font-bold text-base shadow-lg transition-all tactile-btn flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Entrar</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Quick Room Selectors */}
        {rooms.length > 0 && (
          <div className="max-w-md mx-auto text-left">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block text-center mb-3">
              Ou escolha uma sala pública ativa:
            </span>
            <div className="space-y-2">
              {rooms.map((r) => (
                <button
                  key={r.id}
                  onClick={() => router.push(`/tv/${r.id}`)}
                  className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-primary/20 text-brand-primary flex items-center justify-center font-heading font-bold text-xs group-hover:bg-brand-primary group-hover:text-white transition-colors">
                      <Play className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{r.name}</div>
                      <div className="text-xs font-mono text-gray-400">{r.code}</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-brand-mint group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Abrir Telão →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-600 z-10">
        PORChat TV Stage • Desenvolvido para telas grandes, projetores e TVs inteligentes
      </footer>
    </div>
  );
}
