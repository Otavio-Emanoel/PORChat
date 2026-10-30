'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { AuthModal } from '@/components/AuthModal';
import { CreateRoomModal } from '@/components/CreateRoomModal';
import { getStoredUser, clearStoredSession, loginDemoUser, type User } from '@/lib/auth';
import {
  MessageSquare,
  Tv,
  Swords,
  Zap,
  Users,
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

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleLogout = () => {
    clearStoredSession();
    setCurrentUser(null);
  };

  const handleQuickLogin = async (profile: 'Otavio' | 'Pedro' | 'Raul') => {
    try {
      const res = await loginDemoUser(profile);
      setCurrentUser(res.user);
      router.push('/room/default');
    } catch (e) {
      console.error('Falha no login rápido:', e);
    }
  };

  const handleJoinByCode = async (target: 'chat' | 'tv') => {
    if (!roomCode.trim()) {
      setJoinError('Digite o código do grupo (ex: POR-1000)');
      return;
    }

    setJoinError(null);
    setJoinLoading(true);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
      const clean = roomCode.trim().toUpperCase();

      if (target === 'tv') {
        const res = await fetch(`${apiBase}/api/rooms/code/${clean}`);
        if (!res.ok) throw new Error('Nenhum grupo encontrado com este código.');
        const room: RoomData = await res.json();
        router.push(`/tv/${room.id}`);
        return;
      }

      const user = currentUser || getStoredUser();
      if (!user) {
        setJoinError('Faça login com sua conta para entrar no grupo.');
        handleOpenAuth('login');
        return;
      }

      const res = await fetch(`${apiBase}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: clean, user: user.nickname }),
      });
      if (!res.ok) {
        throw new Error('Nenhum grupo encontrado com este código.');
      }
      const room: RoomData = await res.json();
      router.push(`/room/${room.id}`);
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Feature Badges */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-6 border border-emerald-200/60 shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Comunicação Privada & Party Games em Tempo Real</span>
            </div>

            {/* Headline */}
            <h1 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-ink-main leading-[1.08] mb-6">
              Onde a conversa vira <span className="text-brand-primary">jogo</span> e a festa ganha um <span className="text-brand-action">telão</span>.
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-lg text-ink-muted leading-relaxed mb-10 max-w-2xl mx-auto font-medium">
              Bata papo em tempo real com seu grupo e ative disputas de argumentos no <strong>Tribunal</strong> ou <strong>Quizzes Relâmpago</strong> com pontuação por agilidade. Use o celular como controle e qualquer TV como palco.
            </p>

            {/* Interactive WhatsApp Private Portal Card */}
            <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 text-left transition-all">
              {currentUser ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-brand-primary/10 border border-brand-primary/20">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-brand-primary text-white font-heading font-bold text-lg flex items-center justify-center shadow-xs">
                        {currentUser.nickname.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-ink-main">{currentUser.nickname}</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                            Online
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 font-mono">{currentUser.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="text-xs text-red-500 hover:underline font-semibold cursor-pointer"
                    >
                      Trocar Conta
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push('/room/default')}
                    className="w-full py-4 px-6 rounded-2xl bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-base shadow-lg tactile-btn transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span>Abrir Minhas Conversas Privadas</span>
                  </button>

                  <div className="pt-3 border-t border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                      Ou entrar em um grupo pelo código de convite:
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        placeholder="Ex: POR-1000"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-ink-main font-mono text-sm uppercase outline-none focus:border-brand-primary"
                      />
                      <button
                        onClick={() => handleJoinByCode('chat')}
                        disabled={joinLoading}
                        className="px-4 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-xs shadow-xs cursor-pointer"
                      >
                        Participar
                      </button>
                      <button
                        onClick={() => handleJoinByCode('tv')}
                        disabled={joinLoading}
                        className="px-4 py-2.5 rounded-xl bg-surface-tv hover:bg-surface-tv/90 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Tv className="w-3.5 h-3.5 text-brand-reward" />
                        <span>Telão</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center sm:text-left mb-2">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">
                      <ShieldCheck className="w-4 h-4" />
                      <span>100% Privado — Modelo WhatsApp</span>
                    </div>
                    <h3 className="font-heading text-xl font-bold text-ink-main">
                      Acesse com sua Conta
                    </h3>
                    <p className="text-xs text-ink-muted">
                      Para sua privacidade, todas as conversas e grupos são restritos exclusivamente aos seus participantes.
                    </p>
                  </div>

                  {joinError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
                      {joinError}
                    </div>
                  )}

                  {/* 1-Click Fast Profile Switcher */}
                  <div>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                      Perfis de Demonstração (1 Clique):
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickLogin('Otavio')}
                        className="p-3 rounded-2xl bg-purple-50/70 hover:bg-purple-100/70 border border-purple-200/60 text-left transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-xl bg-brand-primary text-white font-heading font-bold text-xs flex items-center justify-center mb-1.5 shadow-2xs group-hover:scale-105 transition-transform">
                          OE
                        </div>
                        <div className="font-bold text-xs text-purple-900">Otavio</div>
                        <div className="text-[10px] text-purple-600 truncate">otavio@porchat.com</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickLogin('Pedro')}
                        className="p-3 rounded-2xl bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200/60 text-left transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-xl bg-brand-action text-white font-heading font-bold text-xs flex items-center justify-center mb-1.5 shadow-2xs group-hover:scale-105 transition-transform">
                          PR
                        </div>
                        <div className="font-bold text-xs text-rose-900">Pedro</div>
                        <div className="text-[10px] text-rose-600 truncate">pedro@porchat.com</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickLogin('Raul')}
                        className="p-3 rounded-2xl bg-teal-50/70 hover:bg-teal-100/70 border border-teal-200/60 text-left transition-all hover:scale-[1.02] shadow-2xs group cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-xl bg-brand-mint text-white font-heading font-bold text-xs flex items-center justify-center mb-1.5 shadow-2xs group-hover:scale-105 transition-transform">
                          RL
                        </div>
                        <div className="font-bold text-xs text-teal-900">Raul</div>
                        <div className="text-[10px] text-teal-600 truncate">raul@porchat.com</div>
                      </button>
                    </div>
                  </div>

                  {/* Standard Login Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => handleOpenAuth('login')}
                      className="py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-ink-main font-bold text-xs transition-colors text-center"
                    >
                      Entrar com Email
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenAuth('register')}
                      className="py-3 px-4 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-xs shadow-xs transition-colors text-center"
                    >
                      Criar Nova Conta
                    </button>
                  </div>

                  {/* Group code option */}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        placeholder="Código de grupo ou Telão..."
                        className="flex-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-mono uppercase"
                      />
                      <button
                        onClick={() => handleJoinByCode('chat')}
                        className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-ink-main font-bold text-xs"
                      >
                        Entrar
                      </button>
                      <button
                        onClick={() => handleJoinByCode('tv')}
                        className="px-3 py-2 rounded-xl bg-surface-tv text-white font-bold text-xs flex items-center gap-1"
                      >
                        <Tv className="w-3 h-3 text-brand-reward" />
                        <span>Telão</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                  const user = currentUser || getStoredUser();
                  if (user) {
                    router.push('/room/default');
                  } else {
                    handleOpenAuth('login');
                  }
                }}
                className="w-full py-3.5 rounded-2xl bg-brand-action hover:bg-brand-action/90 text-white font-bold text-sm shadow-md tactile-btn transition-all flex items-center justify-center gap-2 cursor-pointer"
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
                  const user = currentUser || getStoredUser();
                  if (user) {
                    router.push('/room/default');
                  } else {
                    handleOpenAuth('login');
                  }
                }}
                className="w-full py-3.5 rounded-2xl bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-sm shadow-md tactile-btn transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Jogar Quiz na Arena</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy & Security Model Section */}
      <section id="privacidade-seguranca" className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-brand-mint uppercase tracking-wider block mb-2">
              Privacidade em Primeiro Lugar
            </span>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ink-main">
              Conversas 100% Privadas Como no WhatsApp
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              No PORChat não existem salas públicas abertas a desconhecidos. Cada conversa particular e grupo pertence exclusivamente aos seus participantes autorizados.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-3xl bg-surface-light border border-gray-100 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center text-2xl mb-4">
                  💬
                </div>
                <h3 className="font-heading text-lg font-bold text-ink-main mb-2">
                  Conversas Diretas Particulares
                </h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Converse 1 a 1 de forma segura. Apenas você e seu contato têm acesso às mensagens trocadas, com histórico sincronizado em tempo real.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-brand-primary">
                <ShieldCheck className="w-4 h-4" /> Isolamento Total de Conversas
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-surface-light border border-gray-100 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-brand-action/10 text-brand-action flex items-center justify-center text-2xl mb-4">
                  👥
                </div>
                <h3 className="font-heading text-lg font-bold text-ink-main mb-2">
                  Grupos Fechados com Código
                </h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Crie grupos com seus amigos e compartilhe o código PIN de convite. Somente membros autorizados entram e participam dos debates e quizzes.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-brand-action">
                <CheckCircle2 className="w-4 h-4" /> Convites por PIN Exclusivo
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-surface-light border border-gray-100 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-brand-mint/10 text-brand-mint flex items-center justify-center text-2xl mb-4">
                  📺
                </div>
                <h3 className="font-heading text-lg font-bold text-ink-main mb-2">
                  Modo Telão Sincronizado
                </h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Abra o telão na sua Smart TV ou projetor enquanto cada participante interage com controles táteis e reações ao vivo pelo smartphone.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-brand-mint">
                <Tv className="w-4 h-4" /> Experiência Second-Screen
              </div>
            </div>
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

          <div className="flex items-center gap-2 text-center sm:text-right">
            <span className="w-2 h-2 rounded-full bg-brand-mint animate-pulse" />
            <span className="font-mono text-white/70">v2.4 Pro • Pedro, Otávio & Raul</span>
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
