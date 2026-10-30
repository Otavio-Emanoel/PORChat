'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tv, ArrowRight, Play, ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { getStoredUser, getStoredToken } from '@/lib/auth';

interface RoomData {
  id: string;
  name: string;
  code: string;
}

export default function TVLobbyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [userRooms, setUserRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${apiBase}/api/rooms?user=${encodeURIComponent(user.nickname)}`, { headers })
      .then((res) => {
        if (!res.ok) return [];
        return res.json();
      })
      .then((data: RoomData[]) => {
        if (Array.isArray(data)) {
          setUserRooms(data);
        }
      })
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
        throw new Error('Nenhum grupo encontrado com este código.');
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
      {/* Header */}
      <header className="flex items-center justify-between z-10">
        <Link
          href="/"
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Voltar para o Início</span>
        </Link>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-xs font-bold text-brand-reward border border-white/10">
          <Tv className="w-4 h-4" />
          <span>PORChat Palco TV</span>
        </div>
      </header>

      {/* Center Stage Box */}
      <main className="max-w-xl mx-auto w-full text-center z-10 my-auto py-8">
        <div className="w-16 h-16 rounded-2xl bg-brand-primary/20 text-brand-reward flex items-center justify-center mx-auto mb-6 shadow-xl border border-white/10">
          <Tv className="w-8 h-8" />
        </div>

        <h1 className="font-heading text-4xl sm:text-5xl font-extrabold tracking-tight mb-3">
          Conectar Telão
        </h1>
        <p className="text-sm sm:text-base text-gray-400 mb-8 max-w-md mx-auto">
          Digite o código PIN do grupo para projetar a rodada de debate ou quiz na Smart TV.
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
            className="px-6 py-4 rounded-2xl bg-brand-action hover:bg-brand-action/90 text-white font-heading font-bold text-base shadow-lg transition-all tactile-btn flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Conectar</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* User's Authorized Groups */}
        {userRooms.length > 0 && (
          <div className="max-w-md mx-auto text-left">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block text-center mb-3">
              Seus Grupos Conectados:
            </span>
            <div className="space-y-2">
              {userRooms.map((r) => (
                <button
                  key={r.id}
                  onClick={() => router.push(`/tv/${r.id}`)}
                  className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between transition-all group cursor-pointer"
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
      <footer className="text-center text-xs text-gray-500 z-10 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>PORChat TV Stage • Exclusivo para membros e participantes autorizados</span>
      </footer>
    </div>
  );
}
