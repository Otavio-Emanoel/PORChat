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
import { type ReplyTarget } from '@/lib/chatHelpers';
import { AuthModal } from '@/components/AuthModal';
import { CreateGroupModal } from '@/components/CreateGroupModal';
import { ProfileModal } from '@/components/ProfileModal';
import { InChatGameCard } from '@/components/InChatGameCard';
import { CommandPalette } from '@/components/CommandPalette';
import { PinnedBanner } from '@/components/PinnedBanner';
import { GroupDrawer } from '@/components/GroupDrawer';
import { SecurityAuditModal } from '@/components/SecurityAuditModal';
import { ExternalLinkModal } from '@/components/ExternalLinkModal';
import GameSetupModal from '@/components/GameSetupModal';
import LeaderboardModal from '@/components/LeaderboardModal';
import { CreatePollModal } from '@/components/PollComponents';
import { RoomAuthGate } from '@/components/RoomAuthGate';
import { RoomSidebar, type Contact } from '@/components/RoomSidebar';
import { RoomHeader } from '@/components/RoomHeader';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { ChatComposer, type PendingAttachment } from '@/components/ChatComposer';
import { SessionTerminatedModal } from '@/components/SessionTerminatedModal';
import { ClientRateLimiter, sanitizeClientInput, SessionInactivityGuard, getStoredSecuritySettings } from '@/lib/security';
import { audioFeedback } from '@/lib/audioFeedback';
import { MessageSquare, Search, X } from 'lucide-react';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [sessionTerminatedNotice, setSessionTerminatedNotice] = useState<string | null>(null);

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
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
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
        } else if (sorted.length > 0 && (roomId === 'default' || !current)) {
          router.replace(`/room/${sorted[0].id}`);
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
    onSessionTerminated: (reason) => {
      clearStoredSession();
      setCurrentUser(null);
      setSessionTerminatedNotice(reason);
    },
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

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

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
        router.push(other ? `/room/${other.id}` : '/');
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
    router.push(other ? `/room/${other.id}` : '/');
  };

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

  const handleOpenUrl = (url: string) => {
    const settings = getStoredSecuritySettings();
    if (settings.link_safety_interceptor) {
      setExternalLinkToOpen(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleTogglePin = (messageId: string) => {
    if (pinnedMessage?.message_id === messageId) {
      unpinMessage();
      showToast('Mensagem desafixada');
    } else {
      pinMessage(messageId);
      showToast('Mensagem fixada no topo da sala');
    }
  };

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

  const isGameActive = Boolean(gameState && gameState.phase !== 'CHAT');

  const displayedMessages = messages.filter((m) => {
    if (!messageSearchQuery.trim()) return true;
    const query = messageSearchQuery.toLowerCase();
    return m.content.toLowerCase().includes(query) || m.nickname.toLowerCase().includes(query);
  });

  if (isAuthChecked && !currentUser) {
    return (
      <RoomAuthGate
        isAuthModalOpen={isAuthModalOpen}
        authMode={authMode}
        onOpenAuth={(mode) => {
          setAuthMode(mode);
          setIsAuthModalOpen(true);
        }}
        onCloseAuth={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setNickname(user.nickname);
          setIsAuthModalOpen(false);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen bg-[#F0F2F5] text-ink-main overflow-hidden font-body">
      <RoomSidebar
        roomId={roomId}
        currentUser={currentUser}
        nickname={nickname}
        userAvatar={userAvatar}
        userStatus={userStatus}
        allRooms={allRooms}
        filteredRooms={filteredRooms}
        contacts={contacts}
        activeTab={activeTab}
        searchQuery={searchQuery}
        nowTick={nowTick}
        onSetActiveTab={setActiveTab}
        onSetSearchQuery={setSearchQuery}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
        onSelectRoom={(targetRoomId) => router.push(`/room/${targetRoomId}`)}
        onStartDirectChat={handleStartDirectChat}
        onLogout={() => {
          clearStoredSession();
          setCurrentUser(null);
          setNickname('');
          router.push('/');
        }}
      />

      <main className="flex-1 flex flex-col h-full bg-[#EFEAE2] relative">
        <RoomHeader
          roomId={roomId}
          roomInfo={roomInfo}
          onlineCount={onlineUsers.length}
          latency={latency}
          copied={copied}
          isMuted={isMuted}
          isSearchingMessages={isSearchingMessages}
          isGameActive={isGameActive}
          gameState={gameState}
          isRoomMenuOpen={isRoomMenuOpen}
          onOpenDrawer={() => setIsGroupDrawerOpen(true)}
          onCopyInvite={handleCopyInvite}
          onToggleMute={handleToggleMute}
          onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onToggleSearch={() => {
            setIsSearchingMessages((prev) => !prev);
            if (isSearchingMessages) setMessageSearchQuery('');
          }}
          onOpenGameSetup={handleOpenGameSetup}
          onPauseGame={() => sendAction('game:pause', {})}
          onResumeGame={() => sendAction('game:resume', {})}
          onSkipPhase={() => sendAction('game:skip_phase', {})}
          onAbortGame={() => sendAction('game:abort', {})}
          onToggleRoomMenu={() => setIsRoomMenuOpen((prev) => !prev)}
          onCloseRoomMenu={() => setIsRoomMenuOpen(false)}
          onOpenSecurityAudit={() => setIsSecurityAuditOpen(true)}
          onLeaveRoom={handleLeaveRoom}
          onDeleteRoom={handleDeleteRoom}
        />

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

        {toastMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-ink-main text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-xl border border-white/10 flex items-center gap-2 animate-bounce">
            <span>{toastMessage}</span>
          </div>
        )}

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
            displayedMessages.map((msg, index) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                prevMessage={index > 0 ? displayedMessages[index - 1] : undefined}
                allMessages={messages}
                currentNickname={nickname}
                pinnedMessage={pinnedMessage}
                searchQuery={messageSearchQuery}
                nowTick={nowTick}
                onReact={handleMessageReaction}
                onReply={setReplyingTo}
                onEdit={(id, content) => {
                  setEditingMessage({ id, content });
                  setInputText(content);
                }}
                onTogglePin={handleTogglePin}
                onDelete={(id) => {
                  sendAction('chat:delete_message', { message_id: id });
                  showToast('Mensagem apagada');
                }}
                onVotePoll={(mid, oid) => votePoll(mid, oid)}
                onClosePoll={(mid) => closePoll(mid)}
                onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
                onOpenUrl={handleOpenUrl}
              />
            ))
          )}

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

        <ChatComposer
          inputText={inputText}
          editingMessage={editingMessage}
          replyingTo={replyingTo}
          attachment={attachment}
          isUploadingMedia={isUploadingMedia}
          isRecordingVoice={isRecordingVoice}
          recordingSeconds={recordingSeconds}
          recordingWaveform={recordingWaveform}
          fileInputRef={fileInputRef}
          onInputChange={handleInputChange}
          onCancelEdit={() => {
            setEditingMessage(null);
            setInputText('');
          }}
          onCancelReply={() => setReplyingTo(null)}
          onClearAttachment={() => {
            setAttachment(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
          onAttachmentClick={() => fileInputRef.current?.click()}
          onFileChange={handleFileChange}
          onOpenCreatePoll={() => setIsCreatePollOpen(true)}
          onStartVoiceRecording={handleStartVoiceRecording}
          onCancelVoiceRecording={handleCancelVoiceRecording}
          onFinishVoiceRecording={handleFinishVoiceRecording}
          onSubmit={handleSend}
        />
      </main>

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

      <GameSetupModal
        isOpen={isGameSetupOpen}
        onClose={() => setIsGameSetupOpen(false)}
        roomId={roomId}
        currentNickname={nickname}
        members={roomInfo?.members || [nickname]}
        initialMode={gameSetupMode}
        onLaunchGame={handleLaunchGame}
      />

      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        roomId={roomId}
        roomName={roomInfo?.name || 'Conversa'}
      />

      <CreatePollModal
        isOpen={isCreatePollOpen}
        onClose={() => setIsCreatePollOpen(false)}
        onSubmitPoll={(question, options, multiSelect) => {
          createPoll(question, options, multiSelect);
          showToast('Enquete publicada na conversa!');
        }}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        roomId={roomId}
        roomCode={roomInfo?.code}
        onStartDebate={() => handleOpenGameSetup('debate')}
        onStartQuiz={() => handleOpenGameSetup('quiz')}
      />

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        currentUserNickname={nickname}
      />

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

      <SecurityAuditModal
        isOpen={isSecurityAuditOpen}
        onClose={() => setIsSecurityAuditOpen(false)}
        roomId={roomId}
        roomName={roomInfo?.name || 'Conversa'}
        messages={messages}
        currentNickname={nickname}
      />

      <ExternalLinkModal
        isOpen={!!externalLinkToOpen}
        onClose={() => setExternalLinkToOpen(null)}
        url={externalLinkToOpen || ''}
      />

      <SessionTerminatedModal
        notice={sessionTerminatedNotice}
        onRelogin={() => {
          setSessionTerminatedNotice(null);
          setAuthMode('login');
          setIsAuthModalOpen(true);
        }}
      />
    </div>
  );
}
