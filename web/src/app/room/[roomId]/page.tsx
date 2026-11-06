'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getStoredUser, getStoredToken, clearStoredSession, logoutUser, type User } from '@/lib/auth';
import { useWebSocket } from '@/lib/useWebSocket';
import type { Room, GameStartPayload } from '@/lib/types';
import {
  API_BASE,
  uploadRoomAttachment,
  leaveRoomApi,
  addGroupMembersApi,
  removeGroupMemberApi,
  toggleGroupAdminApi,
  updateGroupSettingsApi,
  regenerateRoomCodeApi,
} from '@/lib/apiClient';
import { VoiceRecorderSession } from '@/lib/voiceRecorder';
import { AuthModal } from '@/components/AuthModal';
import { CreateGroupModal } from '@/components/CreateGroupModal';
import { ProfileModal } from '@/components/ProfileModal';
import { InChatGameCard } from '@/components/InChatGameCard';
import { CommandPalette } from '@/components/CommandPalette';
import { MessageReactions, MessageHoverToolbar, MessageReactionBadges } from '@/components/MessageReactions';
import { PinnedBanner } from '@/components/PinnedBanner';
import { AudioWaveformBubble } from '@/components/AudioWaveformBubble';
import { GroupDrawer } from '@/components/GroupDrawer';
import { SecurityAuditModal } from '@/components/SecurityAuditModal';
import { ExternalLinkModal } from '@/components/ExternalLinkModal';
import GameSetupModal from '@/components/GameSetupModal';
import LeaderboardModal from '@/components/LeaderboardModal';
import { PollBubble, CreatePollModal } from '@/components/PollComponents';
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
  Mic,
  Square,
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
  BarChart3,
  Trophy,
  Reply,
  FileText,
  Download,
  Edit3,
  Image as ImageIcon,
} from 'lucide-react';
import Link from 'next/link';

interface Contact {
  id: string;
  nickname: string;
  email: string;
  avatar_color?: string;
  status_text?: string;
  bio?: string;
}

