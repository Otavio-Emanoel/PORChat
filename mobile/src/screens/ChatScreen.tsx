import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Alert,
  Image,
  ActivityIndicator,
  Keyboard,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useWebSocketContext } from '../context/WebSocketContext';
import { colors } from '../theme/colors';
import { AvatarBadge } from '../components/AvatarBadge';
import { AttachmentModals } from '../components/AttachmentModals';
import { ChatListView } from '../components/ChatListView';
import { ChatMessageItem } from '../components/ChatMessageItem';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { CreatePollModal } from '../components/CreatePollModal';
import { FloatingReaction } from '../components/FloatingReaction';
import { GameSetupModal } from '../components/GameSetupModal';
import { LeaderboardModal } from '../components/LeaderboardModal';
import { MessageActionSheet } from '../components/MessageActionSheet';
import { ProfileModal } from '../components/ProfileModal';
import { ReplyPreviewContent } from '../components/ReplyPreviewContent';
import { RoomCodeModal } from '../components/RoomCodeModal';
import { RoomInfoModal } from '../components/RoomInfoModal';
import type {
  ChatMessage,
  RoomLeaderboardEntry,
  MatchHistoryRecord,
  TriviaDifficulty,
} from '../types';
import {
  getAvatarBgColor,
  getMobileReplyPreviewMeta,
  type ContactItem,
  type PendingAttachment,
  type ReplyTarget,
  type RoomItem,
} from '../utils/chatHelpers';

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
    userProfile,
    roomId,
    setRoomId,
    serverHost,
    sendAction,
    updateMobileProfile,
    uploadAttachment,
    logout,
  } = useWebSocketContext();

  // Attachments & Media State
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [fullscreenImageUri, setFullscreenImageUri] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

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
  const [tempAvatarColor, setTempAvatarColor] = useState('#6C5CE7');
  const [tempAvatarUrl, setTempAvatarUrl] = useState('');

  // In-Chat Search State
  const [isChatSearchActive, setIsChatSearchActive] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  // Room Info Modal State
  const [showRoomInfoModal, setShowRoomInfoModal] = useState(false);

  // Room PIN Form
  const [roomPin, setRoomPin] = useState('');

  // Create Poll Form
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
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

  // Safe Area Insets
  const insets = useSafeAreaInsets();

  // Floating Reactions State
  const [floatingReactions, setFloatingReactions] = useState<
    { id: string; emoji: string; startX: number }[]
  >([]);

  // Reply & Edit State
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [selectedMessageForActions, setSelectedMessageForActions] = useState<ChatMessage | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Animations & Refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fabScaleAnim = useRef(new Animated.Value(1)).current;
  const replyBarAnim = useRef(new Animated.Value(0)).current;
  const sendScaleAnim = useRef(new Animated.Value(1)).current;
  const actionSheetScaleAnim = useRef(new Animated.Value(0.85)).current;
  const actionSheetOpacityAnim = useRef(new Animated.Value(0)).current;
  const actionSheetTranslateAnim = useRef(new Animated.Value(35)).current;
  const flatListRef = useRef<FlatList>(null);

  // Animate Reply / Edit Context Bar
  useEffect(() => {
    if (replyingTo || editingMessage) {
      replyBarAnim.setValue(0);
      Animated.spring(replyBarAnim, {
        toValue: 1,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }).start();
    } else {
      replyBarAnim.setValue(0);
    }
  }, [replyingTo, editingMessage]);

  // Animate Action Sheet on Message Long Press
  useEffect(() => {
    if (selectedMessageForActions) {
      actionSheetScaleAnim.setValue(0.85);
      actionSheetOpacityAnim.setValue(0);
      actionSheetTranslateAnim.setValue(35);
      Animated.parallel([
        Animated.spring(actionSheetScaleAnim, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
        Animated.timing(actionSheetOpacityAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(actionSheetTranslateAnim, { toValue: 0, friction: 6, tension: 70, useNativeDriver: true }),
      ]).start();
    }
  }, [selectedMessageForActions]);

  // Auto-scroll when keyboard opens
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    return () => showSub.remove();
  }, []);

  const spawnFloatingReaction = (emoji: string) => {
    const screenWidth = Dimensions.get('window').width;
    const randomX = Math.floor(Math.random() * (screenWidth - 120)) + 60;
    const newId = `${Date.now()}_${Math.random()}`;
    setFloatingReactions((prev) => [...prev, { id: newId, emoji, startX: randomX }]);
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

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle Input in Chat
  const [inputText, setInputText] = useState('');

  // Animate Send Button when message becomes sendable
  const hasSendableContent = Boolean(inputText.trim() || pendingAttachment);
  useEffect(() => {
    if (hasSendableContent) {
      Animated.sequence([
        Animated.timing(sendScaleAnim, { toValue: 1.15, duration: 90, useNativeDriver: true }),
        Animated.spring(sendScaleAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [hasSendableContent, sendScaleAnim]);
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

  const handlePickImage = async () => {
    setShowAttachmentMenu(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão Necessária', 'Precisamos de acesso às fotos para enviar imagens.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64 = asset.base64;
        const mimeType = asset.mimeType || 'image/jpeg';

        if (!base64 && asset.uri) {
          base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        if (!base64) {
          Alert.alert('Erro', 'Não foi possível ler os dados da imagem selecionada.');
          return;
        }

        const dataBase64 = `data:${mimeType};base64,${base64}`;
        const fileName = asset.fileName || `foto_${Date.now()}.jpg`;
        const sizeKb = Math.round((base64.length * 0.75) / 1024);
        const sizeFormatted = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

        setPendingAttachment({
          kind: 'image',
          name: fileName,
          mimeType,
          dataBase64,
          sizeFormatted,
          uri: asset.uri,
        });
      }
    } catch {
      Alert.alert('Erro', 'Ocorreu um erro ao acessar a galeria de imagens.');
    }
  };

  const handleTakePhoto = async () => {
    setShowAttachmentMenu(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão Necessária', 'Precisamos de acesso à câmera para tirar fotos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64 = asset.base64;
        const mimeType = asset.mimeType || 'image/jpeg';

        if (!base64 && asset.uri) {
          base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        if (!base64) {
          Alert.alert('Erro', 'Não foi possível ler os dados da foto capturada.');
          return;
        }

        const dataBase64 = `data:${mimeType};base64,${base64}`;
        const fileName = `camera_${Date.now()}.jpg`;
        const sizeKb = Math.round((base64.length * 0.75) / 1024);
        const sizeFormatted = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

        setPendingAttachment({
          kind: 'image',
          name: fileName,
          mimeType,
          dataBase64,
          sizeFormatted,
          uri: asset.uri,
        });
      }
    } catch {
      Alert.alert('Erro na Câmera', 'Não foi possível capturar a foto.');
    }
  };

  const handlePickDocument = async () => {
    setShowAttachmentMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const mimeType = file.mimeType || 'application/octet-stream';
        const dataBase64 = `data:${mimeType};base64,${base64}`;
        const sizeKb = file.size ? Math.round(file.size / 1024) : Math.round((base64.length * 0.75) / 1024);
        const sizeFormatted = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

        setPendingAttachment({
          kind: 'document',
          name: file.name,
          mimeType,
          dataBase64,
          sizeFormatted,
          uri: file.uri,
        });
      }
    } catch {
      Alert.alert('Erro ao Escolher Documento', 'Não foi possível carregar o arquivo.');
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() && !pendingAttachment) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    sendTyping(false);

    if (editingMessage) {
      editMessage(editingMessage.id, inputText.trim());
      setEditingMessage(null);
      setInputText('');
      return;
    }

    if (pendingAttachment) {
      setIsUploadingAttachment(true);
      try {
        const res = await uploadAttachment({
          kind: pendingAttachment.kind,
          file_name: pendingAttachment.name,
          mime_type: pendingAttachment.mimeType,
          data_base64: pendingAttachment.dataBase64,
          caption: inputText.trim() || undefined,
          reply_to_id: replyingTo?.id,
        });
        if (!res) {
          Alert.alert('Erro ao Enviar', 'Não foi possível enviar o anexo. Tente novamente.');
        } else {
          setPendingAttachment(null);
          setInputText('');
          setReplyingTo(null);
        }
      } catch {
        Alert.alert('Erro ao Enviar', 'Falha na conexão ao enviar o anexo.');
      } finally {
        setIsUploadingAttachment(false);
      }
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

  const handleAddPollOption = () => {
    if (pollOptions.length >= 8) {
      Alert.alert('Limite Atingido', 'Uma enquete pode ter no máximo 8 opções.');
      return;
    }
    setPollOptions((prev) => [...prev, '']);
  };

  const handleRemovePollOption = (index: number) => {
    if (pollOptions.length <= 2) {
      Alert.alert('Mínimo Necessário', 'Uma enquete precisa de pelo menos 2 opções.');
      return;
    }
    setPollOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePollOptionChange = (index: number, text: string) => {
    setPollOptions((prev) => prev.map((item, i) => (i === index ? text : item)));
  };

  const handleCreatePollSubmit = () => {
    const cleanQ = pollQuestion.trim();
    const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (cleanQ.length < 3) {
      Alert.alert('Pergunta Inválida', 'Informe uma pergunta de pelo menos 3 caracteres.');
      return;
    }
    if (opts.length < 2) {
      Alert.alert('Opções Insuficientes', 'Informe pelo menos 2 opções válidas para a enquete.');
      return;
    }
    createPoll(cleanQ, opts, pollMultiSelect);
    setPollQuestion('');
    setPollOptions(['', '']);
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

  // ==========================================================================
  // VIEW 1: WHATSAPP HOME (CONVERSAS, GRUPOS, CONTATOS + FAB NOVO GRUPO)
  // ==========================================================================
  if (currentView === 'list') {
    return (
      <>
        <ChatListView
          topInset={insets.top}
          bottomInset={insets.bottom}
          isConnected={isConnected}
          nickname={nickname}
          userProfile={userProfile}
          roomId={roomId}
          roomList={roomList}
          filteredRooms={filteredRooms}
          contacts={contacts}
          filteredContacts={filteredContacts}
          activeTab={activeTab}
          searchQuery={searchQuery}
          isRefreshing={isRefreshing}
          fabScaleAnim={fabScaleAnim}
          onSetActiveTab={setActiveTab}
          onSetSearchQuery={setSearchQuery}
          onRefresh={handleRefresh}
          onOpenProfile={() => {
            setTempNick(nickname);
            setTempStatus(userProfile?.status_text || 'Disponível no PORChat');
            setTempBio(userProfile?.bio || '');
            setTempAvatarColor(userProfile?.avatar_color || '#6C5CE7');
            setTempAvatarUrl(userProfile?.avatar_url || '');
            setShowProfileModal(true);
          }}
          onOpenRoomCode={() => setShowRoomCodeModal(true)}
          onLogout={logout}
          onSelectRoom={handleSelectRoom}
          onStartDirectChat={handleStartDirectChat}
          onOpenCreateGroup={() => setShowCreateGroupModal(true)}
        />

        <CreateGroupModal
          visible={showCreateGroupModal}
          newGroupName={newGroupName}
          contacts={contacts}
          selectedContacts={selectedContacts}
          isCreatingGroup={isCreatingGroup}
          onChangeGroupName={setNewGroupName}
          onToggleContact={toggleSelectContact}
          onSubmit={handleCreateGroup}
          onClose={() => setShowCreateGroupModal(false)}
        />

        <ProfileModal
          visible={showProfileModal}
          currentNickname={nickname}
          tempNick={tempNick}
          tempStatus={tempStatus}
          tempBio={tempBio}
          tempAvatarColor={tempAvatarColor}
          tempAvatarUrl={tempAvatarUrl}
          onChangeNick={setTempNick}
          onChangeStatus={setTempStatus}
          onChangeBio={setTempBio}
          onChangeAvatarColor={setTempAvatarColor}
          onChangeAvatarUrl={setTempAvatarUrl}
          onSave={async () => {
            if (tempNick.trim()) {
              await updateMobileProfile({
                nickname: tempNick.trim(),
                avatar_color: tempAvatarColor,
                avatar_url: tempAvatarUrl.trim(),
                status_text: tempStatus.trim(),
                bio: tempBio.trim(),
              });
              setNickname(tempNick.trim());
              setShowProfileModal(false);
              fetchData();
            }
          }}
          onLogout={logout}
          onClose={() => setShowProfileModal(false)}
        />

        <RoomCodeModal
          visible={showRoomCodeModal}
          roomPin={roomPin}
          onChangeRoomPin={setRoomPin}
          onJoin={handleJoinByPin}
          onClose={() => setShowRoomCodeModal(false)}
        />
      </>
    );
  }

  // ==========================================================================
  // VIEW 2: ACTIVE CONVERSATION / GROUP CHAT FEED
  // ==========================================================================
  const isCurrentGroup = currentRoomInfo?.is_group ?? true;
  const displayedMessages = chatSearchQuery.trim()
    ? messages.filter(
        (m) =>
          (m.content && m.content.toLowerCase().includes(chatSearchQuery.toLowerCase())) ||
          (m.nickname && m.nickname.toLowerCase().includes(chatSearchQuery.toLowerCase()))
      )
    : messages;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            Sem conexão com o servidor. Reconectando...
          </Text>
        </View>
      )}

      {/* Top Conversation Header */}
      <View
        style={[
          styles.chatViewHeader,
          {
            paddingTop: Math.max(
              insets.top,
              Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 12
            ),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setIsChatSearchActive(false);
            setChatSearchQuery('');
            setCurrentView('list');
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.brand.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.chatViewTitleBlock}
          onPress={() => setShowRoomInfoModal(true)}
          activeOpacity={0.8}
        >
          <AvatarBadge
            name={currentRoomInfo?.name || 'Chat'}
            color={isCurrentGroup ? colors.brand.primary : getAvatarBgColor(roomId)}
            avatarUrl={currentRoomInfo?.avatar_url}
            size={36}
            rounded={false}
          />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.chatViewRoomName} numberOfLines={1}>
              {currentRoomInfo?.name || 'Chat da Sala'}
            </Text>
            <Text style={styles.chatViewSubtitle} numberOfLines={1}>
              {isCurrentGroup
                ? `${currentRoomInfo?.members?.length || 0} participantes • Toque p/ info`
                : 'Conversa Direta • Toque p/ info'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Quick Launch Game, Search & Leaderboard Actions */}
        <View style={styles.chatViewActions}>
          <TouchableOpacity
            style={[
              styles.headerSearchIconBtn,
              isChatSearchActive && styles.headerSearchIconBtnActive,
            ]}
            onPress={() => {
              setIsChatSearchActive((prev) => !prev);
              if (isChatSearchActive) setChatSearchQuery('');
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isChatSearchActive ? 'close' : 'search-outline'}
              size={18}
              color={isChatSearchActive ? '#FFF' : colors.ink.main}
            />
          </TouchableOpacity>

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

      {/* In-Chat Search Bar */}
      {isChatSearchActive && (
        <View style={styles.inChatSearchBar}>
          <Ionicons name="search" size={16} color="#868E96" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.inChatSearchInput}
            value={chatSearchQuery}
            onChangeText={setChatSearchQuery}
            placeholder="Buscar mensagens na conversa..."
            placeholderTextColor="#888"
            autoFocus
          />
          {Boolean(chatSearchQuery) && (
            <TouchableOpacity onPress={() => setChatSearchQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={18} color="#868E96" />
            </TouchableOpacity>
          )}
        </View>
      )}

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

      {/* Messages Feed & Interactive Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={
          Platform.OS === 'ios' ? Math.max(insets.top, 20) + 54 : 0
        }
        style={styles.chatArea}
      >
        <FlatList
          ref={flatListRef}
          data={displayedMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatMessageItem
              item={item}
              allMessages={messages}
              nickname={nickname}
              serverHost={serverHost}
              playingAudioId={playingAudioId}
              onLongPress={setSelectedMessageForActions}
              onPressReplyJump={(replyMessageId) => {
                const targetIndex = displayedMessages.findIndex((m) => m.id === replyMessageId);
                if (targetIndex >= 0) {
                  flatListRef.current?.scrollToIndex({ index: targetIndex, animated: true });
                }
              }}
              onVotePoll={votePoll}
              onClosePoll={closePoll}
              onOpenImage={setFullscreenImageUri}
              onToggleAudio={(messageId) =>
                setPlayingAudioId((prev) => (prev === messageId ? null : messageId))
              }
              onReact={(messageId, key, emoji) => {
                spawnFloatingReaction(emoji);
                sendAction('chat:reaction', { message_id: messageId, emoji: key });
              }}
            />
          )}
          contentContainerStyle={[styles.messageList, { paddingBottom: 16 }]}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => {
            if (!chatSearchQuery.trim()) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          ListEmptyComponent={
            chatSearchQuery.trim() ? (
              <View style={styles.emptyMessagesContainer}>
                <Ionicons name="search-outline" size={32} color="#CED4DA" />
                <Text style={styles.emptyMessagesTitle}>Nenhuma mensagem encontrada</Text>
                <Text style={styles.emptyMessagesSubtitle}>
                  Não encontramos nada com o termo "{chatSearchQuery}".
                </Text>
              </View>
            ) : (
              <View style={styles.emptyMessagesContainer}>
                <Text style={styles.emptyMessagesTitle}>Nenhuma mensagem ainda</Text>
                <Text style={styles.emptyMessagesSubtitle}>
                  Envie uma mensagem, crie uma enquete ou inicie uma partida!
                </Text>
              </View>
            )
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
            ) : undefined
          }
        />

        {/* Reply / Edit Context Bar with Smooth Spring Animation */}
        {(replyingTo || editingMessage) && (() => {
          const replyMeta = replyingTo ? getMobileReplyPreviewMeta(replyingTo, serverHost) : null;

          return (
            <Animated.View
              style={[
                styles.replyContextBar,
                {
                  opacity: replyBarAnim,
                  transform: [
                    {
                      translateY: replyBarAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [24, 0],
                      }),
                    },
                    {
                      scale: replyBarAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.96, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.replyContextInnerRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.replyContextTitle}>
                    {editingMessage
                      ? 'Editando sua mensagem'
                      : `Respondendo a ${replyingTo?.nickname}`}
                  </Text>
                  <View style={styles.replyPreviewContentRow}>
                    {editingMessage ? (
                      <Text style={styles.replyContextBody} numberOfLines={1}>
                        {editingMessage.content}
                      </Text>
                    ) : replyMeta ? (
                      <ReplyPreviewContent meta={replyMeta} iconSize={13} textVariant="bar" />
                    ) : null}
                  </View>
                </View>
                {replyMeta?.kind === 'image' && replyMeta.imageUri ? (
                  <Image
                    source={{ uri: replyMeta.imageUri }}
                    style={styles.replyContextThumbnail}
                    resizeMode="cover"
                  />
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => {
                  setReplyingTo(null);
                  setEditingMessage(null);
                  setInputText('');
                }}
                style={styles.cancelContextBtn}
              >
                <Ionicons name="close" size={18} color="#636E72" />
              </TouchableOpacity>
            </Animated.View>
          );
        })()}

        {/* Pending Attachment Preview Bar */}
        {pendingAttachment && (
          <View style={styles.pendingAttachmentCard}>
            {pendingAttachment.kind === 'image' && pendingAttachment.uri ? (
              <Image source={{ uri: pendingAttachment.uri }} style={styles.pendingImageThumbnail} />
            ) : (
              <View style={styles.pendingFileIcon}>
                <Ionicons
                  name={pendingAttachment.kind === 'image' ? 'image' : 'document-text'}
                  size={20}
                  color={colors.brand.primary}
                />
              </View>
            )}
            <View style={{ flex: 1, marginHorizontal: 8 }}>
              <Text style={styles.pendingFileName} numberOfLines={1}>
                {pendingAttachment.name}
              </Text>
              <Text style={styles.pendingFileSize}>
                {pendingAttachment.sizeFormatted} • Toque em Enviar para compartilhar
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setPendingAttachment(null)}
              style={styles.pendingRemoveBtn}
            >
              <Ionicons name="close-circle" size={20} color="#FF7675" />
            </TouchableOpacity>
          </View>
        )}

        {/* Message Input Bar with Safe Area Bottom */}
        <View
          style={[
            styles.inputContainer,
            {
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.attachTriggerBtn}
            onPress={() => setShowAttachmentMenu(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={22} color={colors.brand.primary} />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleInputChange}
            placeholder={
              isUploadingAttachment
                ? 'Enviando anexo...'
                : pendingAttachment
                ? 'Adicionar legenda ao anexo...'
                : editingMessage
                ? 'Edite sua mensagem...'
                : `Conversar como ${nickname}...`
            }
            placeholderTextColor="#888"
            editable={!isUploadingAttachment}
          />

          <Animated.View style={{ transform: [{ scale: sendScaleAnim }] }}>
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() && !pendingAttachment) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              activeOpacity={0.8}
              disabled={(!inputText.trim() && !pendingAttachment) || isUploadingAttachment}
            >
              {isUploadingAttachment ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="send" size={16} color="#FFF" />
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      <CreatePollModal
        visible={showCreatePollModal}
        pollQuestion={pollQuestion}
        pollOptions={pollOptions}
        pollMultiSelect={pollMultiSelect}
        onChangeQuestion={setPollQuestion}
        onAddOption={handleAddPollOption}
        onRemoveOption={handleRemovePollOption}
        onChangeOption={handlePollOptionChange}
        onToggleMultiSelect={() => setPollMultiSelect((prev) => !prev)}
        onSubmit={handleCreatePollSubmit}
        onClose={() => setShowCreatePollModal(false)}
      />

      <GameSetupModal
        visible={showGameSetupModal}
        mode={gameSetupMode}
        debateTopic={debateTopicInput}
        debateSideA={debateSideA}
        debateSideB={debateSideB}
        quizCategory={quizCategory}
        quizDifficulty={quizDifficulty}
        quizRoundCount={quizRoundCount}
        onChangeDebateTopic={setDebateTopicInput}
        onChangeDebateSideA={setDebateSideA}
        onChangeDebateSideB={setDebateSideB}
        onChangeQuizCategory={setQuizCategory}
        onChangeQuizDifficulty={setQuizDifficulty}
        onChangeQuizRoundCount={setQuizRoundCount}
        onLaunch={handleConfirmLaunchGame}
        onClose={() => setShowGameSetupModal(false)}
      />

      <LeaderboardModal
        visible={showLeaderboardModal}
        leaderboardData={leaderboardData}
        historyData={historyData}
        onClose={() => setShowLeaderboardModal(false)}
      />

      <MessageActionSheet
        selectedMessage={selectedMessageForActions}
        nickname={nickname}
        pinnedMessage={pinnedMessage}
        bottomInset={insets.bottom}
        scaleAnim={actionSheetScaleAnim}
        opacityAnim={actionSheetOpacityAnim}
        translateAnim={actionSheetTranslateAnim}
        onClose={() => setSelectedMessageForActions(null)}
        onReact={(messageId, key, emoji) => {
          spawnFloatingReaction(emoji);
          sendAction('chat:reaction', { message_id: messageId, emoji: key });
        }}
        onReply={setReplyingTo}
        onTogglePin={(messageId) => {
          if (pinnedMessage?.message_id === messageId) {
            unpinMessage();
          } else {
            pinMessage(messageId);
          }
        }}
        onEdit={(msg) => {
          setEditingMessage(msg);
          setInputText(msg.content);
        }}
        onDelete={deleteMessage}
      />

      <RoomInfoModal
        visible={showRoomInfoModal}
        roomId={roomId}
        roomInfo={currentRoomInfo}
        nickname={nickname}
        onClose={() => setShowRoomInfoModal(false)}
      />

      <AttachmentModals
        showAttachmentMenu={showAttachmentMenu}
        onCloseAttachmentMenu={() => setShowAttachmentMenu(false)}
        onPickImage={handlePickImage}
        onTakePhoto={handleTakePhoto}
        onPickDocument={handlePickDocument}
        onOpenCreatePoll={() => setShowCreatePollModal(true)}
        fullscreenImageUri={fullscreenImageUri}
        onCloseFullscreenImage={() => setFullscreenImageUri(null)}
        topInset={insets.top}
      />

      {/* Floating Reactions Layer */}
      {floatingReactions.map((fr) => (
        <FloatingReaction
          key={fr.id}
          id={fr.id}
          emoji={fr.emoji}
          startX={fr.startX}
          onComplete={(id) => {
            setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
          }}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
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
  replyPreviewContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
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
    borderLeftWidth: 4,
    borderLeftColor: colors.brand.primary,
  },
  replyContextInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  replyContextThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginLeft: 8,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    gap: 8,
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
  inChatSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  inChatSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#2D3436',
  },
  headerSearchIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSearchIconBtnActive: {
    backgroundColor: colors.brand.primary,
  },
  pendingAttachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginHorizontal: 10,
    marginBottom: 4,
    backgroundColor: '#F0EFFE',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCD6F7',
  },
  pendingImageThumbnail: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  pendingFileIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingFileName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand.primary,
  },
  pendingFileSize: {
    fontSize: 10,
    color: '#636E72',
    marginTop: 1,
  },
  pendingRemoveBtn: {
    padding: 4,
  },
  attachTriggerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EFFE',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
