'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWebSocket } from '@/lib/useWebSocket';
import { getStoredUser, clearStoredSession, type User } from '@/lib/auth';
import { CreateGroupModal } from '@/components/CreateGroupModal';
import {
  MessageSquare,
  Tv,
  Send,
  Users,
  Swords,
  Zap,
  ArrowLeft,
  Copy,
  Check,
  LogOut,
  Plus,
  Search,
  UserCheck,
  User as UserIcon,
} from 'lucide-react';
import Link from 'next/link';

interface RoomData {
  id: string;
  name: string;
  code: string;
  is_group: boolean;
  members?: string[];
  created_by?: string;
}

interface Contact {
  id: string;
  nickname: string;
  email: string;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState('');
  const [inputText, setInputText] = useState('');
  const [roomInfo, setRoomInfo] = useState<RoomData | null>(null);
  const [allRooms, setAllRooms] = useState<RoomData[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'groups' | 'direct' | 'contacts'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize User
  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setCurrentUser(user);
      setNickname(user.nickname);
    } else {
      let guestNick = sessionStorage.getItem('porchat_guest_nick');
      if (!guestNick) {
        guestNick = 'Visitante_' + Math.floor(100 + Math.random() * 900);
        sessionStorage.setItem('porchat_guest_nick', guestNick);
      }
      setNickname(guestNick);
    }
  }, []);

  // Fetch Rooms & Contacts
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

    // Fetch rooms
    fetch(`${apiBase}/api/rooms`)
      .then((res) => res.json())
      .then((data: RoomData[]) => {
        setAllRooms(data);
        const current = data.find((r) => r.id === roomId);
        if (current) setRoomInfo(current);
      })
      .catch((err) => console.error('Erro ao buscar salas:', err));

    // Fetch contacts
    fetch(`${apiBase}/api/users`)
      .then((res) => res.json())
      .then((data: Contact[]) => setContacts(data))
      .catch((err) => console.error('Erro ao buscar contatos:', err));
  }, [roomId]);

  const { isConnected, messages, onlineUsers, gameState, sendMessage, sendAction } = useWebSocket({
    roomId,
    nickname,
    clientType: 'web',
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText.trim());
    setInputText('');
  };

  const handleStartDebate = () => {
    sendAction('game:start', {
      game_type: 'debate',
      topic: 'Abacaxi na pizza é crime ou alta gastronomia?',
      debater_a_id: currentUser?.id || 'debater-a',
      debater_b_id: 'debater-b',
    });
  };

  const handleStartQuiz = () => {
    sendAction('game:start', {
      game_type: 'quiz',
    });
  };

  const handleCopyInvite = () => {
    const inviteText = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(inviteText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReaction = (emoji: string) => {
    sendAction('game:reaction', { emoji });
  };

  const handleVote = (choice: 'side_a' | 'side_b') => {
    sendAction('debate:vote', { choice });
  };

  const handleAnswerQuiz = (choice: 'A' | 'B' | 'C' | 'D') => {
    sendAction('quiz:answer', { choice, timestamp: Date.now() });
  };

  // Filtered rooms
  const filteredRooms = allRooms.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.code.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeTab === 'groups') return r.is_group;
    if (activeTab === 'direct') return !r.is_group;
    return true;
  });

  // Start 1-on-1 direct conversation with contact
  const handleStartDirectChat = async (contact: Contact) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
    try {
      // Check if room already exists
      const existing = allRooms.find(
        (r) => !r.is_group && (r.name === contact.nickname || r.members?.includes(contact.nickname))
      );
      if (existing) {
        router.push(`/room/${existing.id}`);
        return;
      }

      // Create new DM room
      const res = await fetch(`${apiBase}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contact.nickname,
          is_group: false,
          members: [nickname, contact.nickname],
          created_by: nickname,
        }),
      });
      const newRoom = await res.json();
      router.push(`/room/${newRoom.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-screen bg-[#F0F2F5] text-ink-main overflow-hidden font-body">
      {/* WhatsApp-Style Sidebar */}
      <aside className="w-88 sm:w-96 bg-white border-r border-gray-200 flex flex-col justify-between hidden md:flex shadow-xs select-none">
        <div className="flex flex-col h-full">
          {/* Top User Bar */}
          <div className="p-3.5 bg-[#F0F2F5] border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" title="Voltar ao Início" className="hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-white font-heading font-bold text-base shadow-xs">
                  {nickname.slice(0, 2).toUpperCase()}
                </div>
              </Link>
              <div className="leading-tight">
                <span className="text-sm font-bold text-ink-main block truncate max-w-[140px]">{nickname}</span>
                <span className="text-[11px] text-brand-mint font-semibold flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-brand-mint animate-pulse' : 'bg-red-400'}`} />
                  {isConnected ? 'Online' : 'Desconectado'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsCreateGroupOpen(true)}
                className="p-2 rounded-full hover:bg-gray-200 text-gray-600 hover:text-brand-primary transition-colors flex items-center gap-1 text-xs font-bold"
                title="Criar Novo Grupo"
              >
                <Plus className="w-5 h-5 text-brand-primary" />
                <span className="hidden lg:inline text-[11px]">Novo Grupo</span>
              </button>
              <Link
                href="/"
                className="p-2 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
                title="Voltar para a Página Inicial"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-2.5 bg-white border-b border-gray-100">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar conversas ou contatos..."
                className="w-full pl-9 pr-4 py-1.5 bg-[#F0F2F5] rounded-xl text-xs text-ink-main placeholder:text-gray-400 outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary transition-all"
              />
            </div>
          </div>

          {/* WhatsApp Tabs */}
          <div className="flex px-3 pt-2 pb-1 bg-white border-b border-gray-100 gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1.5 text-center rounded-lg transition-colors ${
                activeTab === 'all'
                  ? 'bg-brand-primary/10 text-brand-primary'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              className={`flex-1 py-1.5 text-center rounded-lg transition-colors ${
                activeTab === 'groups'
                  ? 'bg-brand-primary/10 text-brand-primary'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              Grupos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('direct')}
              className={`flex-1 py-1.5 text-center rounded-lg transition-colors ${
                activeTab === 'direct'
                  ? 'bg-brand-primary/10 text-brand-primary'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              Diretas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('contacts')}
              className={`flex-1 py-1.5 text-center rounded-lg transition-colors ${
                activeTab === 'contacts'
                  ? 'bg-brand-primary/10 text-brand-primary'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              Contatos
            </button>
          </div>

          {/* Conversations or Contacts List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {activeTab === 'contacts' ? (
              /* Contacts Tab List */
              <div className="p-2 space-y-1">
                <span className="px-3 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  Contatos Cadastrados
                </span>
                {contacts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-primary/15 text-brand-primary flex items-center justify-center font-bold text-sm">
                        {c.nickname[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-ink-main">{c.nickname}</div>
                        <div className="text-[11px] text-gray-400">{c.email}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStartDirectChat(c)}
                      className="px-3 py-1.5 rounded-xl bg-brand-primary text-white text-[11px] font-bold shadow-xs hover:bg-brand-primary/90 transition-all"
                    >
                      Conversar
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              /* Chats & Groups List */
              filteredRooms.map((room) => {
                const isActive = room.id === roomId;
                return (
                  <button
                    key={room.id}
                    onClick={() => router.push(`/room/${room.id}`)}
                    className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors border-l-4 ${
                      isActive
                        ? 'bg-[#EBEBF5] border-brand-primary'
                        : 'hover:bg-gray-50 border-transparent'
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-heading font-bold text-lg shrink-0 shadow-2xs ${
                        room.is_group ? 'bg-gradient-to-br from-brand-primary to-purple-800' : 'bg-brand-action'
                      }`}
                    >
                      {room.is_group ? <Users className="w-6 h-6" /> : room.name[0].toUpperCase()}
                    </div>

                    {/* Middle: Name & Last Message */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-sm text-ink-main truncate">{room.name}</span>
                        <span className="text-[10px] text-gray-400 font-mono shrink-0 ml-1">
                          {room.code}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="truncate">
                          {room.is_group ? 'Toque para conversar e jogar' : 'Conversa direta'}
                        </span>
                        {room.is_group && (
                          <span className="px-1.5 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary text-[9px] font-bold uppercase shrink-0">
                            Grupo
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Logout */}
        {currentUser && (
          <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Logado como <strong>{currentUser.nickname}</strong></span>
            <button
              onClick={() => {
                clearStoredSession();
                setCurrentUser(null);
                setNickname('Visitante_' + Math.floor(100 + Math.random() * 900));
              }}
              className="text-red-500 hover:underline font-bold text-[11px]"
            >
              Sair
            </button>
          </div>
        )}
      </aside>

      {/* Main Chat Conversation */}
      <main className="flex-1 flex flex-col h-full bg-[#EFEAE2] relative">
        {/* WhatsApp-Style Header */}
        <header className="h-16 px-4 bg-[#F0F2F5] border-b border-gray-200 flex items-center justify-between z-10 shadow-xs">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-heading font-bold text-base shadow-xs ${
                roomInfo?.is_group ? 'bg-gradient-to-br from-brand-primary to-purple-800' : 'bg-brand-action'
              }`}
            >
              {roomInfo?.is_group ? <Users className="w-5 h-5" /> : roomInfo?.name[0].toUpperCase() || 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-base font-bold text-ink-main tracking-tight leading-none">
                  {roomInfo?.name || 'Conversa'}
                </h2>
                {roomInfo?.code && (
                  <button
                    onClick={handleCopyInvite}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-600 text-[10px] font-mono font-bold hover:bg-gray-50 transition-all"
                    title="Copiar código de convite"
                  >
                    <span>{roomInfo.code}</span>
                    {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
              <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                <span>
                  {roomInfo?.is_group
                    ? `${onlineUsers.length} online • ${roomInfo?.members?.join(', ') || 'Pedro, Otavio, Raul'}`
                    : `${onlineUsers.length} participante online`}
                </span>
              </div>
            </div>
          </div>

          {/* Group Action Buttons (Dispute & TV Mode) */}
          <div className="flex items-center gap-2">
            {roomInfo?.is_group && (
              <>
                <button
                  type="button"
                  onClick={handleStartDebate}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-action text-white text-xs font-bold hover:bg-brand-action/90 shadow-xs tactile-btn transition-all"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Debate</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartQuiz}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 shadow-xs tactile-btn transition-all"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Quiz</span>
                </button>

                <Link
                  href={`/tv/${roomId}`}
                  target="_blank"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-tv text-white text-xs font-bold hover:bg-surface-tv/90 shadow-xs tactile-btn transition-all"
                >
                  <Tv className="w-3.5 h-3.5 text-brand-reward" />
                  <span className="hidden sm:inline">Telão (TV)</span>
                </Link>
              </>
            )}
          </div>
        </header>

        {/* Active Game Phase Banner */}
        {gameState && gameState.phase === 'VOTING' && (
          <div className="bg-gradient-to-r from-brand-action/20 via-brand-primary/20 to-brand-mint/20 p-3.5 border-b border-brand-primary/30 animate-pop-in">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-brand-action uppercase tracking-wider block">
                  Votação do Júri ao Vivo
                </span>
                <p className="text-xs font-bold text-ink-main">Qual lado defendeu melhor?</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleVote('side_a')}
                  className="px-3.5 py-1.5 rounded-xl bg-brand-action text-white font-bold text-xs shadow-xs hover:scale-105 active:scale-95 transition-all"
                >
                  Lado A (Coral)
                </button>
                <button
                  onClick={() => handleVote('side_b')}
                  className="px-3.5 py-1.5 rounded-xl bg-brand-mint text-white font-bold text-xs shadow-xs hover:scale-105 active:scale-95 transition-all"
                >
                  Lado B (Mint)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Message Feed (WhatsApp Bubbles) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
              <div className="w-14 h-14 rounded-2xl bg-white text-brand-primary flex items-center justify-center mb-3 shadow-xs">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="font-heading text-base font-bold text-ink-main">Nenhuma mensagem ainda</h3>
              <p className="text-xs max-w-sm mt-1 text-gray-600">
                Mande uma mensagem para começar a conversa ou inicie um jogo no grupo!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.nickname === nickname;
              const isSystem = msg.type === 'system';

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <span className="px-3 py-1 rounded-full bg-white/80 backdrop-blur-xs text-gray-600 text-[11px] font-medium shadow-2xs border border-gray-200/50">
                      ✨ {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <span className="text-[11px] font-bold text-brand-primary ml-2 mb-0.5">
                      {msg.nickname}
                    </span>
                  )}
                  <div
                    className={`max-w-md px-3.5 py-2 rounded-2xl text-sm leading-relaxed shadow-xs relative ${
                      isMe
                        ? 'bg-[#E7FFDB] text-ink-main rounded-tr-none border border-emerald-200/40'
                        : 'bg-white text-ink-main rounded-tl-none border border-gray-200/70'
                    }`}
                  >
                    <span>{msg.content}</span>
                    <span className="text-[10px] text-gray-400 float-right ml-3 mt-1 font-mono">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reaction Bar */}
        <div className="px-4 py-1.5 bg-[#F0F2F5]/80 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">
            Reações no Telão:
          </span>
          <div className="flex items-center gap-1">
            {['🔥', '👏', '😂', '👑', '🤯', '💀'].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReaction(emoji)}
                className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center text-sm hover:scale-125 transition-all shadow-2xs"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Message Input Footer */}
        <footer className="p-3 bg-[#F0F2F5] border-t border-gray-200">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite uma mensagem..."
              className="flex-1 px-4 py-2.5 rounded-2xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 rounded-full bg-brand-primary text-white font-bold hover:bg-brand-primary/90 disabled:opacity-40 shadow-xs tactile-btn transition-all flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </footer>
      </main>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        currentUserNickname={nickname}
      />
    </div>
  );
}
