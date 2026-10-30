'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWebSocket } from '@/lib/useWebSocket';
import { getStoredUser, getStoredToken, clearStoredSession, loginDemoUser, logoutUser, type User } from '@/lib/auth';
import { AuthModal } from '@/components/AuthModal';
import { CreateGroupModal } from '@/components/CreateGroupModal';
import { ProfileModal } from '@/components/ProfileModal';
import { InChatGameCard } from '@/components/InChatGameCard';
import { CommandPalette } from '@/components/CommandPalette';
import { MessageHoverBar, MessageReactionPills } from '@/components/MessageReactions';
import { PinnedBanner } from '@/components/PinnedBanner';
import { AudioWaveformBubble } from '@/components/AudioWaveformBubble';
import { GroupDrawer } from '@/components/GroupDrawer';
import { SecurityAuditModal } from '@/components/SecurityAuditModal';
import { ExternalLinkModal } from '@/components/ExternalLinkModal';
import { ClientRateLimiter, sanitizeClientInput, SessionInactivityGuard, getStoredSecuritySettings } from '@/lib/security';
import { audioFeedback } from '@/lib/audioFeedback';
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
  Mic,
  Pause,
  Play,
  SkipForward,
  XOctagon,
  Clock,
  MoreVertical,
  Trash2,
  LogOut,
  X,
  ShieldCheck,
  Lock,
  Volume2,
  VolumeX,
  Paperclip,
} from 'lucide-react';
import Link from 'next/link';

interface RoomData {
  id: string;
  name: string;
  code: string;
  is_group: boolean;
  members?: string[];
  created_by?: string;
  created_at?: string;
  last_message?: string;
  last_message_at?: string;
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
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const [nickname, setNickname] = useState('');
  const [userAvatar, setUserAvatar] = useState('OE');
  const [userStatus, setUserStatus] = useState('Disponível');
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
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // Modern chat & media states
  const [isMuted, setIsMuted] = useState(false);
  const [isGroupDrawerOpen, setIsGroupDrawerOpen] = useState(false);
  const [isSecurityAuditOpen, setIsSecurityAuditOpen] = useState(false);
  const [externalLinkToOpen, setExternalLinkToOpen] = useState<string | null>(null);
  const clientRateLimiter = useRef(new ClientRateLimiter(6, 2000));
  const [replyingTo, setReplyingTo] = useState<{ id: string; nickname: string; content: string } | null>(null);
  const [attachment, setAttachment] = useState<{ name: string; size: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLength = useRef(0);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getMonogram = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Inactivity guard
  useEffect(() => {
    if (!currentUser) return;
    const settings = getStoredSecuritySettings();
    const guard = new SessionInactivityGuard(settings.session_timeout_minutes, async () => {
      await logoutUser();
      setCurrentUser(null);
      setToastMessage('Sessão encerrada por inatividade preventiva.');
    });
    guard.start();
    return () => guard.stop();
  }, [currentUser]);

  // Initialize User & Profile Customization
  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setCurrentUser(user);
      setNickname(user.nickname);
    } else {
      setCurrentUser(null);
      setNickname('');
    }
    setIsAuthChecked(true);

    const savedAvatar = localStorage.getItem('porchat_avatar_emoji');
    if (savedAvatar) setUserAvatar(savedAvatar);

