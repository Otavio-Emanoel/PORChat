'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { AuthModal } from '@/components/AuthModal';
import { CreateRoomModal } from '@/components/CreateRoomModal';
import { getStoredUser, clearStoredSession, type User } from '@/lib/auth';
import {
  MessageSquare,
  Tv,
  Swords,
  Zap,
  Users,
  Sparkles,
  ArrowRight,
  Flame,
  Award,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Play,
  Copy,
  Check,
} from 'lucide-react';

interface RoomData {
  id: string;
  name: string;
  code: string;
  is_group: boolean;
}

export default function LandingPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Room Join State
  const [roomCode, setRoomCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Public Rooms
  const [rooms, setRooms] = useState<RoomData[]>([]);

  useEffect(() => {
    setCurrentUser(getStoredUser());

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
    fetch(`${apiBase}/api/rooms`)
      .then((res) => res.json())
      .then((data: RoomData[]) => setRooms(data))
      .catch((err) => console.error('Erro ao buscar salas:', err));
  }, []);

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleLogout = () => {
    clearStoredSession();
    setCurrentUser(null);
  };

  const handleJoinByCode = async (target: 'chat' | 'tv') => {
    if (!roomCode.trim()) {
      setJoinError('Digite o código da sala (ex: POR-1000)');
      return;
    }

    setJoinError(null);
    setJoinLoading(true);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
      const clean = roomCode.trim().toUpperCase();
      const res = await fetch(`${apiBase}/api/rooms/code/${clean}`);
      if (!res.ok) {
        throw new Error('Nenhuma sala encontrada com este código.');
      }
      const room: RoomData = await res.json();
      if (target === 'tv') {
        router.push(`/tv/${room.id}`);
      } else {
        router.push(`/room/${room.id}`);
      }
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : 'Código inválido');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-light text-ink-main font-body selection:bg-brand-primary selection:text-white flex flex-col justify-between">
      {/* Navigation */}
      <Navbar
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onOpenCreateRoom={() => setCreateModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        {/* Playful Background Elements */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-brand-action/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-1/3 w-64 h-64 bg-brand-reward/15 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Feature Badges */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-bold mb-6 border border-brand-primary/15 shadow-xs">
              <Sparkles className="w-4 h-4 text-brand-primary" />
              <span>O Novo Ecossistema Social de Conversas & Party Games</span>
            </div>

            {/* Headline */}
            <h1 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-ink-main leading-[1.08] mb-6">
              Onde a conversa vira <span className="text-brand-primary">jogo</span> e a festa ganha um <span className="text-brand-action">telão</span>.
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-lg text-ink-muted leading-relaxed mb-10 max-w-2xl mx-auto font-medium">
              Bata papo em tempo real com seu grupo e ative disputas de argumentos no <strong>Tribunal</strong> ou <strong>Quizzes Relâmpago</strong> com pontuação por agilidade. Use o celular como controle e qualquer TV como palco.
            </p>

            {/* Interactive Party Launcher Card */}
            <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 text-left transition-all">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Entrar Direto em uma Sala
                </span>
                <span className="text-xs text-brand-primary font-bold">
                  Código de 4 a 8 dígitos
                </span>
              </div>

              {joinError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
                  {joinError}
                </div>
              )}

              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="Digite o código (ex: POR-1000)"
                    className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-ink-main font-mono text-base uppercase tracking-wider placeholder:text-gray-400 placeholder:normal-case placeholder:font-body focus:bg-white focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleJoinByCode('chat')}
                    disabled={joinLoading}
                    className="py-3.5 px-5 rounded-2xl bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-sm shadow-md tactile-btn transition-all flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Entrar no Chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleJoinByCode('tv')}
                    disabled={joinLoading}
                    className="py-3.5 px-5 rounded-2xl bg-surface-tv hover:bg-surface-tv/90 text-white font-bold text-sm shadow-md tactile-btn transition-all flex items-center justify-center gap-2"
                  >
                    <Tv className="w-4 h-4 text-brand-reward" />
                    <span>Abrir no Telão (TV)</span>
                  </button>
                </div>
              </div>

              {/* Quick links to seed rooms */}
              <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span className="font-semibold">Salas de Demonstração:</span>
                <div className="flex flex-wrap gap-2">
                  {rooms.slice(0, 3).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => router.push(`/room/${r.id}`)}
                      className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-brand-primary/10 hover:text-brand-primary font-mono font-bold transition-colors"
                    >
                      {r.code}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="como-funciona" className="py-16 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block mb-2">
              Fluxo Intuitivo
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-ink-main">
              Como funciona o PORChat?
            </h2>
            <p className="text-sm text-ink-muted mt-2">
              Criado para noites de jogos entre amigos, sem atrito e sem necessidade de downloads complicados.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="p-8 rounded-3xl bg-surface-light border border-gray-100 relative group hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-brand-primary text-white font-heading font-bold text-xl flex items-center justify-center mb-6 shadow-sm">
                1
              </div>
              <h3 className="font-heading text-xl font-bold text-ink-main mb-2">
                Crie ou Entre numa Sala
              </h3>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                Compartilhe o código de 4 a 8 caracteres ou o link direto com a galera. O chat fica salvo e funciona antes, durante e após as partidas.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-8 rounded-3xl bg-surface-light border border-gray-100 relative group hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-brand-action text-white font-heading font-bold text-xl flex items-center justify-center mb-6 shadow-sm">
                2
              </div>
              <h3 className="font-heading text-xl font-bold text-ink-main mb-2">
                Conecte o Telão (Modo TV)
              </h3>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                Abra a URL do Telão na Smart TV, projetor ou notebook. Ele exibe cronômetros precisos do servidor Go, os argumentos ao vivo e o placar em pódio 3D.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-8 rounded-3xl bg-surface-light border border-gray-100 relative group hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-brand-mint text-white font-heading font-bold text-xl flex items-center justify-center mb-6 shadow-sm">
                3
              </div>
              <h3 className="font-heading text-xl font-bold text-ink-main mb-2">
                Jogue pelo Celular
              </h3>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                Quando um jogo inicia, o chat se transforma instantaneamente num controle tátil: vote com botões gigantes, responda perguntas e solte reações de emojis!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Game Modes Showcase */}
      <section id="modos-de-jogo" className="py-20 bg-surface-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-brand-action uppercase tracking-wider block mb-2">
              Diversão Garantida
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-ink-main">
              Modos de Jogo Síncronos
            </h2>
            <p className="text-sm text-ink-muted mt-2">
              Partidas rápidas orquestradas por uma Máquina de Estados Finita (FSM) de alta fidelidade no Go.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Mode 1: Debate Court */}
            <div className="p-8 sm:p-10 rounded-3xl bg-white border border-gray-100 shadow-md flex flex-col justify-between hover:border-brand-action/40 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-action/10 text-brand-action font-bold text-xs">
                    <Swords className="w-3.5 h-3.5" />
                    <span>Modo 1</span>
                  </div>
                  <span className="text-xs font-bold text-gray-400">2 a 50 jogadores</span>
                </div>
                <h3 className="font-heading text-2xl sm:text-3xl font-bold text-ink-main mb-3">
                  O Tribunal do Debate
                </h3>
                <p className="text-sm text-ink-muted leading-relaxed mb-6">
                  Dois membros da sala são intimados para o palco para defender posições opostas em temas hilários (ex: "Abacaxi na pizza é crime ou arte?"). O restante da sala atua como Júri Popular com contagem regressiva e votação instantânea.
                </p>

                {/* Visual Preview Pills */}
                <div className="grid grid-cols-2 gap-3 mb-6 p-4 rounded-2xl bg-gray-50 border border-gray-100 text-xs font-bold text-center">
                  <div className="p-2.5 rounded-xl bg-brand-action text-white">
                    Lado A: Coral (Argumento)
                  </div>
                  <div className="p-2.5 rounded-xl bg-brand-mint text-white">
                    Lado B: Mint (Réplica)
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const target = rooms[1]?.id || rooms[0]?.id;
                  if (target) router.push(`/room/${target}`);
                }}
                className="w-full py-3.5 rounded-2xl bg-brand-action hover:bg-brand-action/90 text-white font-bold text-sm shadow-md tactile-btn transition-all flex items-center justify-center gap-2"
              >
                <span>Experimentar no Tribunal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Mode 2: Quick Trivia */}
            <div className="p-8 sm:p-10 rounded-3xl bg-white border border-gray-100 shadow-md flex flex-col justify-between hover:border-brand-primary/40 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary font-bold text-xs">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Modo 2</span>
                  </div>
                  <span className="text-xs font-bold text-gray-400">Pontuação por Agilidade</span>
                </div>
                <h3 className="font-heading text-2xl sm:text-3xl font-bold text-ink-main mb-3">
                  Quiz Relâmpago
                </h3>
                <p className="text-sm text-ink-muted leading-relaxed mb-6">
                  Perguntas de conhecimentos gerais e cultura pop transmitidas no telão. Quanto mais rápido você clicar no botão correto no celular, mais pontos você acumula na tabela de líderes!
                </p>

                {/* 4 Colored Quiz Buttons Preview */}
                <div className="grid grid-cols-4 gap-2 mb-6 p-4 rounded-2xl bg-gray-50 border border-gray-100 text-xs font-heading font-bold text-center text-white">
                  <div className="py-2.5 rounded-xl bg-[#FF6B6B]">▲ A</div>
                  <div className="py-2.5 rounded-xl bg-[#48DBFB]">◆ B</div>
                  <div className="py-2.5 rounded-xl bg-[#FECA57]">● C</div>
                  <div className="py-2.5 rounded-xl bg-[#1DD1A1]">■ D</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const target = rooms[2]?.id || rooms[0]?.id;
                  if (target) router.push(`/room/${target}`);
                }}
                className="w-full py-3.5 rounded-2xl bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-sm shadow-md tactile-btn transition-all flex items-center justify-center gap-2"
              >
                <span>Jogar Quiz na Arena</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Active Public Rooms Section */}
      <section id="salas-ativas" className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-4">
            <div>
              <span className="text-xs font-bold text-brand-mint uppercase tracking-wider block">
                Comunidade
              </span>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ink-main">
                Salas Públicas Ativas
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold shadow-sm hover:bg-brand-primary/90 transition-all tactile-btn flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Criar Nova Sala</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="p-6 rounded-3xl bg-surface-light border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-lg bg-brand-primary/10 text-brand-primary text-xs font-mono font-bold">
                      {room.code}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-brand-mint font-semibold">
                      <span className="w-2 h-2 rounded-full bg-brand-mint animate-pulse" />
                      Aberta
                    </span>
                  </div>
                  <h3 className="font-heading text-lg font-bold text-ink-main mb-1">
                    {room.name}
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Mini-jogos e chat sincronizado em tempo real.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => router.push(`/room/${room.id}`)}
                    className="py-2.5 px-3 rounded-xl bg-white hover:bg-brand-primary hover:text-white border border-gray-200 text-ink-main text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Entrar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/tv/${room.id}`)}
                    className="py-2.5 px-3 rounded-xl bg-surface-tv hover:bg-surface-tv/90 text-white text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Tv className="w-3.5 h-3.5 text-brand-reward" />
                    <span>Telão</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-tv text-white py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-gray-400">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-primary flex items-center justify-center text-white font-heading font-bold text-lg">
              P
            </div>
            <div>
              <div className="font-heading font-bold text-sm text-white">PORChat Ecosystem</div>
              <div>Pedro, Otavio & Raul Chat & Party Games</div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <a href="#como-funciona" className="hover:text-white transition-colors">Como Funciona</a>
            <a href="#modos-de-jogo" className="hover:text-white transition-colors">Modos de Jogo</a>
            <Link href="/tv" className="hover:text-white transition-colors">Telão TV</Link>
          </div>

          <div className="text-center sm:text-right">
            <span>Server-Authoritative Go Engine & Next.js Client</span>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
        onSuccess={(user) => {
          setCurrentUser(user);
        }}
      />

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        currentUserNickname={currentUser?.nickname}
      />
    </div>
  );
}
