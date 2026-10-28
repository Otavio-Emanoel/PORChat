'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWebSocket } from '@/lib/useWebSocket';
import { getStoredUser, clearStoredSession, type User } from '@/lib/auth';
import { CreateGroupModal } from '@/components/CreateGroupModal';
import { ProfileModal } from '@/components/ProfileModal';
import { InChatGameCard } from '@/components/InChatGameCard';
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
  Plus,
  Search,
  Smile,
  Pause,
  Play,
  SkipForward,
  XOctagon,
  Clock,
  MoreVertical,
  Trash2,
  LogOut,
  X,
} from 'lucide-react';
import Link from 'next/link';

interface RoomData {
  id: string;
  name: string;
  code: string;
  is_group: boolean;
  members?: string[];
  created_by?: string;
  unread_count?: number;
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
  const [userAvatar, setUserAvatar] = useState('👑');
  const [userStatus, setUserStatus] = useState('Pronto pro debate! ⚔️');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [inputText, setInputText] = useState('');
  const [roomInfo, setRoomInfo] = useState<RoomData | null>(null);
  const [allRooms, setAllRooms] = useState<RoomData[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'groups' | 'direct' | 'contacts'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // New polish & resiliency state (Items 21, 22, 26, 27, 28)
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(false);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize User & Profile Customization
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

    const savedAvatar = localStorage.getItem('porchat_avatar_emoji');
    if (savedAvatar) setUserAvatar(savedAvatar);

    const savedStatus = localStorage.getItem('porchat_status_text');
    if (savedStatus) setUserStatus(savedStatus);
  }, []);

  // Fetch Rooms & Contacts
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

    // Fetch rooms
    fetch(`${apiBase}/api/rooms`)
      .then((res) => res.json())
      .then((data: RoomData[]) => {
        // Add mock unread counters for demo liveliness
        const roomsWithUnread = data.map((r, i) => ({
          ...r,
          unread_count: r.id === roomId ? 0 : i === 1 ? 2 : 0,
        }));
        setAllRooms(roomsWithUnread);
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

  const {
    isConnected,
    messages,
    onlineUsers,
    gameState,
    typingUsers,
    sendMessage,
    sendTyping,
    sendAction,
  } = useWebSocket({
    roomId,
    nickname,
    clientType: 'web',
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);

    if (text.trim().length > 0) {
      sendTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(false);
      }, 2000);
    } else {
      sendTyping(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTyping(false);

    sendMessage(inputText.trim());
    setInputText('');
  };

  const handleSaveProfile = ({
    avatar_emoji,
    status_text,
  }: {
    avatar_emoji: string;
    status_text: string;
  }) => {
    setUserAvatar(avatar_emoji);
    setUserStatus(status_text);
    localStorage.setItem('porchat_avatar_emoji', avatar_emoji);
    localStorage.setItem('porchat_status_text', status_text);
  };

  const handleStartDebate = () => {
    sendAction('game:start', {
      game_type: 'debate',
      debater_a_id: currentUser?.id || nickname,
    });
  };

  const handleStartQuiz = () => {
    sendAction('game:start', {
      game_type: 'quiz',
      round_count: 5,
    });
  };

  // Periodic tick for relative timestamps (every 30s)
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Global Keyboard shortcuts (Item 26)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchingMessages(false);
        setMessageSearchQuery('');
        setIsRoomMenuOpen(false);
        setIsProfileModalOpen(false);
        setIsCreateGroupOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffSec = Math.floor((nowTick - date.getTime()) / 1000);
      if (diffSec < 15) return 'agora';
      if (diffSec < 60) return `há ${diffSec}s`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `há ${diffMin} min`;
      const isToday = new Date().toDateString() === date.toDateString();
      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return `${date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return '';
    }
  };

  const handleCopyInvite = () => {
    const inviteText = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(inviteText);
    setCopied(true);
    showToast('🔗 Link da sala copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteRoom = async () => {
    if (!confirm('Deseja realmente excluir este grupo/conversa permanentemente?')) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
    try {
      const res = await fetch(`${apiBase}/api/rooms/${roomId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('🗑️ Sala excluída com sucesso!');
        const other = allRooms.find((r) => r.id !== roomId);
        if (other) {
          router.push(`/room/${other.id}`);
        } else {
          router.push('/');
        }
      }
    } catch (err) {
      console.error('Erro ao excluir sala:', err);
    }
  };

  const handleLeaveRoom = () => {
    const other = allRooms.find((r) => r.id !== roomId);
    if (other) {
      router.push(`/room/${other.id}`);
    } else {
      router.push('/');
    }
  };

  const handleReaction = (emoji: string) => {
    sendAction('debate:reaction', { emoji });
  };

  const handleVote = (choice: 'side_a' | 'side_b') => {
    sendAction('debate:cast_vote', { choice });
  };

  // Moderation Controls
  const handlePauseGame = () => sendAction('game:pause', {});
  const handleResumeGame = () => sendAction('game:resume', {});
  const handleSkipPhase = () => sendAction('game:skip_phase', {});
  const handleAbortGame = () => sendAction('game:abort', {});

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
      const existing = allRooms.find(
        (r) => !r.is_group && (r.name === contact.nickname || r.members?.includes(contact.nickname))
      );
      if (existing) {
        router.push(`/room/${existing.id}`);
        return;
      }

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

  const isGameActive = gameState && gameState.phase !== 'CHAT';

  const displayedMessages = messages.filter((m) => {
    if (!messageSearchQuery.trim()) return true;
    const query = messageSearchQuery.toLowerCase();
    return (
      m.content.toLowerCase().includes(query) ||
      m.nickname.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex h-screen bg-[#F0F2F5] text-ink-main overflow-hidden font-body">
      {/* WhatsApp-Style Sidebar */}
      <aside className="w-88 sm:w-96 bg-white border-r border-gray-200 flex flex-col justify-between hidden md:flex shadow-xs select-none">
        <div className="flex flex-col h-full">
          {/* Top User Bar */}
          <div className="p-3.5 bg-[#F0F2F5] border-b border-gray-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-3 text-left hover:opacity-90 transition-all group"
              title="Clique para customizar avatar e status"
            >
              <div className="w-10 h-10 rounded-2xl bg-brand-primary flex items-center justify-center text-white text-xl shadow-xs group-hover:scale-105 transition-transform">
                {userAvatar}
              </div>
              <div className="leading-tight">
                <span className="text-sm font-bold text-ink-main block truncate max-w-[130px]">
                  {nickname}
                </span>
                <span className="text-[10px] text-gray-500 font-medium block truncate max-w-[130px]">
                  {userStatus}
                </span>
              </div>
            </button>

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

          {/* WhatsApp Tabs with Unread Badges */}
          <div className="flex px-3 pt-2 pb-1 bg-white border-b border-gray-100 gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1.5 text-center rounded-lg transition-colors flex items-center justify-center gap-1 ${
                activeTab === 'all'
                  ? 'bg-brand-primary/10 text-brand-primary'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span>Todas</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              className={`flex-1 py-1.5 text-center rounded-lg transition-colors flex items-center justify-center gap-1 ${
                activeTab === 'groups'
                  ? 'bg-brand-primary/10 text-brand-primary'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span>Grupos</span>
              <span className="w-4 h-4 rounded-full bg-brand-action text-white text-[9px] flex items-center justify-center font-bold">
                2
              </span>
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
              <div className="p-2 space-y-1">
                <span className="px-3 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  Contatos Cadastrados ({contacts.length})
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
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-heading font-bold text-lg shrink-0 shadow-2xs ${
                        room.is_group
                          ? 'bg-gradient-to-br from-brand-primary to-purple-800'
                          : 'bg-brand-action'
                      }`}
                    >
                      {room.is_group ? <Users className="w-6 h-6" /> : room.name[0].toUpperCase()}
                    </div>

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
                        {room.unread_count && room.unread_count > 0 ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-brand-action text-white text-[10px] font-bold">
                            {room.unread_count}
                          </span>
                        ) : room.is_group ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary text-[9px] font-bold uppercase shrink-0">
                            Grupo
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Session */}
        {currentUser && (
          <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              Logado como <strong>{currentUser.nickname}</strong>
            </span>
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
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-heading font-bold text-base shadow-xs ${
                roomInfo?.is_group
                  ? 'bg-gradient-to-br from-brand-primary to-purple-800'
                  : 'bg-brand-action'
              }`}
            >
              {roomInfo?.is_group ? (
                <Users className="w-5 h-5" />
              ) : (
                roomInfo?.name[0].toUpperCase() || 'P'
              )}
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
                    title="Copiar link e código de convite"
                  >
                    <span>{roomInfo.code}</span>
                    {copied ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
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

          {/* Header Action Buttons (Start Games, Host Moderation, Search, TV Mode & Room Menu) */}
          <div className="flex items-center gap-2">
            {/* Search messages toggle (Item 21) */}
            <button
              type="button"
              onClick={() => {
                setIsSearchingMessages((prev) => !prev);
                if (isSearchingMessages) setMessageSearchQuery('');
              }}
              title="Buscar mensagens nesta conversa"
              className={`p-2 rounded-xl transition-all tactile-btn ${
                isSearchingMessages
                  ? 'bg-brand-primary text-white shadow-xs'
                  : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              <Search className="w-4 h-4" />
            </button>

            {roomInfo?.is_group && (
              <>
                {isGameActive ? (
                  /* Live Game Host Controls */
                  <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl shadow-2xs border border-gray-200">
                    <span className="text-[10px] font-bold text-brand-action uppercase mr-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-spin" />
                      {gameState.phase}
                    </span>
                    <button
                      type="button"
                      onClick={handlePauseGame}
                      title="Pausar Temporizador"
                      className="p-1 hover:bg-gray-100 rounded-md text-gray-600 hover:text-ink-main"
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleResumeGame}
                      title="Retomar Temporizador"
                      className="p-1 hover:bg-gray-100 rounded-md text-gray-600 hover:text-ink-main"
                    >
                      <Play className="w-3.5 h-3.5 text-green-600" />
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipPhase}
                      title="Pular para Próxima Fase"
                      className="p-1 hover:bg-gray-100 rounded-md text-gray-600 hover:text-brand-primary"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleAbortGame}
                      title="Encerrar Partida"
                      className="p-1 hover:bg-red-50 rounded-md text-red-500 hover:text-red-700"
                    >
                      <XOctagon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
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
                  </>
                )}

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

            {/* Room Options Dropdown (Item 28) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsRoomMenuOpen((prev) => !prev)}
                className="p-2 rounded-xl bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 transition-all tactile-btn"
                title="Opções da Sala"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isRoomMenuOpen && (
                <div className="absolute right-0 top-11 w-44 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 z-50 animate-pop-in text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoomMenuOpen(false);
                      handleLeaveRoom();
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 text-gray-700 transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5 text-gray-400" />
                    <span>Sair da Sala</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoomMenuOpen(false);
                      handleDeleteRoom();
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-red-50 text-red-600 transition-colors text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    <span>Excluir Sala</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* WebSocket Reconnection Status Banner (Item 23) */}
        {!isConnected && (
          <div className="bg-amber-500 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md z-20 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>Conexão perdida com o servidor. Reconectando automaticamente...</span>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-2.5 py-1 bg-white text-amber-700 rounded-lg text-[11px] font-bold hover:bg-amber-50 shadow-xs"
            >
              Reconectar agora
            </button>
          </div>
        )}

        {/* In-Chat Message Search Bar (Item 21) */}
        {isSearchingMessages && (
          <div className="px-4 py-2.5 bg-white border-b border-gray-200 flex items-center gap-2 shadow-xs z-20 animate-fade-in">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={messageSearchQuery}
              onChange={(e) => setMessageSearchQuery(e.target.value)}
              placeholder="Filtrar mensagens ou participantes (Esc para fechar)..."
              autoFocus
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-ink-main focus:outline-none focus:border-brand-primary"
            />
            {messageSearchQuery && (
              <span className="text-[11px] font-mono text-gray-400">
                {displayedMessages.length} {displayedMessages.length === 1 ? 'encontrada' : 'encontradas'}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setIsSearchingMessages(false);
                setMessageSearchQuery('');
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Floating Feedback Toast (Item 27) */}
        {toastMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-ink-main text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-xl border border-white/10 flex items-center gap-2 animate-bounce">
            <span>{toastMessage}</span>
          </div>
        )}

        {/* In-Chat Interactive Game Activity Card (Item 10) */}
        {isGameActive && (
          <div className="px-4 pt-3">
            <InChatGameCard
              roomId={roomId}
              gameState={gameState}
              onEnterJury={() => handleVote('side_a')}
            />
          </div>
        )}

        {/* Message Feed (WhatsApp Bubbles) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {displayedMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
              <div className="w-14 h-14 rounded-2xl bg-white text-brand-primary flex items-center justify-center mb-3 shadow-xs">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="font-heading text-base font-bold text-ink-main">
                {messageSearchQuery ? 'Nenhum resultado para a busca' : 'Nenhuma mensagem ainda'}
              </h3>
              <p className="text-xs max-w-sm mt-1 text-gray-600">
                {messageSearchQuery
                  ? 'Tente buscar com outras palavras-chave ou limpe a busca.'
                  : 'Mande uma mensagem para começar a conversa ou inicie um jogo no grupo!'}
              </p>
            </div>
          ) : (
            displayedMessages.map((msg) => {
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
                    <div className="flex items-center gap-1 float-right ml-3 mt-1 text-[10px] text-gray-400 font-mono">
                      <span>{formatRelativeTime(msg.created_at)}</span>
                      {/* Double Checkmark (Item 9) */}
                      {isMe && (
                        <span className="text-brand-primary text-xs font-bold leading-none" title="Entregue">
                          ✓✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Typing Indicator (Item 8) */}
          {Object.keys(typingUsers).length > 0 && (
            <div className="space-y-1.5 animate-pop-in">
              {Object.values(typingUsers).map((u) => (
                <div key={u.nickname} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-2xl rounded-tl-none shadow-2xs border border-gray-200">
                    <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce"></span>
                    <span className="ml-1 text-[11px] font-medium text-gray-600">
                      {u.nickname} está digitando...
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Reaction Bar */}
        <div className="px-4 py-1.5 bg-[#F0F2F5]/80 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">
            Reações no Telão:
          </span>
          <div className="flex items-center gap-1">
            {['🔥', '💀', '🍅', '👏', '🤯', '👑', '🎯'].map((emoji) => (
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
              onChange={handleInputChange}
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

      {/* Profile & Avatar Customization Modal (Item 12) */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={{
          nickname,
          avatar_emoji: userAvatar,
          status_text: userStatus,
        }}
        onSave={handleSaveProfile}
      />
    </div>
  );
}