    const savedStatus = localStorage.getItem('porchat_status_text');
    if (savedStatus) setUserStatus(savedStatus);
  }, []);

  const handleQuickLogin = async (profile: 'Otavio' | 'Pedro' | 'Raul') => {
    try {
      const res = await loginDemoUser(profile);
      setCurrentUser(res.user);
      setNickname(res.user.nickname);
      setIsAuthModalOpen(false);
    } catch (e) {
      console.error('Falha no login:', e);
    }
  };

  // Fetch Rooms & Contacts for Authenticated User
  useEffect(() => {
    if (!currentUser) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Fetch user-specific private rooms
    fetch(`${apiBase}/api/rooms?user=${encodeURIComponent(currentUser.nickname)}`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error('Não autenticado');
        return res.json();
      })
      .then((data: RoomData[]) => {
        const sorted = [...data].sort((a, b) => {
          const timeA = new Date(a.last_message_at || a.created_at || 0).getTime();
          const timeB = new Date(b.last_message_at || b.created_at || 0).getTime();
          if (timeA !== timeB) return timeB - timeA;
          return a.name.localeCompare(b.name);
        });
        const roomsWithUnread = sorted.map((r) => ({
          ...r,
          unread_count: r.id === roomId ? 0 : (r.unread_count || 0),
        }));
        setAllRooms(roomsWithUnread);

        const current = sorted.find((r) => r.id === roomId);
        if (current) {
          setRoomInfo(current);
        } else if (sorted.length > 0) {
          if (roomId === 'default' || !current) {
            router.replace(`/room/${sorted[0].id}`);
          }
        }
      })
      .catch((err) => console.error('Erro ao buscar salas privadas:', err));

    // Fetch contacts
    fetch(`${apiBase}/api/users`)
      .then((res) => res.json())
      .then((data: Contact[]) => {
        const others = data.filter((c) => c.nickname !== currentUser.nickname && c.email !== currentUser.email);
        setContacts(others);
      })
      .catch((err) => console.error('Erro ao buscar contatos:', err));
  }, [roomId, currentUser]);

  const {
    isConnected,
    latency,
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

  // Global Command Palette Shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMessageReaction = (messageId: string, emoji: string) => {
    sendAction('chat:reaction', { message_id: messageId, emoji });
  };

  const handleSendVoiceNote = () => {
    sendMessage('🎤 Mensagem de Voz (0:14)');
  };

  // Synchronize last message and activity of the current room in the sidebar
  useEffect(() => {
    if (messages.length === 0 || !roomId) return;
    const lastMsg = messages[messages.length - 1];
    setAllRooms((prev) => {
      const idx = prev.findIndex((r) => r.id === roomId);
      if (idx === -1) return prev;
      const updated = {
        ...prev[idx],
        last_message: lastMsg.content,
        last_message_at: lastMsg.created_at ? new Date(lastMsg.created_at).toISOString() : new Date().toISOString(),
      };
      const copy = [...prev];
      copy[idx] = updated;
      return copy.sort((a, b) => {
        const timeA = new Date(a.last_message_at || a.created_at || 0).getTime();
        const timeB = new Date(b.last_message_at || b.created_at || 0).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return a.name.localeCompare(b.name);
      });
    });
  }, [messages, roomId]);

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

  useEffect(() => {
    setIsMuted(audioFeedback.getMuted());
  }, []);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    audioFeedback.setMuted(next);
    showToast(next ? 'Áudio de notificações silenciado' : 'Áudio de notificações ativado');
  };

  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      const latest = messages[messages.length - 1];
      if (latest && latest.nickname === nickname) {
        audioFeedback.playSend();
      } else if (latest && latest.type !== 'system') {
        audioFeedback.playReceive();
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages, nickname]);

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeKB = (file.size / 1024).toFixed(1);
      const sizeStr =
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${sizeKB} KB`;
      setAttachment({ name: file.name, size: sizeStr });
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachment) return;

    if (!clientRateLimiter.current.allow()) {
      setToastMessage('Aguarde um instante antes de enviar outra mensagem.');
      return;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTyping(false);

    let messageContent = sanitizeClientInput(inputText);
    if (replyingTo) {
      messageContent = `> [${replyingTo.nickname}]: ${replyingTo.content}\n${messageContent}`;
      setReplyingTo(null);
    }
    if (attachment) {
      messageContent = messageContent
        ? `${messageContent}\n📎 [Arquivo: ${attachment.name} (${attachment.size})]`
        : `📎 [Arquivo: ${attachment.name} (${attachment.size})]`;
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    sendMessage(messageContent);
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

  // Filtered rooms with stable sorting
  const filteredRooms = allRooms
    .filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.code.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (activeTab === 'groups') return r.is_group;
      if (activeTab === 'direct') return !r.is_group;
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.last_message_at || a.created_at || 0).getTime();
      const timeB = new Date(b.last_message_at || b.created_at || 0).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return a.name.localeCompare(b.name);
    });

  // Start 1-on-1 direct conversation with contact
  const handleStartDirectChat = async (contact: Contact) => {
    if (!currentUser) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
    try {
      const existing = allRooms.find(
        (r) => !r.is_group && (r.name === contact.nickname || r.members?.includes(contact.nickname))
      );
      if (existing) {
        router.push(`/room/${existing.id}`);
        return;
      }

      const token = getStoredToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${apiBase}/api/rooms`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: contact.nickname,
          is_group: false,
          members: [currentUser.nickname, contact.nickname],
          created_by: currentUser.nickname,
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

  const renderHighlightedText = (text: string) => {
    if (!messageSearchQuery.trim()) return text;
    const parts = text.split(
      new RegExp(`(${messageSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    );
    return parts.map((part, i) =>
      part.toLowerCase() === messageSearchQuery.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 text-ink-main rounded px-0.5 font-medium">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const handleOpenUrl = (url: string) => {
    const settings = getStoredSecuritySettings();
    if (settings.link_safety_interceptor) {
      setExternalLinkToOpen(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const renderWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            onClick={(e) => {
              e.preventDefault();
              handleOpenUrl(part);
            }}
            className="text-brand-primary underline break-all hover:opacity-80 transition-opacity"
          >
            {part}
          </a>
        );
      }
      return renderHighlightedText(part);
    });
  };

  const renderMessageContent = (content: string) => {
    if (content.startsWith('> [')) {
      const newlineIndex = content.indexOf('\n');
      if (newlineIndex !== -1) {
        const quoteHeader = content.substring(0, newlineIndex);
        const actualBody = content.substring(newlineIndex + 1);
        return (
          <div className="space-y-1">
            <div className="px-2 py-1 rounded-lg bg-black/5 border-l-2 border-brand-primary text-xs text-gray-600 mb-1">
              {quoteHeader.replace(/^>\s*/, '')}
            </div>
            <div>{renderWithLinks(actualBody)}</div>
          </div>
        );
      }
    }
    return renderWithLinks(content);
  };

  const renderDateDivider = (currentDateStr?: string, prevDateStr?: string) => {
    if (!currentDateStr) return null;
    try {
      const d1 = new Date(currentDateStr);
      const d1Str = d1.toDateString();
      const d2Str = prevDateStr ? new Date(prevDateStr).toDateString() : null;
      if (d1Str === d2Str) return null;

      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      let label = d1.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
      if (d1Str === today) label = 'Hoje';
      else if (d1Str === yesterday) label = 'Ontem';

      return (
        <div key={`date-divider-${currentDateStr}`} className="flex justify-center my-3 select-none">
          <span className="px-3 py-1 rounded-full bg-white/90 shadow-2xs border border-gray-200/60 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            {label}
          </span>
        </div>
      );
    } catch {
      return null;
    }
  };

  // Strict Authentication Gate: WhatsApp-style Login Screen
  if (isAuthChecked && !currentUser) {
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

            {/* Quick 1-Click Profile Selection */}
            <div className="mt-8">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3">
                Entrar com 1 Clique (Demonstração)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('Otavio')}
                  className="p-4 rounded-2xl border-2 border-brand-primary/20 hover:border-brand-primary bg-brand-primary/5 hover:bg-brand-primary/10 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-brand-primary text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      OE
                    </div>
                    <span className="font-bold text-sm text-ink-main">Otavio</span>
                  </div>
                  <span className="text-[11px] text-gray-500 block truncate">otavio@porchat.com</span>
                  <span className="mt-2 inline-block text-[10px] font-semibold text-brand-primary bg-white px-2 py-0.5 rounded-full border border-brand-primary/20">
                    Acessar Perfil →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('Pedro')}
                  className="p-4 rounded-2xl border-2 border-brand-action/20 hover:border-brand-action bg-brand-action/5 hover:bg-brand-action/10 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-brand-action text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      PR
                    </div>
                    <span className="font-bold text-sm text-ink-main">Pedro</span>
                  </div>
                  <span className="text-[11px] text-gray-500 block truncate">pedro@porchat.com</span>
                  <span className="mt-2 inline-block text-[10px] font-semibold text-brand-action bg-white px-2 py-0.5 rounded-full border border-brand-action/20">
                    Acessar Perfil →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('Raul')}
                  className="p-4 rounded-2xl border-2 border-brand-mint/20 hover:border-brand-mint bg-brand-mint/5 hover:bg-brand-mint/10 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-brand-mint text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      RL
                    </div>
                    <span className="font-bold text-sm text-ink-main">Raul</span>
                  </div>
                  <span className="text-[11px] text-gray-500 block truncate">raul@porchat.com</span>
                  <span className="mt-2 inline-block text-[10px] font-semibold text-brand-mint bg-white px-2 py-0.5 rounded-full border border-brand-mint/20">
                    Acessar Perfil →
                  </span>
                </button>
              </div>
            </div>

            {/* Manual Email Login / Register */}
            <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setIsAuthModalOpen(true);
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-brand-primary text-white font-bold text-sm hover:bg-brand-primary/90 transition-all shadow-xs cursor-pointer"
              >
                Entrar com Email & Senha
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setIsAuthModalOpen(true);
                }}
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
          onClose={() => setIsAuthModalOpen(false)}
          initialMode={authMode}
          onSuccess={(user: User) => {
            setCurrentUser(user);
            setNickname(user.nickname);
            setIsAuthModalOpen(false);
          }}
        />
      </div>
    );
  }

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
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-brand-primary flex items-center justify-center text-white font-bold text-sm shadow-xs group-hover:scale-105 transition-transform">
                  {getMonogram(nickname || 'OE')}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
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
              {allRooms.filter((r) => r.is_group).length > 0 && (
                <span className="w-4 h-4 rounded-full bg-brand-primary text-white text-[9px] flex items-center justify-center font-bold">
                  {allRooms.filter((r) => r.is_group).length}
                </span>
              )}
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
                      className="px-3 py-1.5 rounded-xl bg-brand-primary text-white text-[11px] font-bold shadow-xs hover:bg-brand-primary/90 transition-all cursor-pointer"
                    >
                      Conversar
                    </button>
                  </div>
                ))}
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-xl mb-3">
                  💬
                </div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Nenhuma conversa encontrada</p>
                <p className="text-[11px] text-gray-400 mb-4">
                  {searchQuery ? 'Tente pesquisar por outro termo.' : 'Inicie uma conversa na aba Contatos ou crie um Novo Grupo!'}
                </p>
                {!searchQuery && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('contacts')}
                    className="px-3 py-1.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 transition-all shadow-xs cursor-pointer"
                  >
                    Ver Contatos
                  </button>
                )}
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
                        <span className="text-[10px] text-gray-400 font-medium shrink-0 ml-1">
                          {room.last_message_at ? formatRelativeTime(room.last_message_at) : room.code}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="truncate max-w-[155px]">
                          {room.last_message || (room.is_group ? 'Toque para conversar e jogar' : 'Conversa iniciada')}
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
                setNickname('');
                router.push('/');
              }}
              className="text-red-500 hover:underline font-bold text-[11px] cursor-pointer"
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
          <div
            onClick={() => setIsGroupDrawerOpen(true)}
            className="flex items-center gap-3 cursor-pointer group"
            title="Toque para ver membros e detalhes"
          >
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-heading font-bold text-base shadow-xs group-hover:scale-105 transition-transform ${
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
                <h2 className="font-heading text-base font-bold text-ink-main tracking-tight leading-none group-hover:text-brand-primary transition-colors">
                  {roomInfo?.name || 'Conversa'}
                </h2>
                {roomInfo?.code && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyInvite();
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-600 text-[10px] font-mono font-bold hover:bg-gray-50 transition-all"
                    title="Copiar código de convite"
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
                    ? `${onlineUsers.length} online • toque para ver detalhes`
                    : `${onlineUsers.length} participante online`}
                </span>
                {latency !== null && (
                  <span
                    className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/50 hidden sm:inline"
                    title="Latência WebSocket com o servidor"
                  >
                    {latency}ms
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Header Action Buttons (Start Games, Host Moderation, Search, TV Mode & Room Menu) */}
          <div className="flex items-center gap-2">
            {/* Audio notifications mute toggle */}
            <button
              type="button"
              onClick={handleToggleMute}
              className={`p-2 rounded-xl border border-gray-200 transition-all tactile-btn ${
                isMuted
                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : 'bg-white hover:bg-gray-100 text-gray-600'
              }`}
              title={isMuted ? 'Ativar sons de notificações' : 'Silenciar notificações'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Command Palette Trigger */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-ink-muted border border-gray-200 text-xs font-mono font-bold transition-all shadow-2xs tactile-btn"
              title="Abrir Command Palette (Cmd+K ou Ctrl+K)"
            >
              <kbd className="text-[10px] bg-gray-100 px-1 py-0.5 rounded border border-gray-200">⌘K</kbd>
            </button>

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
                <div className="absolute right-0 top-11 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 z-50 animate-pop-in text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoomMenuOpen(false);
                      setIsSecurityAuditOpen(true);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-emerald-50 text-emerald-800 transition-colors text-left"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Segurança & Exportar</span>
                  </button>
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

        {/* Pinned Room Announcement Banner (Item 53) */}
        <PinnedBanner
          title="Aviso da Sala"
          content={
            roomInfo?.name
              ? `Bem-vindo ao grupo ${roomInfo.name}! Converse e dispute no telão.`
              : 'Converse, dispute debates e quizzes com sincronia em tempo real.'
          }
          roomCode={roomInfo?.code}
        />

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
            displayedMessages.map((msg, index) => {
              const isMe = msg.nickname === nickname;
              const isSystem = msg.type === 'system';
              const isVoice = msg.content.startsWith('🎤 Mensagem de Voz');
              const prevMsg = index > 0 ? displayedMessages[index - 1] : undefined;

              if (isSystem) {
                return (
                  <React.Fragment key={msg.id}>
                    {renderDateDivider(msg.created_at, prevMsg?.created_at)}
                    <div className="flex justify-center my-2 animate-message-in">
                      <span className="px-3 py-1 rounded-full bg-white/80 backdrop-blur-xs text-gray-600 text-[11px] font-medium shadow-2xs border border-gray-200/50 flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-brand-primary" />
                        {msg.content}
                      </span>
                    </div>
                  </React.Fragment>
                );
              }

              return (
                <React.Fragment key={msg.id}>
                  {renderDateDivider(msg.created_at, prevMsg?.created_at)}
                  <div
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    className={`group relative flex flex-col ${
                      isMe ? 'items-end' : 'items-start'
                    } animate-message-in`}
                  >
                    {!isMe && (
                      <span className="text-[11px] font-bold text-brand-primary ml-2 mb-0.5">
                        {msg.nickname}
                      </span>
                    )}

                    {/* Quick Telegram/WhatsApp-style Hover Reaction & Action Bar */}
                    {hoveredMessageId === msg.id && (
                      <MessageHoverBar
                        messageId={msg.id}
                        onReact={(emoji) => handleMessageReaction(msg.id, emoji)}
                        isCurrentUser={isMe}
                        onReply={() =>
                          setReplyingTo({
                            id: msg.id,
                            nickname: msg.nickname,
                            content: msg.content,
                          })
                        }
                        onCopy={() => {
                          navigator.clipboard.writeText(msg.content);
                          showToast('Texto copiado para a área de transferência!');
                        }}
                        onDelete={() => {
                          sendAction('chat:delete_message', { message_id: msg.id });
                          showToast('Mensagem apagada');
                        }}
                      />
                    )}

                    <div
                      className={`max-w-md px-3.5 py-2 rounded-2xl text-sm leading-relaxed shadow-xs relative transition-all ${
                        isMe
                          ? 'bg-[#E7FFDB] text-ink-main rounded-tr-none border border-emerald-200/40'
                          : 'bg-white text-ink-main rounded-tl-none border border-gray-200/70'
                      }`}
                    >
                      {isVoice ? (
                        <AudioWaveformBubble durationSeconds={14} isCurrentUser={isMe} />
                      ) : (
                        renderMessageContent(msg.content)
                      )}

                      <div className="flex items-center gap-1 float-right ml-3 mt-1 text-[10px] text-gray-400 font-mono">
                        <span>{formatRelativeTime(msg.created_at)}</span>
                        {/* WhatsApp-style Double Checkmark */}
                        {isMe && (
                          <span className="text-brand-primary" title="Entregue">
                            <svg className="w-3.5 h-3.5 inline" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-3 0a.5.5 0 0 0-.708-.708L5 7.293 3.854 6.146a.5.5 0 1 0-.708.708l1.5 1.5a.5.5 0 0 0 .708 0l4-4z"/>
                            </svg>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Aggregated Reaction Badges */}
                    <MessageReactionPills
                      reactions={msg.reactions}
                      currentUserId={nickname}
                      onToggleReaction={(emoji) => handleMessageReaction(msg.id, emoji)}
                      isCurrentUser={isMe}
                    />
                  </div>
                </React.Fragment>
              );
            })
          )}

          {/* Typing Indicator (Item 58) */}
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

        {/* Floating Frosted Glass Message Input Dock (Item 54) */}
        <footer className="p-3 bg-white/80 backdrop-blur-md border-t border-gray-200/80">
          {/* Quoted Reply Preview Bar */}
          {replyingTo && (
            <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-gray-50 border border-gray-200 border-l-4 border-l-brand-primary rounded-xl text-xs animate-in fade-in duration-150">
              <div className="truncate">
                <span className="font-bold text-brand-primary block text-[11px] leading-tight">
                  Respondendo a {replyingTo.nickname}
                </span>
                <span className="text-gray-600 truncate block text-xs mt-0.5">
                  {replyingTo.content}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="p-1 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-600 ml-2 cursor-pointer"
                title="Cancelar resposta"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Attachment Preview Chip */}
          {attachment && (
            <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-brand-primary/10 border border-brand-primary/20 rounded-xl text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2 truncate text-brand-primary font-medium">
                <Paperclip className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{attachment.name}</span>
                <span className="text-[10px] text-gray-400 font-mono">({attachment.size})</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAttachment(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="p-1 rounded-md hover:bg-brand-primary/20 text-brand-primary ml-2 cursor-pointer"
                title="Remover anexo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleAttachmentClick}
              className="p-2.5 rounded-full hover:bg-gray-100 text-ink-muted hover:text-brand-primary transition-all tactile-btn flex items-center justify-center cursor-pointer"
              title="Anexar arquivo"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSendVoiceNote}
              className="p-2.5 rounded-full hover:bg-gray-100 text-ink-muted hover:text-brand-primary transition-all tactile-btn flex items-center justify-center cursor-pointer"
              title="Gravar Áudio de Voz"
            >
              <Mic className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder="Digite uma mensagem..."
              className="flex-1 px-4 py-2.5 rounded-2xl bg-gray-50/90 border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:bg-white transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim() && !attachment}
              className="p-2.5 rounded-full bg-brand-primary text-white font-bold hover:bg-brand-primary/90 disabled:opacity-40 shadow-xs tactile-btn transition-all flex items-center justify-center cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </footer>
      </main>

      {/* Sliding Group Details & Members Drawer (Item 23) */}
      <GroupDrawer
        isOpen={isGroupDrawerOpen}
        onClose={() => setIsGroupDrawerOpen(false)}
        roomName={roomInfo?.name || 'Conversa'}
        roomCode={roomInfo?.code}
        isGroup={!!roomInfo?.is_group}
        members={roomInfo?.members || [nickname]}
        onlineUsers={onlineUsers}
        createdBy={roomInfo?.created_by}
        createdAt={roomInfo?.created_at}
        onLeave={handleLeaveRoom}
        onDelete={handleDeleteRoom}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onOpenSecurityAudit={() => {
          setIsGroupDrawerOpen(false);
          setIsSecurityAuditOpen(true);
        }}
      />

      {/* Linear-Style Command Palette (Item 48) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        roomId={roomId}
        roomCode={roomInfo?.code}
        onStartDebate={handleStartDebate}
        onStartQuiz={handleStartQuiz}
      />

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

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
        onSuccess={(user: User) => {
          setCurrentUser(user);
          setNickname(user.nickname);
          setIsAuthModalOpen(false);
        }}
      />

      {/* Security & Audit Modal */}
      <SecurityAuditModal
        isOpen={isSecurityAuditOpen}
        onClose={() => setIsSecurityAuditOpen(false)}
        roomId={roomId}
        roomName={roomInfo?.name || 'Conversa'}
        messages={messages}
        currentNickname={nickname}
      />

      {/* External Link Interceptor Modal */}
      <ExternalLinkModal
        isOpen={!!externalLinkToOpen}
        onClose={() => setExternalLinkToOpen(null)}
        url={externalLinkToOpen || ''}
      />
    </div>
  );
}
