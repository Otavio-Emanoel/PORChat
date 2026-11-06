import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { useWebSocketContext } from '../context/WebSocketContext';
import { colors } from '../theme/colors';
import type {
  ChatMessage,
  RoomLeaderboardEntry,
  MatchHistoryRecord,
  TriviaDifficulty,
} from '../types';

interface RoomItem {
  id: string;
  name: string;
  description?: string;
  code: string;
  is_group: boolean;
  members?: string[];
  admins?: string[];
  created_by?: string;
  created_at?: string;
  last_message?: string;
  last_message_at?: string;
}

interface ContactItem {
  id: string;
  nickname: string;
  email: string;
  avatar_color?: string;
  status_text?: string;
}

export const ChatScreen: React.FC<{ onOpenController: () => void }> = ({ onOpenController }) => {
  const {
    messages,
    sendMessage,
    editMessage,
    deleteMessage,
    pinMessage,
    unpinMessage,
    markMessagesRead,
    createPoll,
    votePoll,
    closePoll,
    sendTyping,
    typingUsers,
    isConnected,
    gameState,
    pinnedMessage,
    setPinnedMessage,
    roomUpdate,
    nickname,
    setNickname,
    roomId,
    setRoomId,
    serverHost,
    sendAction,
    updateMobileProfile,
  } = useWebSocketContext();

  // Navigation View: 'list' (WhatsApp chats/contacts list) or 'chat' (active conversation feed)
  const [currentView, setCurrentView] = useState<'list' | 'chat'>('list');
  const [activeTab, setActiveTab] = useState<'all' | 'groups' | 'contacts'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Rooms and Contacts State
  const [roomList, setRoomList] = useState<RoomItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [currentRoomInfo, setCurrentRoomInfo] = useState<RoomItem | null>(null);

  // Modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRoomCodeModal, setShowRoomCodeModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreatePollModal, setShowCreatePollModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showGameSetupModal, setShowGameSetupModal] = useState(false);
  const [gameSetupMode, setGameSetupMode] = useState<'debate' | 'quiz'>('debate');

  // Create Group Form
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Profile Form
  const [tempNick, setTempNick] = useState(nickname);
  const [tempStatus, setTempStatus] = useState('Disponível no PORChat');
  const [tempBio, setTempBio] = useState('');

  // Room PIN Form
  const [roomPin, setRoomPin] = useState('');

  // Create Poll Form
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionA, setPollOptionA] = useState('');
  const [pollOptionB, setPollOptionB] = useState('');
  const [pollOptionC, setPollOptionC] = useState('');
  const [pollMultiSelect, setPollMultiSelect] = useState(false);

  // Game Setup Form
  const [debateTopicInput, setDebateTopicInput] = useState('');
  const [debateSideA, setDebateSideA] = useState('');
  const [debateSideB, setDebateSideB] = useState('');
  const [quizCategory, setQuizCategory] = useState('Todas');
  const [quizDifficulty, setQuizDifficulty] = useState<TriviaDifficulty>('Todas');
  const [quizRoundCount, setQuizRoundCount] = useState(5);

  // Leaderboard & History State
  const [leaderboardData, setLeaderboardData] = useState<RoomLeaderboardEntry[]>([]);
  const [historyData, setHistoryData] = useState<MatchHistoryRecord[]>([]);

  // Reply & Edit State
  const [replyingTo, setReplyingTo] = useState<{ id: string; nickname: string; content: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Animations & Refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fabScaleAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<FlatList>(null);

  const getAvatarBgColor = (idOrName: string) => {
    const palette = ['#6C5CE7', '#FF7675', '#00CEC9', '#FDCB6E', '#A29BFE', '#E17055', '#0984E3', '#00B894'];
    let hash = 0;
    const str = idOrName || 'user';
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
  };

  // Fetch Rooms & Contacts
  const fetchData = async () => {
    const host = serverHost.trim() || 'localhost:8081';
    try {
      const userParam = encodeURIComponent(nickname);
      const [roomsRes, usersRes] = await Promise.all([
        fetch(`http://${host}/api/rooms?user=${userParam}`),
        fetch(`http://${host}/api/users`),
      ]);

      if (roomsRes.ok) {
        const roomsData: RoomItem[] = await roomsRes.json();
        const sorted = [...roomsData].sort((a, b) => {
          const timeA = new Date(a.last_message_at || a.created_at || 0).getTime();
          const timeB = new Date(b.last_message_at || b.created_at || 0).getTime();
          if (timeA !== timeB) return timeB - timeA;
          return a.name.localeCompare(b.name);
        });
        setRoomList(sorted);
        const current = sorted.find((r) => r.id === roomId);
        if (current) setCurrentRoomInfo(current);
      }

      if (usersRes.ok) {
        const usersData: ContactItem[] = await usersRes.json();
        setContacts(usersData.filter((u) => u.nickname !== nickname));
      }
    } catch {
      // Backend might be warming up
    }
  };

  const fetchRoomLeaderboardAndHistory = async () => {
    const host = serverHost.trim() || 'localhost:8081';
    try {
      const [boardRes, histRes] = await Promise.all([
        fetch(`http://${host}/api/rooms/${encodeURIComponent(roomId)}/leaderboard`),
        fetch(`http://${host}/api/rooms/${encodeURIComponent(roomId)}/history`),
      ]);
      if (boardRes.ok) {
        setLeaderboardData(await boardRes.json());
      }
      if (histRes.ok) {
        setHistoryData(await histRes.json());
      }
    } catch {
      // Ignore network error
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, [roomId, serverHost, nickname]);

  useEffect(() => {
    if (roomUpdate && roomUpdate.id === roomId) {
      setCurrentRoomInfo(roomUpdate);
      setRoomList((prev) => prev.map((r) => (r.id === roomUpdate.id ? { ...r, ...roomUpdate } : r)));
    }
  }, [roomUpdate, roomId]);

  // Automatically mark unread messages as read when viewing active conversation
  useEffect(() => {
    if (currentView !== 'chat' || !isConnected || messages.length === 0) return;
    const unreadIds = messages
      .filter(
        (m) =>
          m.nickname !== nickname &&
          m.type !== 'system' &&
          !(m.read_by || []).some((r) => r.toLowerCase() === nickname.toLowerCase())
      )
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      markMessagesRead(unreadIds);
    }
  }, [messages, currentView, isConnected, nickname]);

  // Auto-scroll to bottom on incoming messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Synchronize active room last message with roomList preview
  useEffect(() => {
    if (messages.length === 0 || !roomId) return;
    const lastMsg = messages[messages.length - 1];
    setRoomList((prev) => {
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

  // Pulse effect when a game is active
  const isGameActive = gameState && gameState.phase !== 'CHAT';
  useEffect(() => {
    if (isGameActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isGameActive]);

  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const formatRoomPin = (input: string) => {
    let clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.startsWith('POR')) {
      clean = clean.slice(3);
    }
    if (clean.length > 0) {
      return `POR-${clean.slice(0, 5)}`;
    }
    return '';
  };

  // Handle Input in Chat
  const [inputText, setInputText] = useState('');
  const handleInputChange = (text: string) => {
    setInputText(text);
    if (text.trim().length > 0) {
      sendTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => sendTyping(false), 2000);
    } else {
      sendTyping(false);
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    sendTyping(false);

    if (editingMessage) {
      editMessage(editingMessage.id, inputText.trim());
      setEditingMessage(null);
      setInputText('');
      return;
    }

    sendMessage(inputText.trim(), replyingTo?.id);
    setReplyingTo(null);
    setInputText('');
  };

  const handleOpenGameSetup = (mode: 'debate' | 'quiz') => {
    setGameSetupMode(mode);
    const members = currentRoomInfo?.members || [nickname];
    setDebateSideA(nickname);
    const second = members.find((m) => m !== nickname) || '';
    setDebateSideB(second);
    setShowGameSetupModal(true);
  };

  const handleConfirmLaunchGame = () => {
    if (gameSetupMode === 'debate') {
      sendAction('game:start', {
        game_type: 'debate',
        topic: debateTopicInput.trim() || undefined,
        debater_a_id: debateSideA || nickname,
        debater_b_id: debateSideB || undefined,
      });
    } else {
      sendAction('game:start', {
        game_type: 'quiz',
        quiz_category: quizCategory === 'Todas' ? undefined : quizCategory,
        quiz_difficulty: quizDifficulty === 'Todas' ? undefined : quizDifficulty,
        round_count: quizRoundCount,
      });
    }
    setShowGameSetupModal(false);
  };

  const handleCreatePollSubmit = () => {
    const cleanQ = pollQuestion.trim();
    const opts = [pollOptionA.trim(), pollOptionB.trim(), pollOptionC.trim()].filter(Boolean);
    if (cleanQ.length < 3 || opts.length < 2) {
      Alert.alert('Enquete Incompleta', 'Informe uma pergunta e pelo menos 2 opções.');
      return;
    }
    createPoll(cleanQ, opts, pollMultiSelect);
    setPollQuestion('');
    setPollOptionA('');
    setPollOptionB('');
    setPollOptionC('');
    setPollMultiSelect(false);
    setShowCreatePollModal(false);
  };

  // Select a room from list
  const handleSelectRoom = (room: RoomItem) => {
    setRoomId(room.id);
    setCurrentRoomInfo(room);
    setCurrentView('chat');
  };

  // Start 1-on-1 Direct Chat with Contact
  const handleStartDirectChat = async (contact: ContactItem) => {
    const host = serverHost.trim() || 'localhost:8081';
    try {
      const existing = roomList.find(
        (r) => !r.is_group && (r.name === contact.nickname || r.members?.includes(contact.nickname))
      );
      if (existing) {
        handleSelectRoom(existing);
        return;
      }

      const res = await fetch(`http://${host}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contact.nickname,
          is_group: false,
          members: [nickname, contact.nickname],
          created_by: nickname,
        }),
      });

      if (res.ok) {
        const newRoom: RoomItem = await res.json();
        setRoomList((prev) => [newRoom, ...prev]);
        handleSelectRoom(newRoom);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível iniciar a conversa direta.');
    }
  };

  // Create Group Handler
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Nome Obrigatório', 'Por favor, digite um nome para o grupo.');
      return;
    }

    setIsCreatingGroup(true);
    const host = serverHost.trim() || 'localhost:8081';

    try {
      const finalMembers = Array.from(new Set([...selectedContacts, nickname]));
      const res = await fetch(`http://${host}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          is_group: true,
          members: finalMembers,
          created_by: nickname,
        }),
      });

      if (res.ok) {
        const newRoom: RoomItem = await res.json();
        setRoomList((prev) => [newRoom, ...prev]);
        setNewGroupName('');
        setSelectedContacts([]);
        setShowCreateGroupModal(false);
        handleSelectRoom(newRoom);
      } else {
        Alert.alert('Erro', 'Não foi possível criar o grupo.');
      }
    } catch {
      Alert.alert('Erro de Conexão', 'Verifique a conexão com o servidor.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const toggleSelectContact = (nick: string) => {
    setSelectedContacts((prev) =>
      prev.includes(nick) ? prev.filter((n) => n !== nick) : [...prev, nick]
    );
  };

  // Join Room by Code
  const handleJoinByPin = async () => {
    if (!roomPin.trim()) return;
    try {
      const host = serverHost.trim() || 'localhost:8081';
      const clean = roomPin.trim().toUpperCase();
      const res = await fetch(`http://${host}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: clean,
          user: nickname,
        }),
      });
      if (!res.ok) {
        Alert.alert('Código Inválido', 'Nenhum grupo encontrado com este código.');
        return;
      }
      const room: RoomItem = await res.json();
      setRoomList((prev) => {
        if (!prev.some((r) => r.id === room.id)) return [room, ...prev];
        return prev;
      });
      handleSelectRoom(room);
      setRoomPin('');
      setShowRoomCodeModal(false);
    } catch {
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
    }
  };

  const filteredRooms = roomList
    .filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.code.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (activeTab === 'groups') return r.is_group;
      if (activeTab === 'all') return true;
      return false;
    })
    .sort((a, b) => {
      const timeA = new Date(a.last_message_at || a.created_at || 0).getTime();
      const timeB = new Date(b.last_message_at || b.created_at || 0).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return a.name.localeCompare(b.name);
    });

  const filteredContacts = contacts.filter(
    (c) =>
      c.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render a Message Bubble
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.nickname === nickname;
    const isSystem = item.type === 'system';
    const isGameCard = item.type === 'game_card';
    const readCount = (item.read_by || []).filter(
      (r) => r.toLowerCase() !== item.nickname.toLowerCase()
    ).length;

    if (isSystem || isGameCard) {
      return (
        <View style={[styles.systemMessageContainer, isGameCard && styles.gameCardMessageContainer]}>
          <Text style={[styles.systemMessageText, isGameCard && styles.gameCardMessageText]}>
            {item.content}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.otherMessageWrapper]}>
        {!isMe && <Text style={styles.senderName}>{item.nickname}</Text>}
        <TouchableOpacity
          activeOpacity={0.85}
          onLongPress={() => {
            const actions: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [
              { text: 'Reagir: Curtir', onPress: () => sendAction('chat:reaction', { message_id: item.id, emoji: 'LIKED' }) },
              { text: 'Reagir: Concordo', onPress: () => sendAction('chat:reaction', { message_id: item.id, emoji: 'AGREE' }) },
              {
                text: 'Responder',
                onPress: () =>
                  setReplyingTo({
                    id: item.id,
                    nickname: item.nickname,
                    content: item.content,
                  }),
              },
              {
                text: pinnedMessage?.message_id === item.id ? 'Desafixar do Topo' : 'Fixar no Topo',
                onPress: () =>
                  pinnedMessage?.message_id === item.id ? unpinMessage() : pinMessage(item.id),
              },
            ];
            if (isMe && item.type === 'text') {
              actions.push({
                text: 'Editar Mensagem',
                onPress: () => {
                  setEditingMessage({ id: item.id, content: item.content });
                  setInputText(item.content);
                },
              });
            }
            if (isMe) {
              actions.push({
                text: 'Apagar Mensagem',
                style: 'destructive',
                onPress: () => deleteMessage(item.id),
              });
            }
            actions.push({ text: 'Cancelar', style: 'cancel' });

            Alert.alert('Opções da Mensagem', item.content.slice(0, 60), actions);
          }}
          style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}
        >
          {/* Reply Preview */}
          {item.reply_preview && (
            <View style={styles.replyPreviewBox}>
              <Text style={styles.replyPreviewSender}>{item.reply_preview.nickname}</Text>
              <Text style={styles.replyPreviewContent} numberOfLines={1}>
                {item.reply_preview.content}
              </Text>
            </View>
          )}

          {/* Interactive Poll Bubble */}
          {item.poll ? (
            <View style={styles.pollContainer}>
              <Text style={styles.pollBadgeText}>
                {item.poll.is_closed ? 'ENQUETE ENCERRADA' : 'ENQUETE ATIVA'}
              </Text>
              <Text style={styles.pollQuestionText}>{item.poll.question}</Text>
              {item.poll.options.map((opt) => {
                const votes = opt.voter_ids?.length || 0;
                const voted = (opt.voter_ids || []).some(
                  (v) => v.toLowerCase() === nickname.toLowerCase()
                );
                return (
                  <TouchableOpacity
                    key={opt.id}
                    disabled={item.poll?.is_closed}
                    style={[styles.pollOptionBtn, voted && styles.pollOptionBtnActive]}
                    onPress={() => votePoll(item.id, opt.id)}
                  >
                    <Text style={[styles.pollOptionText, voted && styles.pollOptionTextActive]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.pollOptionVotes}>{votes} v</Text>
                  </TouchableOpacity>
                );
              })}
              {!item.poll.is_closed &&
                item.poll.created_by.toLowerCase() === nickname.toLowerCase() && (
                  <TouchableOpacity
                    style={styles.closePollBtn}
                    onPress={() => closePoll(item.id)}
                  >
                    <Text style={styles.closePollBtnText}>Encerrar Enquete</Text>
                  </TouchableOpacity>
                )}
            </View>
          ) : (
            <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
              {item.content}
            </Text>
          )}

          <View style={styles.messageFooterRow}>
            {item.edited_at && <Text style={styles.editedBadgeText}>(editada) </Text>}
            <Text style={styles.messageTimeText}>
              {new Date(item.created_at || Date.now()).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {isMe && (
              <Text
                style={[
                  styles.checkMarkText,
                  readCount === 0 && { color: '#868E96', fontWeight: '600' },
                ]}
              >
                {readCount > 0 ? ` • Lida (${readCount})` : ' • Entregue'}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Reaction Badges on Message */}
        {item.reactions && Object.keys(item.reactions).length > 0 && (
          <View style={[styles.reactionPillsRow, isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
            {Object.entries(item.reactions).map(([emoji, users]) => (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.reactionPill,
                  users.includes(nickname) && styles.reactionPillActive,
                ]}
                onPress={() => sendAction('chat:reaction', { message_id: item.id, emoji })}
              >
                <Text style={styles.reactionPillEmoji}>{emoji}</Text>
                <Text style={styles.reactionPillCount}>{users.length}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ==========================================================================
  // VIEW 1: WHATSAPP HOME (CONVERSAS, GRUPOS, CONTATOS + FAB NOVO GRUPO)
  // ==========================================================================
  if (currentView === 'list') {
    return (
      <SafeAreaView style={styles.container}>
        {!isConnected && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              Sem conexão com o servidor. Reconectando...
            </Text>
          </View>
        )}

        {/* WhatsApp Top Brand Bar */}
        <View style={styles.waHeader}>
          <View style={styles.waBrandRow}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>POR</Text>
            </View>
            <Text style={styles.waTitle}>PORChat</Text>
          </View>

          <View style={styles.waHeaderActions}>
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => {
                setTempNick(nickname);
                setShowProfileModal(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.profileBtnText}>{nickname}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pinCodeBtn}
              onPress={() => setShowRoomCodeModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.pinCodeBtnText}># Entrar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* WhatsApp Navigation Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'all' && styles.activeTabItem]}
            onPress={() => setActiveTab('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === 'all' && styles.activeTabLabel]}>
              Conversas ({roomList.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'groups' && styles.activeTabItem]}
            onPress={() => setActiveTab('groups')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === 'groups' && styles.activeTabLabel]}>
              Grupos ({roomList.filter((r) => r.is_group).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'contacts' && styles.activeTabItem]}
            onPress={() => setActiveTab('contacts')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === 'contacts' && styles.activeTabLabel]}>
              Contatos ({contacts.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              activeTab === 'contacts'
                ? 'Buscar nos contatos...'
                : 'Buscar conversas ou grupos...'
            }
            placeholderTextColor="#888"
          />
        </View>

        {activeTab === 'contacts' ? (
          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.chatListItem}
                onPress={() => handleStartDirectChat(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.chatAvatar, { backgroundColor: item.avatar_color || getAvatarBgColor(item.id || item.nickname) }]}>
                  <Text style={styles.chatAvatarText}>
                    {item.nickname.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.chatInfo}>
                  <View style={styles.chatTitleRow}>
                    <Text style={styles.chatName}>{item.nickname}</Text>
                    <View style={styles.contactBadge}>
                      <Text style={styles.contactBadgeText}>{item.status_text || 'Disponível'}</Text>
                    </View>
                  </View>
                  <Text style={styles.chatPreview}>{item.email}</Text>
                </View>
                <TouchableOpacity
                  style={styles.startDirectBtn}
                  onPress={() => handleStartDirectChat(item)}
                >
                  <Text style={styles.startDirectBtnText}>Conversar</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>Nenhum contato encontrado.</Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={filteredRooms}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            renderItem={({ item }) => {
              const isGroup = item.is_group;
              const isSelected = item.id === roomId;
              return (
                <TouchableOpacity
                  style={[styles.chatListItem, isSelected && styles.chatListItemSelected]}
                  onPress={() => handleSelectRoom(item)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.chatAvatar,
                      { backgroundColor: isGroup ? colors.brand.primary : getAvatarBgColor(item.id) },
                    ]}
                  >
                    <Text style={styles.chatAvatarText}>
                      {item.name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.chatInfo}>
                    <View style={styles.chatTitleRow}>
                      <Text style={styles.chatName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.chatCodeBadge}>{item.code}</Text>
                    </View>
                    <Text style={styles.chatPreview} numberOfLines={1}>
                      {item.last_message ||
                        (isGroup
                          ? `${item.members?.length || 3} participantes • Toque para abrir`
                          : 'Conversa direta • Toque para abrir')}
                    </Text>
                  </View>
                  <Text style={styles.chatArrow}>{'>'}</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>Nenhuma conversa encontrada.</Text>
              </View>
            }
          />
        )}

        {/* Floating Action Button (FAB) - NOVO GRUPO */}
        <Animated.View style={[styles.fabContainer, { transform: [{ scale: fabScaleAnim }] }]}>
          <TouchableOpacity
            style={styles.fabButton}
            onPress={() => setShowCreateGroupModal(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.fabIcon}>+</Text>
            <Text style={styles.fabText}>Novo Grupo</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* MODAL: CRIAR NOVO GRUPO */}
        <Modal
          visible={showCreateGroupModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCreateGroupModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalBackdrop}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Novo Grupo</Text>
                <TouchableOpacity onPress={() => setShowCreateGroupModal(false)}>
                  <Text style={styles.modalCloseX}>Fechar</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Dê um nome ao grupo e escolha os amigos para convidar:
              </Text>

              <TextInput
                style={styles.modalInput}
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder="Nome do grupo (ex: Amigos do Debate)"
                placeholderTextColor="#999"
              />

              <Text style={styles.modalSectionLabel}>Selecione os contatos:</Text>

              <ScrollView style={{ maxHeight: 180, marginBottom: 16 }}>
                {contacts.map((c) => {
                  const isChecked = selectedContacts.includes(c.nickname);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.contactCheckRow, isChecked && styles.contactCheckRowActive]}
                      onPress={() => toggleSelectContact(c.nickname)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.contactAvatarSmall}>
                        <Text style={styles.contactAvatarSmallText}>
                          {c.nickname.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.contactCheckName}>{c.nickname}</Text>
                        <Text style={styles.contactCheckEmail}>{c.email}</Text>
                      </View>
                      <View style={[styles.checkboxBox, isChecked && styles.checkboxBoxActive]}>
                        {isChecked && <Text style={styles.checkboxCheck}>OK</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[styles.primaryModalBtn, isCreatingGroup && { opacity: 0.7 }]}
                onPress={handleCreateGroup}
                disabled={isCreatingGroup}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryModalBtnText}>
                  {isCreatingGroup ? 'Criando Grupo...' : 'Criar Grupo'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* MODAL: PROFILE */}
        <Modal
          visible={showProfileModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowProfileModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Perfil & Conta</Text>
              <Text style={styles.modalSubtitle}>
                Personalize seu apelido, recado de status e biografia:
              </Text>

              <TextInput
                style={[styles.modalInput, { marginTop: 8 }]}
                value={tempNick}
                onChangeText={setTempNick}
                placeholder="Apelido..."
                placeholderTextColor="#999"
              />

              <TextInput
                style={styles.modalInput}
                value={tempStatus}
                onChangeText={setTempStatus}
                placeholder="Status (ex: Pronto para o Debate)"
                placeholderTextColor="#999"
              />

              <TextInput
                style={styles.modalInput}
                value={tempBio}
                onChangeText={setTempBio}
                placeholder="Biografia curta..."
                placeholderTextColor="#999"
              />

              <TouchableOpacity
                style={styles.primaryModalBtn}
                onPress={async () => {
                  if (tempNick.trim()) {
                    await updateMobileProfile({
                      nickname: tempNick.trim(),
                      status_text: tempStatus.trim(),
                      bio: tempBio.trim(),
                    });
                    setNickname(tempNick.trim());
                    setShowProfileModal(false);
                  }
                }}
              >
                <Text style={styles.primaryModalBtnText}>Salvar Perfil</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setShowProfileModal(false)}
              >
                <Text style={styles.closeModalBtnText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL: ROOM PIN CODE */}
        <Modal
          visible={showRoomCodeModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRoomCodeModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Entrar por Código PIN</Text>
              <Text style={styles.modalSubtitle}>Digite o código da sala (ex: POR-1000):</Text>

              <TextInput
                style={[styles.modalInput, styles.pinInput]}
                value={roomPin}
                onChangeText={(t) => setRoomPin(formatRoomPin(t))}
                placeholder="POR-1000"
                placeholderTextColor="#999"
                autoCapitalize="characters"
              />

              <TouchableOpacity style={styles.primaryModalBtn} onPress={handleJoinByPin}>
                <Text style={styles.primaryModalBtnText}>Entrar na Sala</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setShowRoomCodeModal(false)}
              >
                <Text style={styles.closeModalBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ==========================================================================
  // VIEW 2: ACTIVE CONVERSATION / GROUP CHAT FEED
  // ==========================================================================
  const isCurrentGroup = currentRoomInfo?.is_group ?? true;

  return (
    <SafeAreaView style={styles.container}>
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            Sem conexão com o servidor. Reconectando...
          </Text>
        </View>
      )}

      {/* Top Conversation Header */}
      <View style={styles.chatViewHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentView('list')}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>{'< Conversas'}</Text>
        </TouchableOpacity>

        <View style={styles.chatViewTitleBlock}>
          <Text style={styles.chatViewRoomName} numberOfLines={1}>
            {currentRoomInfo?.name || 'Chat da Sala'}
          </Text>
          <Text style={styles.chatViewSubtitle} numberOfLines={1}>
            {isCurrentGroup
              ? `${currentRoomInfo?.members?.join(', ') || 'Participantes'}`
              : 'Conversa Direta'}
          </Text>
        </View>

        {/* Quick Launch Game & Leaderboard Actions */}
        <View style={styles.chatViewActions}>
          <TouchableOpacity
            style={[styles.gameActionMiniBtn, { backgroundColor: '#F3E8FF' }]}
            onPress={() => {
              fetchRoomLeaderboardAndHistory();
              setShowLeaderboardModal(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.gameActionMiniText, { color: colors.brand.primary }]}>Ranking</Text>
          </TouchableOpacity>

          {isCurrentGroup && (
            <>
              <TouchableOpacity
                style={styles.gameActionMiniBtn}
                onPress={() => handleOpenGameSetup('debate')}
                activeOpacity={0.7}
              >
                <Text style={styles.gameActionMiniText}>Debate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.gameActionMiniBtn, { backgroundColor: '#FFF3BF' }]}
                onPress={() => handleOpenGameSetup('quiz')}
                activeOpacity={0.7}
              >
                <Text style={[styles.gameActionMiniText, { color: '#D97706' }]}>Quiz</Text>
              </TouchableOpacity>
            </>
          )}

          {isGameActive && (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={styles.controllerCTA}
                onPress={onOpenController}
                activeOpacity={0.85}
              >
                <Text style={styles.controllerCTAText}>JOGAR</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Pinned Message Banner */}
      {pinnedMessage && (
        <View style={styles.pinnedBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pinnedBannerTitle}>
              Fixado por {pinnedMessage.pinned_by} ({pinnedMessage.sender_nickname}):
            </Text>
            <Text style={styles.pinnedBannerContent} numberOfLines={1}>
              {pinnedMessage.content}
            </Text>
          </View>
          <TouchableOpacity onPress={unpinMessage} style={styles.unpinBtn}>
            <Text style={styles.unpinBtnText}>Desafixar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages Feed */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.chatArea}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyMessagesContainer}>
              <Text style={styles.emptyMessagesTitle}>Nenhuma mensagem ainda</Text>
              <Text style={styles.emptyMessagesSubtitle}>
                Envie uma mensagem, crie uma enquete ou inicie uma partida!
              </Text>
            </View>
          }
          ListFooterComponent={
            Object.keys(typingUsers).length > 0 ? (
              <View style={styles.typingRow}>
                {Object.values(typingUsers).map((u) => (
                  <Text key={u.nickname} style={styles.typingText}>
                    {u.nickname} está digitando...
                  </Text>
                ))}
              </View>
            ) : null
          }
        />

        {/* Reply / Edit Context Bar */}
        {(replyingTo || editingMessage) && (
          <View style={styles.replyContextBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.replyContextTitle}>
                {editingMessage
                  ? 'Editando sua mensagem'
                  : `Respondendo a ${replyingTo?.nickname}`}
              </Text>
              <Text style={styles.replyContextBody} numberOfLines={1}>
                {editingMessage ? editingMessage.content : replyingTo?.content}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setReplyingTo(null);
                setEditingMessage(null);
                setInputText('');
              }}
              style={styles.cancelContextBtn}
            >
              <Text style={styles.cancelContextBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Message Input Bar */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.pollTriggerBtn}
            onPress={() => setShowCreatePollModal(true)}
          >
            <Text style={styles.pollTriggerBtnText}>Enquete</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleInputChange}
            placeholder={
              editingMessage
                ? 'Edite sua mensagem...'
                : `Conversar como ${nickname}...`
            }
            placeholderTextColor="#888"
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend} activeOpacity={0.8}>
            <Text style={styles.sendButtonText}>{editingMessage ? 'Salvar' : 'Enviar'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* MODAL: CRIAR ENQUETE */}
      <Modal
        visible={showCreatePollModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreatePollModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nova Enquete na Sala</Text>
            <Text style={styles.modalSubtitle}>Crie uma votação rápida para o grupo:</Text>

            <TextInput
              style={styles.modalInput}
              value={pollQuestion}
              onChangeText={setPollQuestion}
              placeholder="Pergunta da enquete..."
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.modalInput}
              value={pollOptionA}
              onChangeText={setPollOptionA}
              placeholder="Opção 1"
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.modalInput}
              value={pollOptionB}
              onChangeText={setPollOptionB}
              placeholder="Opção 2"
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.modalInput}
              value={pollOptionC}
              onChangeText={setPollOptionC}
              placeholder="Opção 3 (opcional)"
              placeholderTextColor="#999"
            />

            <TouchableOpacity
              style={[styles.contactCheckRow, pollMultiSelect && styles.contactCheckRowActive]}
              onPress={() => setPollMultiSelect((prev) => !prev)}
            >
              <Text style={styles.contactCheckName}>Permitir múltiplos votos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryModalBtn} onPress={handleCreatePollSubmit}>
              <Text style={styles.primaryModalBtnText}>Publicar Enquete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowCreatePollModal(false)}
            >
              <Text style={styles.closeModalBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: CONFIGURAR PARTIDA (DEBATE / QUIZ) */}
      <Modal
        visible={showGameSetupModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGameSetupModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {gameSetupMode === 'debate' ? 'Configurar Modo Debate' : 'Configurar Quiz Relâmpago'}
            </Text>

            {gameSetupMode === 'debate' ? (
              <View style={{ marginVertical: 10 }}>
                <Text style={styles.modalSectionLabel}>Tema do Debate (opcional):</Text>
                <TextInput
                  style={styles.modalInput}
                  value={debateTopicInput}
                  onChangeText={setDebateTopicInput}
                  placeholder="Deixe em branco para sortear tema..."
                  placeholderTextColor="#999"
                />
                <Text style={styles.modalSectionLabel}>Debatedor Lado A (Coral):</Text>
                <TextInput
                  style={styles.modalInput}
                  value={debateSideA}
                  onChangeText={setDebateSideA}
                  placeholder="Apelido Lado A"
                  placeholderTextColor="#999"
                />
                <Text style={styles.modalSectionLabel}>Debatedor Lado B (Menta):</Text>
                <TextInput
                  style={styles.modalInput}
                  value={debateSideB}
                  onChangeText={setDebateSideB}
                  placeholder="Apelido Lado B"
                  placeholderTextColor="#999"
                />
              </View>
            ) : (
              <View style={{ marginVertical: 10 }}>
                <Text style={styles.modalSectionLabel}>Categoria:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {['Todas', 'Tecnologia', 'Games', 'Ciência', 'História', 'Cultura Pop'].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setQuizCategory(cat)}
                      style={[
                        styles.pinCodeBtn,
                        quizCategory === cat && { backgroundColor: colors.brand.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pinCodeBtnText,
                          quizCategory === cat && { color: '#FFF' },
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.modalSectionLabel}>Dificuldade:</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                  {(['Todas', 'Fácil', 'Média', 'Difícil'] as TriviaDifficulty[]).map((diff) => (
                    <TouchableOpacity
                      key={diff}
                      onPress={() => setQuizDifficulty(diff)}
                      style={[
                        styles.pinCodeBtn,
                        quizDifficulty === diff && { backgroundColor: colors.brand.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pinCodeBtnText,
                          quizDifficulty === diff && { color: '#FFF' },
                        ]}
                      >
                        {diff}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.modalSectionLabel}>Rodadas ({quizRoundCount} perguntas):</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  {[3, 5, 8, 10].map((cnt) => (
                    <TouchableOpacity
                      key={cnt}
                      onPress={() => setQuizRoundCount(cnt)}
                      style={[
                        styles.pinCodeBtn,
                        quizRoundCount === cnt && { backgroundColor: colors.brand.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pinCodeBtnText,
                          quizRoundCount === cnt && { color: '#FFF' },
                        ]}
                      >
                        {cnt}x
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.primaryModalBtn} onPress={handleConfirmLaunchGame}>
              <Text style={styles.primaryModalBtnText}>Iniciar Partida na Sala</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowGameSetupModal(false)}
            >
              <Text style={styles.closeModalBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: RANKING & HISTORICO DA SALA */}
      <Modal
        visible={showLeaderboardModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLeaderboardModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ranking & Histórico da Sala</Text>
            <Text style={styles.modalSubtitle}>Pontuação oficial acumulada em Debates e Quizzes:</Text>

            <ScrollView style={{ maxHeight: 320 }}>
              {leaderboardData.length === 0 ? (
                <Text style={styles.emptyStateText}>Nenhuma partida finalizada nesta sala ainda.</Text>
              ) : (
                leaderboardData.map((entry, idx) => (
                  <View key={entry.user_id} style={styles.contactCheckRow}>
                    <View style={styles.contactAvatarSmall}>
                      <Text style={styles.contactAvatarSmallText}>#{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactCheckName}>{entry.nickname}</Text>
                      <Text style={styles.contactCheckEmail}>
                        {entry.debates_won} vitórias Debate • {entry.quiz_wins} vitórias Quiz
                      </Text>
                    </View>
                    <Text style={{ fontWeight: '900', color: colors.brand.primary }}>
                      {entry.total_points} pts
                    </Text>
                  </View>
                ))
              )}

              {historyData.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.modalSectionLabel}>Últimas Partidas:</Text>
                  {historyData.slice(0, 5).map((m) => (
                    <View key={m.id} style={styles.contactCheckRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.contactCheckName}>{m.title}</Text>
                        <Text style={styles.contactCheckEmail}>
                          Vencedor: {m.winner_nickname}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.primaryModalBtn, { marginTop: 12 }]}
              onPress={() => setShowLeaderboardModal(false)}
            >
              <Text style={styles.primaryModalBtnText}>Fechar Ranking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  waHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  waBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.brand.primary,
    borderRadius: 8,
  },
  logoBadgeText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  waTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2D3436',
  },
  waHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F0EFFE',
    borderRadius: 14,
  },
  profileBtnText: {
    color: colors.brand.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  pinCodeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F1F3F5',
    borderRadius: 14,
  },
  pinCodeBtnText: {
    color: '#495057',
    fontWeight: '700',
    fontSize: 12,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: colors.brand.primary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#868E96',
  },
  activeTabLabel: {
    color: colors.brand.primary,
    fontWeight: '800',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
    color: '#2D3436',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  chatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F3F5',
    elevation: 1,
  },
  chatListItemSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: '#FBFBFF',
  },
  chatAvatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2D3436',
    flex: 1,
    marginRight: 6,
  },
  chatCodeBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.brand.primary,
    backgroundColor: '#F0EFFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chatPreview: {
    fontSize: 12,
    color: '#868E96',
  },
  chatArrow: {
    fontSize: 16,
    color: '#CED4DA',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  contactBadge: {
    backgroundColor: '#E6FCF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  contactBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0CA678',
  },
  startDirectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.brand.primary,
    borderRadius: 12,
  },
  startDirectBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 11,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#868E96',
    fontSize: 13,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    elevation: 6,
  },
  fabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 8,
  },
  fabIcon: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  fabText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
  chatViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand.primary,
  },
  chatViewTitleBlock: {
    flex: 1,
    marginLeft: 4,
  },
  chatViewRoomName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D3436',
  },
  chatViewSubtitle: {
    fontSize: 10,
    color: '#868E96',
  },
  chatViewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gameActionMiniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#FFE3E3',
    borderRadius: 12,
  },
  gameActionMiniText: {
    color: colors.brand.action,
    fontWeight: '800',
    fontSize: 10,
  },
  controllerCTA: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.brand.action,
    borderRadius: 14,
  },
  controllerCTAText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0EFFE',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DCD6F7',
  },
  pinnedBannerTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.brand.primary,
  },
  pinnedBannerContent: {
    fontSize: 12,
    color: '#2D3436',
  },
  unpinBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFE3E3',
    borderRadius: 8,
    marginLeft: 8,
  },
  unpinBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.brand.action,
  },
  chatArea: {
    flex: 1,
  },
  messageList: {
    padding: 16,
    gap: 10,
  },
  systemMessageContainer: {
    alignSelf: 'center',
    backgroundColor: '#E9ECEF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginVertical: 4,
  },
  gameCardMessageContainer: {
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: colors.brand.reward,
  },
  systemMessageText: {
    fontSize: 11,
    color: '#495057',
    fontWeight: '600',
  },
  gameCardMessageText: {
    color: colors.brand.reward,
    fontWeight: 'bold',
  },
  messageWrapper: {
    maxWidth: '82%',
    marginVertical: 2,
  },
  myMessageWrapper: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherMessageWrapper: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.brand.primary,
    marginBottom: 2,
    marginLeft: 6,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: '#E7FFDB',
    borderWidth: 1,
    borderColor: '#D0F0C0',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderBottomLeftRadius: 4,
  },
  replyPreviewBox: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderLeftWidth: 3,
    borderLeftColor: colors.brand.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  replyPreviewSender: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.brand.primary,
  },
  replyPreviewContent: {
    fontSize: 11,
    color: '#495057',
  },
  pollContainer: {
    minWidth: 210,
    paddingVertical: 4,
  },
  pollBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.brand.primary,
    marginBottom: 4,
  },
  pollQuestionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2D3436',
    marginBottom: 8,
  },
  pollOptionBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 5,
  },
  pollOptionBtnActive: {
    backgroundColor: '#F0EFFE',
    borderColor: colors.brand.primary,
  },
  pollOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D3436',
  },
  pollOptionTextActive: {
    color: colors.brand.primary,
    fontWeight: '800',
  },
  pollOptionVotes: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#868E96',
  },
  closePollBtn: {
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  closePollBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.brand.action,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 19,
  },
  myMessageText: {
    color: '#1C3829',
  },
  otherMessageText: {
    color: '#2D3436',
  },
  replyContextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F3F5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#DEE2E6',
  },
  replyContextTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.brand.primary,
  },
  replyContextBody: {
    fontSize: 12,
    color: '#495057',
  },
  cancelContextBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelContextBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.brand.action,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    gap: 8,
  },
  pollTriggerBtn: {
    backgroundColor: '#F0EFFE',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 16,
  },
  pollTriggerBtnText: {
    color: colors.brand.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontSize: 14,
    color: '#2D3436',
  },
  sendButton: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
  },
  sendButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  modalCloseX: {
    fontSize: 13,
    color: '#868E96',
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#868E96',
    marginTop: 4,
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#2D3436',
    marginBottom: 10,
  },
  pinInput: {
    letterSpacing: 2,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 6,
  },
  contactCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F3F5',
    marginBottom: 6,
    backgroundColor: '#FAFAFA',
  },
  contactCheckRowActive: {
    borderColor: colors.brand.primary,
    backgroundColor: '#F0EFFE',
  },
  contactAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  contactAvatarSmallText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  contactCheckName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  contactCheckEmail: {
    fontSize: 11,
    color: '#868E96',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CED4DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primary,
  },
  checkboxCheck: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  primaryModalBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryModalBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  closeModalBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeModalBtnText: {
    color: '#868E96',
    fontWeight: '600',
    fontSize: 13,
  },
  messageFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 3,
  },
  editedBadgeText: {
    fontSize: 9,
    fontStyle: 'italic',
    color: '#868E96',
  },
  messageTimeText: {
    fontSize: 10,
    color: '#868E96',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  checkMarkText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.brand.primary,
  },
  typingRow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginVertical: 4,
  },
  typingText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
  offlineBanner: {
    backgroundColor: '#F59E0B',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBannerText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  reactionPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#F1F3F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  reactionPillActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#C4B5FD',
  },
  reactionPillEmoji: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.brand.primary,
  },
  reactionPillCount: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  emptyMessagesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 60,
  },
  emptyMessagesTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 4,
  },
  emptyMessagesSubtitle: {
    fontSize: 12,
    color: '#868E96',
    textAlign: 'center',
    maxWidth: 240,
  },
});