interface PendingAttachment {
  name: string;
  size: string;
  mimeType: string;
  dataBase64: string;
  kind: 'image' | 'document';
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
  const [userAvatar, setUserAvatar] = useState('#6C5CE7');
  const [userStatus, setUserStatus] = useState('Disponível');
  const [userBio, setUserBio] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [inputText, setInputText] = useState('');
  const [roomInfo, setRoomInfo] = useState<Room | null>(null);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'groups' | 'direct' | 'contacts'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Search, Modals & Resiliency State
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // Game Setup, Leaderboard & Polls Modals
  const [isGameSetupOpen, setIsGameSetupOpen] = useState(false);
  const [gameSetupMode, setGameSetupMode] = useState<'debate' | 'quiz'>('debate');
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);

  // Modern chat, edit, reply & media states
  const [isMuted, setIsMuted] = useState(false);
  const [isGroupDrawerOpen, setIsGroupDrawerOpen] = useState(false);
  const [isSecurityAuditOpen, setIsSecurityAuditOpen] = useState(false);
  const [externalLinkToOpen, setExternalLinkToOpen] = useState<string | null>(null);
  const clientRateLimiter = useRef(new ClientRateLimiter(6, 2000));
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    nickname: string;
    content: string;
    type?: string;
    attachment?: any;
    poll?: any;
  } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Real Voice Recorder State
  const voiceRecorderRef = useRef<VoiceRecorderSession | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLength = useRef(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getMonogram = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
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
      if (user.avatar_color) setUserAvatar(user.avatar_color);
      if (user.status_text) setUserStatus(user.status_text);
      if (user.bio) setUserBio(user.bio);
    } else {
      setCurrentUser(null);
      setNickname('');
    }
    setIsAuthChecked(true);

    const savedAvatar = localStorage.getItem('porchat_avatar_color');
    if (savedAvatar && !user?.avatar_color) setUserAvatar(savedAvatar);

    const savedStatus = localStorage.getItem('porchat_status_text');
    if (savedStatus && !user?.status_text) setUserStatus(savedStatus);
  }, []);

  // Fetch Rooms & Contacts for Authenticated User
  useEffect(() => {
    if (!currentUser) return;
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${API_BASE}/api/rooms?user=${encodeURIComponent(currentUser.nickname)}`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error('Não autenticado');
        return res.json();
      })
      .then((data: Room[]) => {
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

    fetch(`${API_BASE}/api/users`)
      .then((res) => res.json())
      .then((data: Contact[]) => {
        const others = data.filter((c) => c.nickname !== currentUser.nickname && c.email !== currentUser.email);
        setContacts(others);
      })
      .catch((err) => console.error('Erro ao buscar contatos:', err));
  }, [roomId, currentUser, router]);

  const {
    isConnected,
    latency,
    messages,
    onlineUsers,
    gameState,
    typingUsers,
    pinnedMessage,
    setPinnedMessage,
    roomUpdate,
    sendMessage,
    editMessage,
    pinMessage,
    unpinMessage,
    markMessagesRead,
    createPoll,
    votePoll,
    closePoll,
    sendTyping,
    sendAction,
  } = useWebSocket({
    roomId,
    nickname,
    token: getStoredToken() || undefined,
    clientType: 'web',
  });

  // Sync pinned message from roomInfo when entering room
  useEffect(() => {
    if (roomInfo?.pinned_message) {
      setPinnedMessage(roomInfo.pinned_message);
    }
  }, [roomInfo, setPinnedMessage]);

  // Sync live room metadata updates from WebSocket
  useEffect(() => {
    if (!roomUpdate || roomUpdate.id !== roomId) return;
    setRoomInfo(roomUpdate);
    setAllRooms((prev) => prev.map((r) => (r.id === roomUpdate.id ? { ...r, ...roomUpdate } : r)));
  }, [roomUpdate, roomId]);

  // Automatically mark unread messages as read when viewing room
  useEffect(() => {
    if (!isConnected || !nickname || messages.length === 0) return;
    const unreadFromOthers = messages.filter(
      (m) =>
        m.nickname !== nickname &&
        m.type !== 'system' &&
        !(m.read_by || []).some((reader) => reader.toLowerCase() === nickname.toLowerCase())
    );
    if (unreadFromOthers.length > 0) {
      markMessagesRead(unreadFromOthers.map((m) => m.id));
    }
  }, [messages, isConnected, nickname, markMessagesRead]);

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

  // Real Microphone Voice Note Recording
  const handleStartVoiceRecording = async () => {
    if (isRecordingVoice) return;
    const session = new VoiceRecorderSession();
    voiceRecorderRef.current = session;
    setIsRecordingVoice(true);
    setRecordingSeconds(1);
    setRecordingWaveform([28, 45, 62, 38, 70, 52]);
    await session.start((bars, elapsed) => {
      setRecordingWaveform(bars);
      setRecordingSeconds(elapsed);
    });
  };

  const handleCancelVoiceRecording = () => {
    voiceRecorderRef.current?.cancel();
    voiceRecorderRef.current = null;
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
    setRecordingWaveform([]);
  };

  const handleFinishVoiceRecording = async () => {
    if (!voiceRecorderRef.current) return;
    const session = voiceRecorderRef.current;
    voiceRecorderRef.current = null;
    setIsRecordingVoice(false);
    setIsUploadingMedia(true);
    try {
      const note = await session.stop();
      await uploadRoomAttachment(roomId, {
        kind: 'audio',
        file_name: note.fileName,
        mime_type: note.mimeType,
        data_base64: note.dataBase64,
        duration_seconds: note.durationSeconds,
        waveform: note.waveform,
        reply_to_id: replyingTo?.id,
      });
      setReplyingTo(null);
      audioFeedback.playSend();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao enviar áudio');
    } finally {
      setIsUploadingMedia(false);
      setRecordingSeconds(0);
      setRecordingWaveform([]);
    }
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
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('O arquivo excede o limite de 10 MB.');
      return;
    }
    const sizeKB = (file.size / 1024).toFixed(1);
    const sizeStr =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${sizeKB} KB`;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setAttachment({
          name: file.name,
          size: sizeStr,
          mimeType: file.type || 'application/octet-stream',
          dataBase64: reader.result,
          kind: file.type.startsWith('image/') ? 'image' : 'document',
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    // Handle active message editing
    if (editingMessage) {
      const cleanEdit = sanitizeClientInput(inputText).trim();
      if (!cleanEdit) return;
      editMessage(editingMessage.id, cleanEdit);
      setEditingMessage(null);
      setInputText('');
      showToast('Mensagem atualizada');
      return;
    }

    if (!inputText.trim() && !attachment) return;

    if (!clientRateLimiter.current.allow()) {
      setToastMessage('Aguarde um instante antes de enviar outra mensagem.');
      return;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTyping(false);

    const cleanCaption = sanitizeClientInput(inputText).trim();

    if (attachment) {
      setIsUploadingMedia(true);
      try {
        await uploadRoomAttachment(roomId, {
          kind: attachment.kind,
          file_name: attachment.name,
          mime_type: attachment.mimeType,
          data_base64: attachment.dataBase64,
          caption: cleanCaption || attachment.name,
          reply_to_id: replyingTo?.id,
        });
        setAttachment(null);
        setReplyingTo(null);
        setInputText('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Falha ao enviar anexo');
      } finally {
        setIsUploadingMedia(false);
      }
      return;
    }

    sendMessage(cleanCaption, replyingTo?.id);
    setReplyingTo(null);
    setInputText('');
  };

  const handleSaveProfile = (updated: {
    nickname?: string;
    avatar_color: string;
    status_text: string;
    bio?: string;
  }) => {
    if (updated.nickname) setNickname(updated.nickname);
    setUserAvatar(updated.avatar_color);
    setUserStatus(updated.status_text);
    if (updated.bio !== undefined) setUserBio(updated.bio);
    setCurrentUser((prev) =>
      prev
        ? {
            ...prev,
            nickname: updated.nickname || prev.nickname,
            avatar_color: updated.avatar_color,
            status_text: updated.status_text,
            bio: updated.bio ?? prev.bio,
          }
        : prev
    );
    localStorage.setItem('porchat_avatar_color', updated.avatar_color);
    localStorage.setItem('porchat_status_text', updated.status_text);
    showToast('Perfil salvo com sucesso!');
  };

  const handleOpenGameSetup = (mode: 'debate' | 'quiz') => {
    setGameSetupMode(mode);
    setIsGameSetupOpen(true);
  };

  const handleLaunchGame = (payload: GameStartPayload) => {
    sendAction('game:start', payload);
    showToast(payload.game_type === 'debate' ? 'Partida de Debate iniciada!' : 'Quiz Relâmpago iniciado!');
  };

  // Periodic tick for relative timestamps (every 30s)
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchingMessages(false);
        setMessageSearchQuery('');
        setIsRoomMenuOpen(false);
        setIsProfileModalOpen(false);
        setIsCreateGroupOpen(false);
        setEditingMessage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    showToast('Link da sala copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteRoom = async () => {
    if (!confirm('Deseja realmente excluir este grupo/conversa permanentemente?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/rooms/${roomId}?user=${encodeURIComponent(nickname)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Sala excluída com sucesso!');
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

  const handleLeaveRoom = async () => {
    try {
      await leaveRoomApi(roomId);
    } catch {
      // Fallback navigation even if already removed
    }
    const other = allRooms.find((r) => r.id !== roomId);
    if (other) {
      router.push(`/room/${other.id}`);
    } else {
      router.push('/');
    }
  };

  // Group Administration Handlers
  const handleAddGroupMembers = async (newMembers: string[]) => {
    const updated = await addGroupMembersApi(roomId, newMembers);
    setRoomInfo(updated);
    showToast('Participantes adicionados ao grupo!');
  };

  const handleRemoveGroupMember = async (member: string) => {
    const updated = await removeGroupMemberApi(roomId, member);
    setRoomInfo(updated);
    showToast(`${member} foi removido do grupo.`);
  };

  const handleToggleGroupAdmin = async (member: string) => {
    const updated = await toggleGroupAdminApi(roomId, member);
    setRoomInfo(updated);
    showToast(`Permissões de administrador atualizadas para ${member}.`);
  };

  const handleUpdateGroupSettings = async (name: string, description: string) => {
    const updated = await updateGroupSettingsApi(roomId, { name, description });
    setRoomInfo(updated);
    setAllRooms((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
    showToast('Configurações do grupo salvas!');
  };

  const handleRegenerateCode = async () => {
    const updated = await regenerateRoomCodeApi(roomId);
    setRoomInfo(updated);
    showToast(`Novo código gerado: ${updated.code}`);
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

      const res = await fetch(`${API_BASE}/api/rooms`, {
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

            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-center gap-3">
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
              title="Clique para customizar perfil, senha e estatísticas"
            >
              <div className="relative">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-xs group-hover:scale-105 transition-transform"
                  style={{ backgroundColor: userAvatar.startsWith('#') ? userAvatar : '#6C5CE7' }}
                >
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
                      <div
                        className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm"
                        style={{ backgroundColor: c.avatar_color || '#6C5CE7' }}
                      >
                        {c.nickname[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-ink-main">{c.nickname}</div>
                        <div className="text-[11px] text-gray-400">{c.status_text || c.email}</div>
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
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
                  <MessageSquare className="w-6 h-6 text-gray-400" />
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
            title="Toque para ver membros, administração e detalhes"
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
                    ? `${onlineUsers.length} online • ${roomInfo.members?.length || 1} membros`
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

          {/* Header Action Buttons */}
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

            {/* Room Leaderboard & Match History Button */}
            <button
              type="button"
              onClick={() => setIsLeaderboardOpen(true)}
              className="p-2 rounded-xl bg-white hover:bg-amber-50 text-amber-600 border border-gray-200 transition-all tactile-btn"
              title="Ranking e Histórico de Partidas da Sala"
            >
              <Trophy className="w-4 h-4" />
            </button>

            {/* Command Palette Trigger */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-ink-muted border border-gray-200 text-xs font-mono font-bold transition-all shadow-2xs tactile-btn"
              title="Abrir Command Palette (Cmd+K ou Ctrl+K)"
            >
              <kbd className="text-[10px] bg-gray-100 px-1 py-0.5 rounded border border-gray-200">Ctrl+K</kbd>
            </button>

            {/* Search messages toggle */}
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
                      onClick={() => handleOpenGameSetup('debate')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-action text-white text-xs font-bold hover:bg-brand-action/90 shadow-xs tactile-btn transition-all"
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Debate</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenGameSetup('quiz')}
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

            {/* Room Options Dropdown */}
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
                <div className="absolute right-0 top-11 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 z-50 animate-pop-in text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoomMenuOpen(false);
                      setIsLeaderboardOpen(true);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-amber-50 text-amber-700 transition-colors text-left"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ranking & Histórico</span>
                  </button>
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

        {/* WebSocket Reconnection Status Banner */}
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

        {/* In-Chat Message Search Bar */}
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

        {/* Floating Feedback Toast */}
        {toastMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-ink-main text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-xl border border-white/10 flex items-center gap-2 animate-bounce">
            <span>{toastMessage}</span>
          </div>
        )}

        {/* In-Chat Interactive Game Controller Card */}
        {isGameActive && gameState && (
          <div className="px-4 pt-3">
            <InChatGameCard
              gameState={gameState}
              currentNickname={nickname}
              currentUserId={currentUser?.id || nickname}
              onOpenTV={() => window.open(`/tv/${roomId}`, '_blank')}
              onCastVote={(choice) => sendAction('debate:cast_vote', { choice })}
              onSubmitArgument={(text) => sendAction('debate:submit_argument', { argument: text })}
              onPlayerReady={() => sendAction('debate:player_ready', {})}
              onAskQuestion={(question) => sendAction('debate:ask_question', { question })}
              onTriggerReaction={(label) => sendAction('debate:reaction', { emoji: label })}
              onSubmitQuizAnswer={(opt) => sendAction('quiz:submit_answer', { option: opt })}
            />
          </div>
        )}

        {/* Pinned Message or Room Banner */}
        <PinnedBanner
          title={roomInfo?.description ? 'Descrição do Grupo' : 'Aviso da Sala'}
          content={
            roomInfo?.description ||
            (roomInfo?.name
              ? `Bem-vindo ao grupo ${roomInfo.name}! Converse, crie enquetes e dispute no telão.`
              : 'Converse, dispute debates e quizzes com sincronia em tempo real.')
          }
          roomCode={roomInfo?.code}
          pinnedMessage={pinnedMessage}
          onUnpin={() => unpinMessage()}
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
                  : 'Mande uma mensagem, grave uma nota de voz, crie uma enquete ou inicie um jogo no grupo!'}
              </p>
            </div>
          ) : (
            displayedMessages.map((msg, index) => {
              const isMe = msg.nickname === nickname;
              const isSystem = msg.type === 'system';
              const isGameCard = msg.type === 'game_card';
              const isPoll = msg.type === 'poll' || Boolean(msg.poll);
              const isVoice =
                msg.type === 'voice' ||
                msg.attachment?.kind === 'audio' ||
                msg.content.startsWith('[Mensagem de Voz') ||
                msg.content.includes('Mensagem de Voz');
              const isImage = msg.attachment?.kind === 'image';
              const isFile = msg.type === 'file' || msg.attachment?.kind === 'document';
              const prevMsg = index > 0 ? displayedMessages[index - 1] : undefined;
              const readCount = (msg.read_by || []).filter(
                (r) => r.toLowerCase() !== msg.nickname.toLowerCase()
              ).length;

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

              if (isGameCard) {
                return (
                  <React.Fragment key={msg.id}>
                    {renderDateDivider(msg.created_at, prevMsg?.created_at)}
                    <div className="flex justify-center my-3 animate-message-in">
                      <div className="max-w-lg w-full rounded-2xl bg-[#1E1E2E] text-white px-4 py-3 shadow-md border border-brand-reward/30 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-brand-reward/20 text-brand-reward flex items-center justify-center shrink-0">
                            <Trophy className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-reward block">
                              Resultado Oficial da Partida
                            </span>
                            <p className="text-xs text-slate-200 mt-0.5">{msg.content}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsLeaderboardOpen(true)}
                          className="px-2.5 py-1.5 rounded-xl bg-brand-reward text-[#1E1E2E] text-[10px] font-bold shrink-0 hover:opacity-90 transition"
                        >
                          Ver Ranking
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
                );
              }

              return (
                <React.Fragment key={msg.id}>
                  {renderDateDivider(msg.created_at, prevMsg?.created_at)}
                  <div
                    id={`msg-${msg.id}`}
                    className={`group relative flex flex-col ${
                      isMe ? 'items-end' : 'items-start'
                    } animate-message-in`}
                  >
                    {!isMe && (
                      <span className="text-[11px] font-bold text-brand-primary ml-2 mb-0.5">
                        {msg.nickname}
                      </span>
                    )}

                    <div
                      className={`max-w-md px-3.5 py-2 rounded-2xl text-sm leading-relaxed shadow-xs relative transition-all ${
                        isMe
                          ? 'bg-[#E7FFDB] text-ink-main rounded-tr-none border border-emerald-200/40'
                          : 'bg-white text-ink-main rounded-tl-none border border-gray-200/70'
                      }`}
                    >
                      {/* Floating Quick Action Toolbar (Absolute: Zero Layout Shift on Hover) */}
                      <MessageHoverToolbar
                        messageId={msg.id}
                        isMe={isMe}
                        isPinned={pinnedMessage?.message_id === msg.id}
                        canEdit={isMe && msg.type === 'text'}
                        onReact={handleMessageReaction}
                        onReply={() =>
                          setReplyingTo({
                            id: msg.id,
                            nickname: msg.nickname,
                            content: msg.content,
                            type: msg.type,
                            attachment: msg.attachment,
                            poll: msg.poll,
                          })
                        }
                        onEdit={() => {
                          setEditingMessage({ id: msg.id, content: msg.content });
                          setInputText(msg.content);
                        }}
                        onPin={() => {
                          if (pinnedMessage?.message_id === msg.id) {
                            unpinMessage();
                            showToast('Mensagem desafixada');
                          } else {
                            pinMessage(msg.id);
                            showToast('Mensagem fixada no topo da sala');
                          }
                        }}
                        onDelete={(id) => {
                          sendAction('chat:delete_message', { message_id: id });
                          showToast('Mensagem apagada');
                        }}
                      />

                      {/* Structured Rich Reply Preview */}
                      {msg.reply_preview && (() => {
                        const repliedMsg =
                          messages.find((m) => m.id === msg.reply_preview?.id) ||
                          messages.find((m) => m.id === msg.reply_to_id);
                        const isReplyImage =
                          msg.reply_preview.type === 'image' ||
                          repliedMsg?.type === 'image' ||
                          repliedMsg?.attachment?.kind === 'image' ||
                          msg.reply_preview.content.startsWith('Imagem:');
                        const isReplyVoice =
                          msg.reply_preview.type === 'voice' ||
                          repliedMsg?.type === 'voice' ||
                          repliedMsg?.attachment?.kind === 'audio';
                        const isReplyFile =
                          msg.reply_preview.type === 'file' ||
                          repliedMsg?.type === 'file' ||
                          repliedMsg?.attachment?.kind === 'document';
                        const isReplyPoll =
                          msg.reply_preview.type === 'poll' ||
                          repliedMsg?.type === 'poll' ||
                          Boolean(repliedMsg?.poll);

                        const replyImgUrl = msg.reply_preview.media_url
                          ? msg.reply_preview.media_url.startsWith('http') ||
                            msg.reply_preview.media_url.startsWith('data:')
                            ? msg.reply_preview.media_url
                            : `${API_BASE}${msg.reply_preview.media_url}`
                          : repliedMsg?.attachment?.data_url ||
                            (repliedMsg?.attachment?.url
                              ? repliedMsg.attachment.url.startsWith('http')
                                ? repliedMsg.attachment.url
                                : `${API_BASE}${repliedMsg.attachment.url}`
                              : null);

                        const replyFileName =
                          msg.reply_preview.file_name || repliedMsg?.attachment?.file_name;

                        return (
                          <div
                            onClick={() => {
                              const el = document.getElementById(`msg-${msg.reply_preview?.id}`);
                              if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                el.classList.add('ring-2', 'ring-brand-primary');
                                setTimeout(() => el.classList.remove('ring-2', 'ring-brand-primary'), 1500);
                              }
                            }}
                            className="mb-1.5 flex items-center justify-between gap-2 rounded-xl bg-black/5 hover:bg-black/10 transition-colors border-l-3 border-brand-primary px-2.5 py-1.5 text-xs cursor-pointer select-none"
                            title="Clique para ver a mensagem original"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-brand-primary block text-[10px] leading-tight">
                                {msg.reply_preview.nickname}
                              </span>
                              <div className="flex items-center gap-1.5 text-gray-600 truncate mt-0.5">
                                {isReplyImage ? (
                                  <>
                                    <ImageIcon className="w-3 h-3 text-brand-primary shrink-0" />
                                    <span className="truncate">
                                      {replyFileName || msg.reply_preview.content || 'Foto'}
                                    </span>
                                  </>
                                ) : isReplyVoice ? (
                                  <>
                                    <Mic className="w-3 h-3 text-brand-primary shrink-0" />
                                    <span className="truncate">Mensagem de voz</span>
                                  </>
                                ) : isReplyFile ? (
                                  <>
                                    <FileText className="w-3 h-3 text-brand-primary shrink-0" />
                                    <span className="truncate">
                                      {replyFileName || msg.reply_preview.content}
                                    </span>
                                  </>
                                ) : isReplyPoll ? (
                                  <>
                                    <BarChart3 className="w-3 h-3 text-brand-primary shrink-0" />
                                    <span className="truncate">
                                      {repliedMsg?.poll?.question || msg.reply_preview.content}
                                    </span>
                                  </>
                                ) : (
                                  <span className="truncate">{msg.reply_preview.content}</span>
                                )}
                              </div>
                            </div>
                            {isReplyImage && replyImgUrl && (
                              <img
                                src={replyImgUrl}
                                alt="Preview"
                                className="w-9 h-9 rounded-md object-cover border border-black/10 shrink-0 ml-1.5"
                              />
                            )}
                          </div>
                        );
                      })()}

                      {/* Message Content by Type */}
                      {isPoll && msg.poll ? (
                        <PollBubble
                          messageId={msg.id}
                          poll={msg.poll}
                          currentNickname={nickname}
                          onVote={(mid, oid) => votePoll(mid, oid)}
                          onClosePoll={(mid) => closePoll(mid)}
                        />
                      ) : isVoice ? (
                        <AudioWaveformBubble
                          isMe={isMe}
                          attachment={msg.attachment}
                        />
                      ) : isImage && msg.attachment ? (
                        <div className="space-y-1.5">
                          <img
                            src={
                              msg.attachment.url.startsWith('http')
                                ? msg.attachment.url
                                : `${API_BASE}${msg.attachment.url}`
                            }
                            alt={msg.attachment.file_name}
                            className="max-h-64 rounded-xl object-cover border border-black/10"
                          />
                          <div className="flex items-center justify-between text-[10px] text-gray-500">
                            <span className="truncate max-w-[180px]">{msg.attachment.file_name}</span>
                            {msg.attachment.sha256 && (
                              <span className="font-mono">SHA256: {msg.attachment.sha256.slice(0, 8)}</span>
                            )}
                          </div>
                        </div>
                      ) : isFile && msg.attachment ? (
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-black/5 p-2.5 border border-black/10">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-brand-primary/15 text-brand-primary flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-ink-main truncate">
                                {msg.attachment.file_name}
                              </p>
                              <p className="text-[10px] text-gray-500 font-mono">
                                {(msg.attachment.size_bytes / 1024).toFixed(1)} KB
                                {msg.attachment.sha256 ? ` • SHA256 ${msg.attachment.sha256.slice(0, 8)}` : ''}
                              </p>
                            </div>
                          </div>
                          <a
                            href={
                              msg.attachment.url.startsWith('http')
                                ? msg.attachment.url
                                : `${API_BASE}${msg.attachment.url}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-brand-primary text-white hover:opacity-90 shrink-0"
                            title="Baixar arquivo verificado"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        renderMessageContent(msg.content)
                      )}

                      <div className="flex items-center gap-1.5 float-right ml-3 mt-1 text-[10px] text-gray-400 font-mono">
                        {msg.edited_at && (
                          <span className="italic text-gray-400">(editada)</span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setReplyingTo({
                              id: msg.id,
                              nickname: msg.nickname,
                              content: msg.content,
                              type: msg.type,
                              attachment: msg.attachment,
                              poll: msg.poll,
                            })
                          }
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-brand-primary transition-opacity"
                          title="Responder mensagem"
                        >
                          <Reply className="w-3 h-3" />
                        </button>
                        <span>{formatRelativeTime(msg.created_at)}</span>
                        {/* Real Read Receipt Indicator */}
                        {isMe && (
                          <span
                            className={readCount > 0 ? 'text-brand-primary font-bold' : 'text-gray-400'}
                            title={
                              readCount > 0
                                ? `Lida por ${readCount} participante(s)`
                                : 'Entregue no servidor'
                            }
                          >
                            <svg className="w-3.5 h-3.5 inline" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-3 0a.5.5 0 0 0-.708-.708L5 7.293 3.854 6.146a.5.5 0 1 0-.708.708l1.5 1.5a.5.5 0 0 0 .708 0l4-4z" />
                            </svg>
                            {readCount > 0 && <span className="ml-0.5 text-[9px]">{readCount}</span>}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Unified Reaction Badges (Rendered statically only when active reactions exist - zero layout shift on hover) */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <MessageReactionBadges
                        messageId={msg.id}
                        reactions={msg.reactions}
                        currentUserId={nickname}
                        isMe={isMe}
                        onReact={handleMessageReaction}
                      />
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}

          {/* Typing Indicator */}
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

        {/* Message Input Dock */}
        <footer className="p-3 bg-white/85 backdrop-blur-md border-t border-gray-200/80">
          {/* Active Editing Banner */}
          {editingMessage && (
            <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-xl text-xs">
              <div className="flex items-center gap-2 truncate">
                <Edit3 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <div className="truncate">
                  <span className="font-bold text-amber-800 block text-[11px]">
                    Editando mensagem
                  </span>
                  <span className="text-amber-700 truncate block text-xs">
                    {editingMessage.content}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingMessage(null);
                  setInputText('');
                }}
                className="p-1 rounded-md hover:bg-amber-100 text-amber-700 ml-2 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quoted Rich Reply Preview Bar */}
          {replyingTo && (() => {
            const isReplyImage =
              replyingTo.type === 'image' ||
              replyingTo.attachment?.kind === 'image' ||
              replyingTo.content.startsWith('Imagem:');
            const isReplyVoice =
              replyingTo.type === 'voice' ||
              replyingTo.attachment?.kind === 'audio';
            const isReplyFile =
              replyingTo.type === 'file' ||
              replyingTo.attachment?.kind === 'document';
            const isReplyPoll =
              replyingTo.type === 'poll' || Boolean(replyingTo.poll);

            const replyImgUrl =
              replyingTo.attachment?.data_url ||
              (replyingTo.attachment?.url
                ? replyingTo.attachment.url.startsWith('http')
                  ? replyingTo.attachment.url
                  : `${API_BASE}${replyingTo.attachment.url}`
                : null);

            return (
              <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-gray-50 border border-gray-200 border-l-4 border-l-brand-primary rounded-xl text-xs animate-in fade-in duration-150">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-brand-primary block text-[11px] leading-tight">
                      Respondendo a {replyingTo.nickname}
                    </span>
                    <div className="flex items-center gap-1.5 text-gray-600 truncate text-xs mt-0.5">
                      {isReplyImage ? (
                        <>
                          <ImageIcon className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                          <span className="truncate">
                            {replyingTo.attachment?.file_name ||
                              replyingTo.content ||
                              'Foto'}
                          </span>
                        </>
                      ) : isReplyVoice ? (
                        <>
                          <Mic className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                          <span className="truncate">Mensagem de voz</span>
                        </>
                      ) : isReplyFile ? (
                        <>
                          <FileText className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                          <span className="truncate">
                            {replyingTo.attachment?.file_name || replyingTo.content}
                          </span>
                        </>
                      ) : isReplyPoll ? (
                        <>
                          <BarChart3 className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                          <span className="truncate">
                            {replyingTo.poll?.question || replyingTo.content}
                          </span>
                        </>
                      ) : (
                        <span className="truncate">{replyingTo.content}</span>
                      )}
                    </div>
                  </div>
                  {isReplyImage && replyImgUrl && (
                    <img
                      src={replyImgUrl}
                      alt="Thumbnail"
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="p-1 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-600 ml-2 cursor-pointer shrink-0"
                  title="Cancelar resposta"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })()}

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

          {/* Live Voice Recording Bar */}
          {isRecordingVoice ? (
            <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-2xl bg-red-50 border border-red-200">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-mono font-bold text-red-700">
                  Gravando {Math.floor(recordingSeconds / 60)}:
                  {(recordingSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>

              <div className="flex flex-1 items-center justify-center gap-1 h-6 max-w-xs overflow-hidden">
                {recordingWaveform.map((bar, idx) => (
                  <span
                    key={idx}
                    className="w-1 rounded-full bg-red-500 transition-all duration-100"
                    style={{ height: `${Math.max(20, Math.min(100, bar))}%` }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelVoiceRecording}
                  className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleFinishVoiceRecording}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:opacity-90"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Enviar Áudio</span>
                </button>
              </div>
            </div>
          ) : (
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
                title="Anexar imagem ou documento (verificado com SHA-256)"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsCreatePollOpen(true)}
                className="p-2.5 rounded-full hover:bg-gray-100 text-ink-muted hover:text-brand-primary transition-all tactile-btn flex items-center justify-center cursor-pointer"
                title="Criar Enquete Interativa"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleStartVoiceRecording}
                disabled={isUploadingMedia}
                className="p-2.5 rounded-full hover:bg-gray-100 text-ink-muted hover:text-brand-primary transition-all tactile-btn flex items-center justify-center cursor-pointer"
                title="Gravar Nota de Voz Real"
              >
                <Mic className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder={
                  editingMessage
                    ? 'Edite sua mensagem...'
                    : 'Digite uma mensagem...'
                }
                className="flex-1 px-4 py-2.5 rounded-2xl bg-gray-50/90 border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:bg-white transition-all"
              />
              <button
                type="submit"
                disabled={(!inputText.trim() && !attachment) || isUploadingMedia}
                className="p-2.5 rounded-full bg-brand-primary text-white font-bold hover:bg-brand-primary/90 disabled:opacity-40 shadow-xs tactile-btn transition-all flex items-center justify-center cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </footer>
      </main>

      {/* Sliding Group Details & Administration Drawer */}
      <GroupDrawer
        isOpen={isGroupDrawerOpen}
        onClose={() => setIsGroupDrawerOpen(false)}
        room={roomInfo}
        currentNickname={nickname}
        onlineUsers={onlineUsers}
        onAddMembers={handleAddGroupMembers}
        onRemoveMember={handleRemoveGroupMember}
        onToggleAdmin={handleToggleGroupAdmin}
        onUpdateSettings={handleUpdateGroupSettings}
        onRegenerateCode={handleRegenerateCode}
        onOpenLeaderboard={() => {
          setIsGroupDrawerOpen(false);
          setIsLeaderboardOpen(true);
        }}
        onLeaveRoom={handleLeaveRoom}
        onDeleteRoom={handleDeleteRoom}
      />

      {/* Interactive Game Setup Modal (Debate & Quiz) */}
      <GameSetupModal
        isOpen={isGameSetupOpen}
        onClose={() => setIsGameSetupOpen(false)}
        roomId={roomId}
        currentNickname={nickname}
        members={roomInfo?.members || [nickname]}
        initialMode={gameSetupMode}
        onLaunchGame={handleLaunchGame}
      />

      {/* Room Leaderboard & Match History Modal */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        roomId={roomId}
        roomName={roomInfo?.name || 'Conversa'}
      />

      {/* Create Interactive Poll Modal */}
      <CreatePollModal
        isOpen={isCreatePollOpen}
        onClose={() => setIsCreatePollOpen(false)}
        onSubmitPoll={(question, options, multiSelect) => {
          createPoll(question, options, multiSelect);
          showToast('Enquete publicada na conversa!');
        }}
      />

      {/* Linear-Style Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        roomId={roomId}
        roomCode={roomInfo?.code}
        onStartDebate={() => handleOpenGameSetup('debate')}
        onStartQuiz={() => handleOpenGameSetup('quiz')}
      />

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        currentUserNickname={nickname}
      />

      {/* Profile, Password & Career Stats Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={{
          id: currentUser?.id,
          nickname,
          avatar_color: userAvatar,
          status_text: userStatus,
          bio: userBio,
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
