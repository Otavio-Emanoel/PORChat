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
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useWebSocketContext } from '../context/WebSocketContext';
import { colors } from '../theme/colors';
import type {
  ChatMessage,
  MessageAttachment,
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
  avatar_url?: string;
  avatar_color?: string;
}

interface ContactItem {
  id: string;
  nickname: string;
  email: string;
  avatar_url?: string;
  avatar_color?: string;
  status_text?: string;
  bio?: string;
}

interface PendingAttachment {
  kind: 'image' | 'document' | 'audio';
  name: string;
  mimeType: string;
  dataBase64: string;
  sizeFormatted: string;
  uri?: string;
}

const AVATAR_COLOR_OPTIONS = [
  { id: 'violet', bg: '#6C5CE7', label: 'Violeta' },
  { id: 'coral', bg: '#FF7675', label: 'Coral' },
  { id: 'mint', bg: '#00CEC9', label: 'Menta' },
  { id: 'amber', bg: '#F59E0B', label: 'Âmbar' },
  { id: 'blue', bg: '#3B82F6', label: 'Azul' },
  { id: 'emerald', bg: '#10B981', label: 'Esmeralda' },
  { id: 'indigo', bg: '#6366F1', label: 'Índigo' },
  { id: 'slate', bg: '#475569', label: 'Grafite' },
];

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=160&q=80',
];

const STATUS_PRESETS = [
  'Disponível no PORChat',
  'Pronto para o Debate',
  'Online no mobile',
  'No comando da TV',
  'Modo Focado',
  'Apenas Ouvindo',
];

const POLL_PALETTE = [
  { fill: '#FFEAE8', border: '#FF6B6B', text: '#D63031', bar: '#FF7675' }, // Option A (Coral)
  { fill: '#E0F9F8', border: '#00CEC9', text: '#009692', bar: '#00CEC9' }, // Option B (Mint)
  { fill: '#FFF5DB', border: '#FECA57', text: '#B8860B', bar: '#FDCB6E' }, // Option C (Yellow)
  { fill: '#E2FBF3', border: '#1DD1A1', text: '#10AC84', bar: '#1DD1A1' }, // Option D (Emerald)
  { fill: '#EFEBFD', border: '#6C5CE7', text: '#5542D0', bar: '#6C5CE7' }, // Option E (Violet)
];

const REACTION_CONFIG: Record<
  string,
  {
    iconName: keyof typeof Ionicons.glyphMap;
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  like: { iconName: 'thumbs-up', label: 'Curtir', color: '#0984E3', bgColor: '#E8F4FD' },
  heart: { iconName: 'heart', label: 'Amei', color: '#FF7675', bgColor: '#FFEFEF' },
  agree: { iconName: 'checkmark-circle', label: 'Concordo', color: '#00CEC9', bgColor: '#E0F9F8' },
  fire: { iconName: 'flame', label: 'Destaque', color: '#FF6B6B', bgColor: '#FFEAE8' },
  applause: { iconName: 'trophy', label: 'Aplausos', color: '#FDCB6E', bgColor: '#FFF8E7' },
  laugh: { iconName: 'happy', label: 'Boa', color: '#FECA57', bgColor: '#FFF9EB' },
  liked: { iconName: 'thumbs-up', label: 'Curtir', color: '#0984E3', bgColor: '#E8F4FD' },
};

const getReactionMeta = (rawKey: string) => {
  const normalized = (rawKey || '').trim().toLowerCase();
  return (
    REACTION_CONFIG[normalized] || {
      iconName: 'thumbs-up' as keyof typeof Ionicons.glyphMap,
      label: rawKey,
      color: colors.brand.primary,
      bgColor: '#EFEBFD',
    }
  );
};

const QUICK_ACTION_REACTIONS = ['like', 'heart', 'agree', 'fire', 'applause', 'laugh'] as const;

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

  // Reply & Edit State
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    nickname: string;
    content: string;
    type?: string;
    attachment?: MessageAttachment | null;
    poll?: any;
  } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [selectedMessageForActions, setSelectedMessageForActions] = useState<ChatMessage | null>(null);

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

  const renderAvatar = (
    name: string,
    color?: string,
    avatarUrl?: string | null,
    size: number = 40,
    rounded: boolean = true
  ) => {
    const monogram = (name || '?')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const bg = color || getAvatarBgColor(name);
    const radius = rounded ? size / 2 : 12;

    if (avatarUrl && avatarUrl.trim().startsWith('http')) {
      return (
        <Image
          source={{ uri: avatarUrl.trim() }}
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: '#E2E8F0',
          }}
        />
      );
    }

    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: Math.max(10, Math.floor(size * 0.38)),
            fontWeight: '800',
            letterSpacing: 0.5,
          }}
        >
          {monogram}
        </Text>
      </View>
    );
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

  // Render a Message Bubble
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.nickname === nickname;
    const isSystem = item.type === 'system';
    const isGameCard = item.type === 'game_card';
    const readCount = (item.read_by || []).filter(
      (r) => r.toLowerCase() !== item.nickname.toLowerCase()
    ).length;

    const isImageAttachment = item.attachment?.kind === 'image' || item.type === 'image';
    const isFileAttachment = item.attachment?.kind === 'document' || item.type === 'file';
    const isVoiceAttachment = item.attachment?.kind === 'audio' || item.type === 'voice';

    const attachmentUrl =
      item.attachment?.data_url ||
      (item.attachment?.url?.startsWith('http')
        ? item.attachment.url
        : item.attachment?.url
        ? `http://${serverHost}${item.attachment.url}`
        : null);

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
        <View style={!isMe ? styles.messageWithAvatarRow : undefined}>
          {!isMe && renderAvatar(item.nickname, undefined, undefined, 30)}
          <View style={!isMe ? styles.messageContentCol : undefined}>
            {!isMe && <Text style={styles.senderName}>{item.nickname}</Text>}
            <TouchableOpacity
              activeOpacity={0.85}
              onLongPress={() => setSelectedMessageForActions(item)}
              style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}
            >
          {/* Rich Reply Preview with Media Thumbnail & Icons */}
          {item.reply_preview && (() => {
            const repliedMsg =
              messages.find((m) => m.id === item.reply_preview?.id) ||
              messages.find((m) => m.id === item.reply_to_id);

            const isReplyImage =
              item.reply_preview.type === 'image' ||
              repliedMsg?.type === 'image' ||
              repliedMsg?.attachment?.kind === 'image' ||
              item.reply_preview.content?.startsWith('Imagem:');
            const isReplyVoice =
              item.reply_preview.type === 'voice' ||
              repliedMsg?.type === 'voice' ||
              repliedMsg?.attachment?.kind === 'audio';
            const isReplyFile =
              item.reply_preview.type === 'file' ||
              repliedMsg?.type === 'file' ||
              repliedMsg?.attachment?.kind === 'document';
            const isReplyPoll =
              item.reply_preview.type === 'poll' ||
              repliedMsg?.type === 'poll' ||
              Boolean(repliedMsg?.poll);

            const host = serverHost.trim() || 'localhost:8081';
            const replyImageUri = item.reply_preview.media_url
              ? item.reply_preview.media_url.startsWith('http') ||
                item.reply_preview.media_url.startsWith('data:')
                ? item.reply_preview.media_url
                : `http://${host}${item.reply_preview.media_url}`
              : repliedMsg?.attachment?.data_url ||
                (repliedMsg?.attachment?.url
                  ? repliedMsg.attachment.url.startsWith('http')
                    ? repliedMsg.attachment.url
                    : `http://${host}${repliedMsg.attachment.url}`
                  : null);

            const replyFileName =
              item.reply_preview.file_name || repliedMsg?.attachment?.file_name;

            return (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.replyPreviewBox}
                onPress={() => {
                  const targetIndex = messages.findIndex(
                    (m) => m.id === item.reply_preview?.id
                  );
                  if (targetIndex >= 0 && flatListRef.current) {
                    flatListRef.current.scrollToIndex({
                      index: targetIndex,
                      animated: true,
                    });
                  }
                }}
              >
                <View style={styles.replyPreviewInnerRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.replyPreviewSender}>
                      {item.reply_preview.nickname}
                    </Text>
                    <View style={styles.replyPreviewContentRow}>
                      {isReplyImage ? (
                        <>
                          <Ionicons
                            name="camera"
                            size={12}
                            color={colors.brand.primary}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.replyPreviewContent} numberOfLines={1}>
                            {replyFileName || item.reply_preview.content || 'Foto'}
                          </Text>
                        </>
                      ) : isReplyVoice ? (
                        <>
                          <Ionicons
                            name="mic"
                            size={12}
                            color={colors.brand.primary}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.replyPreviewContent} numberOfLines={1}>
                            Mensagem de voz
                          </Text>
                        </>
                      ) : isReplyFile ? (
                        <>
                          <Ionicons
                            name="document-text"
                            size={12}
                            color={colors.brand.primary}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.replyPreviewContent} numberOfLines={1}>
                            {replyFileName || item.reply_preview.content}
                          </Text>
                        </>
                      ) : isReplyPoll ? (
                        <>
                          <Ionicons
                            name="stats-chart"
                            size={12}
                            color={colors.brand.primary}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.replyPreviewContent} numberOfLines={1}>
                            {repliedMsg?.poll?.question || item.reply_preview.content}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.replyPreviewContent} numberOfLines={1}>
                          {item.reply_preview.content}
                        </Text>
                      )}
                    </View>
                  </View>
                  {isReplyImage && replyImageUri ? (
                    <Image
                      source={{ uri: replyImageUri }}
                      style={styles.replyPreviewThumbnail}
                      resizeMode="cover"
                    />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })()}

          {/* Interactive Poll Bubble */}
          {item.poll ? (
            <View style={styles.pollContainer}>
              <View style={styles.pollHeaderRow}>
                <View style={styles.pollBadgeWrapper}>
                  <Text style={styles.pollBadgeText}>ENQUETE</Text>
                </View>
                <View
                  style={[
                    styles.pollStatusPill,
                    item.poll.is_closed ? styles.pollStatusPillClosed : styles.pollStatusPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pollStatusPillText,
                      item.poll.is_closed
                        ? styles.pollStatusPillTextClosed
                        : styles.pollStatusPillTextActive,
                    ]}
                  >
                    {item.poll.is_closed ? 'Encerrada' : 'Ativa'}
                  </Text>
                </View>
              </View>

              <Text style={styles.pollQuestionText}>{item.poll.question}</Text>

              {(() => {
                const totalVotes = item.poll.options.reduce(
                  (acc, opt) => acc + (opt.voter_ids?.length || 0),
                  0
                );
                const maxVotes = Math.max(
                  0,
                  ...item.poll.options.map((opt) => opt.voter_ids?.length || 0)
                );

                return (
                  <>
                    <View style={styles.pollOptionsList}>
                      {item.poll.options.map((opt, optIndex) => {
                        const votes = opt.voter_ids?.length || 0;
                        const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                        const voted = (opt.voter_ids || []).some(
                          (v) => v.toLowerCase() === nickname.toLowerCase()
                        );
                        const isWinner =
                          Boolean(item.poll?.is_closed) && maxVotes > 0 && votes === maxVotes;
                        const optColor = POLL_PALETTE[optIndex % POLL_PALETTE.length];

                        return (
                          <TouchableOpacity
                            key={opt.id}
                            disabled={item.poll?.is_closed}
                            activeOpacity={0.8}
                            style={[
                              styles.pollOptionBtn,
                              voted && { borderColor: optColor.border, borderWidth: 1.5 },
                              isWinner && styles.pollOptionWinnerBtn,
                            ]}
                            onPress={() => votePoll(item.id, opt.id)}
                          >
                            {/* Animated / Colored Progress Fill Bar */}
                            {pct > 0 && (
                              <View
                                style={[
                                  styles.pollOptionProgressBar,
                                  {
                                    width: `${pct}%`,
                                    backgroundColor: optColor.fill,
                                  },
                                ]}
                              />
                            )}

                            {/* Option Content Overlay */}
                            <View style={styles.pollOptionContentRow}>
                              <View style={styles.pollOptionLeft}>
                                <View
                                  style={[
                                    styles.pollRadioCircle,
                                    voted && {
                                      backgroundColor: optColor.border,
                                      borderColor: optColor.border,
                                    },
                                    isWinner && { borderColor: colors.brand.reward },
                                  ]}
                                >
                                  {voted && <Text style={styles.pollRadioCheck}>✓</Text>}
                                </View>
                                <Text
                                  style={[
                                    styles.pollOptionText,
                                    voted && styles.pollOptionTextActive,
                                  ]}
                                  numberOfLines={2}
                                >
                                  {opt.label}
                                </Text>
                              </View>

                              <View style={styles.pollOptionRight}>
                                <Text
                                  style={[
                                    styles.pollOptionPctText,
                                    voted && { color: optColor.text, fontWeight: '900' },
                                  ]}
                                >
                                  {pct}%
                                </Text>
                                <Text style={styles.pollOptionVotesCount}>
                                  {votes} {votes === 1 ? 'voto' : 'votos'}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Poll Footer Information */}
                    <View style={styles.pollFooterRow}>
                      <Text style={styles.pollFooterTotalText}>
                        {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}
                        {item.poll.multi_select ? ' • Múltipla escolha' : ''}
                      </Text>

                      {!item.poll.is_closed &&
                        item.poll.created_by.toLowerCase() === nickname.toLowerCase() && (
                          <TouchableOpacity
                            style={styles.closePollBtn}
                            onPress={() => closePoll(item.id)}
                          >
                            <Text style={styles.closePollBtnText}>Encerrar</Text>
                          </TouchableOpacity>
                        )}
                    </View>
                  </>
                );
              })()}
            </View>
          ) : isImageAttachment ? (
            <View style={styles.attachmentImageContainer}>
              {attachmentUrl && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setFullscreenImageUri(attachmentUrl)}
                  onLongPress={() => setSelectedMessageForActions(item)}
                  style={styles.imageBubbleWrapper}
                >
                  <Image
                    source={{ uri: attachmentUrl }}
                    style={styles.messageImage}
                    resizeMode="cover"
                  />
                  <View style={styles.imageOverlayBadge}>
                    <Ionicons name="expand-outline" size={13} color="#FFF" />
                  </View>
                </TouchableOpacity>
              )}

              {item.content && !item.content.startsWith('Imagem: ') ? (
                <Text
                  style={[
                    styles.messageText,
                    isMe ? styles.myMessageText : styles.otherMessageText,
                    { marginTop: 6 },
                  ]}
                >
                  {item.content}
                </Text>
              ) : null}

              {item.attachment && (
                <View style={styles.attachmentMetaRow}>
                  <Ionicons name="image-outline" size={12} color={isMe ? '#2E7D32' : '#868E96'} />
                  <Text
                    style={[styles.attachmentMetaText, isMe && { color: '#2E7D32' }]}
                    numberOfLines={1}
                  >
                    {item.attachment.file_name} • {(item.attachment.size_bytes / 1024).toFixed(0)} KB
                  </Text>
                  {item.attachment.sha256 ? (
                    <Text style={[styles.attachmentShaText, isMe && { color: '#388E3C' }]}>
                      SHA:{item.attachment.sha256.slice(0, 6)}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          ) : isFileAttachment ? (
            <View style={styles.attachmentFileContainer}>
              <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={() => setSelectedMessageForActions(item)}
                style={[
                  styles.fileCard,
                  isMe ? styles.fileCardMe : styles.fileCardOther,
                ]}
                onPress={() => {
                  if (attachmentUrl) {
                    Linking.openURL(attachmentUrl).catch(() => {
                      Alert.alert(
                        item.attachment?.file_name || 'Arquivo',
                        `Tamanho: ${((item.attachment?.size_bytes || 0) / 1024).toFixed(1)} KB\nSHA256: ${item.attachment?.sha256 || 'N/A'}`
                      );
                    });
                  }
                }}
              >
                <View style={[styles.fileIconBox, isMe && { backgroundColor: '#C8E6C9' }]}>
                  <Ionicons
                    name="document-text"
                    size={20}
                    color={isMe ? '#2E7D32' : colors.brand.primary}
                  />
                </View>
                <View style={{ flex: 1, marginHorizontal: 8 }}>
                  <Text
                    style={[styles.fileNameText, isMe && { color: '#1B5E20' }]}
                    numberOfLines={1}
                  >
                    {item.attachment?.file_name || 'Documento'}
                  </Text>
                  <Text style={[styles.fileSubText, isMe && { color: '#388E3C' }]}>
                    {item.attachment
                      ? `${(item.attachment.size_bytes / 1024).toFixed(1)} KB`
                      : 'Arquivo'}
                    {item.attachment?.sha256
                      ? ` • SHA:${item.attachment.sha256.slice(0, 6)}`
                      : ''}
                  </Text>
                </View>
                <View style={styles.fileDownloadBtn}>
                  <Ionicons
                    name="arrow-down-circle"
                    size={20}
                    color={isMe ? '#2E7D32' : colors.brand.primary}
                  />
                </View>
              </TouchableOpacity>

              {item.content && !item.content.startsWith('Arquivo: ') ? (
                <Text
                  style={[
                    styles.messageText,
                    isMe ? styles.myMessageText : styles.otherMessageText,
                    { marginTop: 6 },
                  ]}
                >
                  {item.content}
                </Text>
              ) : null}
            </View>
          ) : isVoiceAttachment ? (
            <View style={styles.voiceNoteContainer}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.voicePlayBtn,
                  isMe && { backgroundColor: '#2E7D32' },
                ]}
                onPress={() => {
                  setPlayingAudioId((prev) => (prev === item.id ? null : item.id));
                }}
              >
                <Ionicons
                  name={playingAudioId === item.id ? 'pause' : 'play'}
                  size={15}
                  color="#FFF"
                />
              </TouchableOpacity>
              <View style={styles.waveformContainer}>
                {(item.attachment?.waveform || [30, 60, 45, 80, 50, 95, 40, 70, 85, 55, 65, 40, 75, 50, 30]).map((h, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveformBar,
                      { height: Math.max(6, Math.min(24, Math.round(h * 0.24))) },
                      isMe
                        ? { backgroundColor: playingAudioId === item.id ? '#1B5E20' : '#81C784' }
                        : { backgroundColor: playingAudioId === item.id ? colors.brand.primary : '#A29BFE' },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.voiceDurationText, isMe && { color: '#2E7D32' }]}>
                {item.attachment?.duration_seconds
                  ? `${Math.floor(item.attachment.duration_seconds / 60)}:${(item.attachment.duration_seconds % 60).toString().padStart(2, '0')}`
                  : '0:15'}
              </Text>
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
          <View
            style={[
              styles.reactionPillsRow,
              isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' },
            ]}
          >
            {Object.entries(item.reactions).map(([key, users]) => {
              if (!users || users.length === 0) return null;
              const hasReacted = users.some(
                (u) => u.toLowerCase() === nickname.toLowerCase()
              );
              const meta = getReactionMeta(key);

              return (
                <TouchableOpacity
                  key={key}
                  activeOpacity={0.75}
                  style={[
                    styles.reactionPill,
                    hasReacted && {
                      backgroundColor: meta.bgColor,
                      borderColor: meta.color,
                      borderWidth: 1.5,
                    },
                  ]}
                  onPress={() =>
                    sendAction('chat:reaction', { message_id: item.id, emoji: key })
                  }
                >
                  <Ionicons
                    name={meta.iconName}
                    size={12}
                    color={hasReacted ? meta.color : '#636E72'}
                  />
                  <Text
                    style={[
                      styles.reactionPillCount,
                      hasReacted && { color: meta.color, fontWeight: '800' },
                    ]}
                  >
                    {users.length}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
          </View>
        </View>
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
                setTempStatus(userProfile?.status_text || 'Disponível no PORChat');
                setTempBio(userProfile?.bio || '');
                setTempAvatarColor(userProfile?.avatar_color || '#6C5CE7');
                setTempAvatarUrl(userProfile?.avatar_url || '');
                setShowProfileModal(true);
              }}
              activeOpacity={0.8}
            >
              {renderAvatar(nickname, userProfile?.avatar_color, userProfile?.avatar_url, 26)}
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
                {renderAvatar(item.nickname, item.avatar_color, item.avatar_url, 44, false)}
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
                  {renderAvatar(
                    item.name,
                    isGroup ? colors.brand.primary : getAvatarBgColor(item.id),
                    item.avatar_url,
                    44,
                    false
                  )}
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
            <View style={[styles.modalCard, { maxHeight: '90%' }]}>
              <View style={styles.profileModalHeader}>
                <Text style={styles.modalTitle}>Perfil & Conta</Text>
                <TouchableOpacity
                  style={styles.profileCloseIconBtn}
                  onPress={() => setShowProfileModal(false)}
                >
                  <Ionicons name="close" size={20} color="#636E72" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                {/* Live Avatar Preview */}
                <View style={styles.avatarPreviewContainer}>
                  {renderAvatar(tempNick || nickname, tempAvatarColor, tempAvatarUrl, 84)}
                  <View style={styles.avatarPreviewBadge}>
                    <Ionicons name="camera" size={14} color="#FFF" />
                  </View>
                </View>

                {/* Preset Avatars Row */}
                <Text style={styles.profileSectionLabel}>Fotos de Perfil Sugeridas:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.avatarPresetsScroll}
                >
                  {AVATAR_PRESETS.map((presetUrl, idx) => {
                    const isSelected = tempAvatarUrl === presetUrl;
                    return (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.8}
                        onPress={() => setTempAvatarUrl(presetUrl)}
                        style={[
                          styles.presetAvatarBtn,
                          isSelected && styles.presetAvatarBtnActive,
                        ]}
                      >
                        <Image source={{ uri: presetUrl }} style={styles.presetAvatarImg} />
                        {isSelected && (
                          <View style={styles.presetCheckOverlay}>
                            <Ionicons name="checkmark" size={16} color="#FFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Custom Photo URL Input */}
                <View style={styles.customUrlInputRow}>
                  <TextInput
                    style={[styles.modalInput, { flex: 1, marginBottom: 0, fontSize: 12 }]}
                    value={tempAvatarUrl}
                    onChangeText={setTempAvatarUrl}
                    placeholder="Ou cole a URL da foto (https://...)"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                  />
                  {Boolean(tempAvatarUrl) && (
                    <TouchableOpacity
                      style={styles.clearPhotoBtn}
                      onPress={() => setTempAvatarUrl('')}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FF7675" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Avatar Color Picker */}
                <Text style={styles.profileSectionLabel}>Cor do Monograma / Fundo:</Text>
                <View style={styles.colorPaletteGrid}>
                  {AVATAR_COLOR_OPTIONS.map((c) => {
                    const isSelected = tempAvatarColor.toLowerCase() === c.bg.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={c.id}
                        activeOpacity={0.8}
                        onPress={() => setTempAvatarColor(c.bg)}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: c.bg },
                          isSelected && styles.colorCircleActive,
                        ]}
                      >
                        {isSelected && <Ionicons name="checkmark" size={16} color="#FFF" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Nickname Input */}
                <Text style={styles.profileSectionLabel}>Apelido no Chat:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={tempNick}
                  onChangeText={setTempNick}
                  placeholder="Seu apelido..."
                  placeholderTextColor="#999"
                />

                {/* Status Message & Presets */}
                <Text style={styles.profileSectionLabel}>Recado de Status:</Text>
                <View style={styles.statusPresetsRow}>
                  {STATUS_PRESETS.map((pst, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.statusPresetPill,
                        tempStatus === pst && styles.statusPresetPillActive,
                      ]}
                      onPress={() => setTempStatus(pst)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.statusPresetPillText,
                          tempStatus === pst && styles.statusPresetPillTextActive,
                        ]}
                      >
                        {pst}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.modalInput}
                  value={tempStatus}
                  onChangeText={setTempStatus}
                  placeholder="Status personalizado..."
                  placeholderTextColor="#999"
                />

                {/* Bio Input */}
                <Text style={styles.profileSectionLabel}>Biografia Curta:</Text>
                <TextInput
                  style={[styles.modalInput, styles.bioInput]}
                  value={tempBio}
                  onChangeText={setTempBio}
                  placeholder="Compartilhe algo sobre você..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={2}
                />

                <TouchableOpacity
                  style={styles.primaryModalBtn}
                  onPress={async () => {
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
                >
                  <Text style={styles.primaryModalBtnText}>Salvar Perfil</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeModalBtn}
                  onPress={() => setShowProfileModal(false)}
                >
                  <Text style={styles.closeModalBtnText}>Cancelar</Text>
                </TouchableOpacity>
              </ScrollView>
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
          {renderAvatar(
            currentRoomInfo?.name || 'Chat',
            isCurrentGroup ? colors.brand.primary : getAvatarBgColor(roomId),
            currentRoomInfo?.avatar_url,
            36,
            false
          )}
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

      {/* Messages Feed */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.chatArea}
      >
        <FlatList
          ref={flatListRef}
          data={
            chatSearchQuery.trim()
              ? messages.filter(
                  (m) =>
                    (m.content && m.content.toLowerCase().includes(chatSearchQuery.toLowerCase())) ||
                    (m.nickname && m.nickname.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                )
              : messages
          }
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
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

        {/* Reply / Edit Context Bar */}
        {(replyingTo || editingMessage) && (() => {
          const isReplyImage =
            replyingTo?.type === 'image' ||
            replyingTo?.attachment?.kind === 'image' ||
            replyingTo?.content?.startsWith('Imagem:');
          const isReplyVoice =
            replyingTo?.type === 'voice' ||
            replyingTo?.attachment?.kind === 'audio';
          const isReplyFile =
            replyingTo?.type === 'file' ||
            replyingTo?.attachment?.kind === 'document';
          const isReplyPoll =
            replyingTo?.type === 'poll' || Boolean(replyingTo?.poll);

          const host = serverHost.trim() || 'localhost:8081';
          const replyImageUri =
            replyingTo?.attachment?.data_url ||
            (replyingTo?.attachment?.url
              ? replyingTo.attachment.url.startsWith('http')
                ? replyingTo.attachment.url
                : `http://${host}${replyingTo.attachment.url}`
              : null);

          return (
            <View style={styles.replyContextBar}>
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
                    ) : isReplyImage ? (
                      <>
                        <Ionicons
                          name="camera"
                          size={13}
                          color={colors.brand.primary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.replyContextBody} numberOfLines={1}>
                          {replyingTo?.attachment?.file_name ||
                            replyingTo?.content ||
                            'Foto'}
                        </Text>
                      </>
                    ) : isReplyVoice ? (
                      <>
                        <Ionicons
                          name="mic"
                          size={13}
                          color={colors.brand.primary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.replyContextBody} numberOfLines={1}>
                          Mensagem de voz
                        </Text>
                      </>
                    ) : isReplyFile ? (
                      <>
                        <Ionicons
                          name="document-text"
                          size={13}
                          color={colors.brand.primary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.replyContextBody} numberOfLines={1}>
                          {replyingTo?.attachment?.file_name || replyingTo?.content}
                        </Text>
                      </>
                    ) : isReplyPoll ? (
                      <>
                        <Ionicons
                          name="stats-chart"
                          size={13}
                          color={colors.brand.primary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.replyContextBody} numberOfLines={1}>
                          {replyingTo?.poll?.question || replyingTo?.content}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.replyContextBody} numberOfLines={1}>
                        {replyingTo?.content}
                      </Text>
                    )}
                  </View>
                </View>
                {isReplyImage && replyImageUri ? (
                  <Image
                    source={{ uri: replyImageUri }}
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
            </View>
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

        {/* Message Input Bar */}
        <View style={styles.inputContainer}>
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
        </View>
      </KeyboardAvoidingView>

      {/* MODAL: CRIAR ENQUETE */}
      <Modal
        visible={showCreatePollModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreatePollModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalCard, styles.pollModalCard]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Nova Enquete na Sala</Text>
              <TouchableOpacity
                onPress={() => setShowCreatePollModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalCloseX}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Crie uma votação com opções personalizadas para o grupo:</Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.pollModalScroll}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <Text style={styles.modalFieldLabel}>Pergunta da Enquete</Text>
              <TextInput
                style={styles.modalInput}
                value={pollQuestion}
                onChangeText={setPollQuestion}
                placeholder="Ex: Qual o melhor jogo para jogar agora?"
                placeholderTextColor="#999"
              />

              <View style={styles.pollOptionsHeaderRow}>
                <Text style={styles.modalFieldLabel}>
                  Opções ({pollOptions.length}/8)
                </Text>
                {pollOptions.length < 8 && (
                  <TouchableOpacity
                    style={styles.addOptionHeaderBtn}
                    onPress={handleAddPollOption}
                  >
                    <Text style={styles.addOptionHeaderBtnText}>+ Adicionar Opção</Text>
                  </TouchableOpacity>
                )}
              </View>

              {pollOptions.map((opt, idx) => (
                <View key={idx} style={styles.pollOptionInputRow}>
                  <View style={styles.pollOptionNumberBadge}>
                    <Text style={styles.pollOptionNumberText}>{idx + 1}</Text>
                  </View>
                  <TextInput
                    style={[styles.modalInput, styles.pollOptionInputFlex]}
                    value={opt}
                    onChangeText={(val) => handlePollOptionChange(idx, val)}
                    placeholder={`Opção ${idx + 1}${idx < 2 ? ' (obrigatória)' : ''}`}
                    placeholderTextColor="#999"
                  />
                  {pollOptions.length > 2 && (
                    <TouchableOpacity
                      style={styles.removeOptionBtn}
                      onPress={() => handleRemovePollOption(idx)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.removeOptionBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {pollOptions.length < 8 && (
                <TouchableOpacity
                  style={styles.addOptionDashedBtn}
                  onPress={handleAddPollOption}
                >
                  <Text style={styles.addOptionDashedBtnText}>+ Adicionar outra opção</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.contactCheckRow, pollMultiSelect && styles.contactCheckRowActive]}
                onPress={() => setPollMultiSelect((prev) => !prev)}
              >
                <View
                  style={[
                    styles.pollMultiSelectBox,
                    pollMultiSelect && styles.pollMultiSelectBoxActive,
                  ]}
                >
                  {pollMultiSelect && <Text style={styles.pollMultiSelectCheck}>✓</Text>}
                </View>
                <Text style={styles.contactCheckName}>Permitir múltiplos votos</Text>
              </TouchableOpacity>
            </ScrollView>

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
        </KeyboardAvoidingView>
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

      {/* MODAL: ACOES DA MENSAGEM (BOTTOM SHEET ELEGANTE) */}
      <Modal
        visible={Boolean(selectedMessageForActions)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessageForActions(null)}
      >
        <TouchableOpacity
          style={styles.actionSheetBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedMessageForActions(null)}
        >
          <View
            style={styles.actionSheetContainer}
            onStartShouldSetResponder={() => true}
          >
            {/* Sheet Handle */}
            <View style={styles.actionSheetHandle} />

            {/* Quick Floating Reaction Bar */}
            <View style={styles.quickReactionBar}>
              {QUICK_ACTION_REACTIONS.map((rKey) => {
                const meta = REACTION_CONFIG[rKey];
                const isSelected = Boolean(
                  selectedMessageForActions?.reactions?.[rKey]?.some(
                    (u) => u.toLowerCase() === nickname.toLowerCase()
                  )
                );

                return (
                  <TouchableOpacity
                    key={rKey}
                    activeOpacity={0.7}
                    style={[
                      styles.quickReactionBtn,
                      isSelected && { backgroundColor: meta.bgColor, transform: [{ scale: 1.1 }] },
                    ]}
                    onPress={() => {
                      if (selectedMessageForActions) {
                        sendAction('chat:reaction', {
                          message_id: selectedMessageForActions.id,
                          emoji: rKey,
                        });
                        setSelectedMessageForActions(null);
                      }
                    }}
                  >
                    <Ionicons name={meta.iconName} size={22} color={meta.color} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Message Snippet Preview */}
            {selectedMessageForActions && (
              <View style={styles.actionSheetPreviewCard}>
                <View style={styles.actionSheetPreviewAccent} />
                <View style={styles.actionSheetPreviewContent}>
                  <Text style={styles.actionSheetPreviewSender}>
                    {selectedMessageForActions.nickname}
                  </Text>
                  <Text style={styles.actionSheetPreviewText} numberOfLines={2}>
                    {selectedMessageForActions.content}
                  </Text>
                </View>
              </View>
            )}

            {/* Actions List */}
            <View style={styles.actionSheetItemsList}>
              <TouchableOpacity
                style={styles.actionSheetRow}
                activeOpacity={0.7}
                onPress={() => {
                  if (selectedMessageForActions) {
                    setReplyingTo({
                      id: selectedMessageForActions.id,
                      nickname: selectedMessageForActions.nickname,
                      content: selectedMessageForActions.content,
                      type: selectedMessageForActions.type,
                      attachment: selectedMessageForActions.attachment,
                      poll: selectedMessageForActions.poll,
                    });
                    setSelectedMessageForActions(null);
                  }
                }}
              >
                <View style={[styles.actionSheetIconWrapper, { backgroundColor: '#EFEBFD' }]}>
                  <Ionicons name="return-up-back-outline" size={18} color={colors.brand.primary} />
                </View>
                <Text style={styles.actionSheetRowText}>Responder</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSheetRow}
                activeOpacity={0.7}
                onPress={() => {
                  if (selectedMessageForActions) {
                    const isPinned = pinnedMessage?.message_id === selectedMessageForActions.id;
                    if (isPinned) {
                      unpinMessage();
                    } else {
                      pinMessage(selectedMessageForActions.id);
                    }
                    setSelectedMessageForActions(null);
                  }
                }}
              >
                <View style={[styles.actionSheetIconWrapper, { backgroundColor: '#FFF8E7' }]}>
                  <Ionicons name="pin-outline" size={18} color="#D4A017" />
                </View>
                <Text style={styles.actionSheetRowText}>
                  {pinnedMessage?.message_id === selectedMessageForActions?.id
                    ? 'Desafixar do Topo'
                    : 'Fixar no Topo'}
                </Text>
              </TouchableOpacity>

              {selectedMessageForActions?.nickname === nickname &&
                selectedMessageForActions?.type === 'text' && (
                  <TouchableOpacity
                    style={styles.actionSheetRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (selectedMessageForActions) {
                        setEditingMessage({
                          id: selectedMessageForActions.id,
                          content: selectedMessageForActions.content,
                        });
                        setInputText(selectedMessageForActions.content);
                        setSelectedMessageForActions(null);
                      }
                    }}
                  >
                    <View style={[styles.actionSheetIconWrapper, { backgroundColor: '#E0F9F8' }]}>
                      <Ionicons name="pencil-outline" size={18} color="#008B87" />
                    </View>
                    <Text style={styles.actionSheetRowText}>Editar Mensagem</Text>
                  </TouchableOpacity>
                )}

              {selectedMessageForActions?.nickname === nickname && (
                <TouchableOpacity
                  style={[styles.actionSheetRow, styles.actionSheetRowDestructive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (selectedMessageForActions) {
                      deleteMessage(selectedMessageForActions.id);
                      setSelectedMessageForActions(null);
                    }
                  }}
                >
                  <View style={[styles.actionSheetIconWrapper, { backgroundColor: '#FFE5E5' }]}>
                    <Ionicons name="trash-outline" size={18} color={colors.brand.action} />
                  </View>
                  <Text style={[styles.actionSheetRowText, styles.actionSheetRowTextDestructive]}>
                    Apagar Mensagem
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.actionSheetCancelBtn}
              activeOpacity={0.8}
              onPress={() => setSelectedMessageForActions(null)}
            >
              <Text style={styles.actionSheetCancelText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: ROOM / GROUP INFO */}
      <Modal
        visible={showRoomInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoomInfoModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.profileModalHeader}>
              <Text style={styles.modalTitle}>Informações da Sala</Text>
              <TouchableOpacity
                style={styles.profileCloseIconBtn}
                onPress={() => setShowRoomInfoModal(false)}
              >
                <Ionicons name="close" size={20} color="#636E72" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.roomInfoHero}>
                {renderAvatar(
                  currentRoomInfo?.name || 'Chat',
                  isCurrentGroup ? colors.brand.primary : getAvatarBgColor(roomId),
                  currentRoomInfo?.avatar_url,
                  68,
                  false
                )}
                <Text style={styles.roomInfoName}>{currentRoomInfo?.name || 'Sala'}</Text>
                <Text style={styles.roomInfoDesc}>
                  {currentRoomInfo?.description || 'Sala de conversa em tempo real e jogos sincrônicos no PORChat.'}
                </Text>
              </View>

              {/* PIN Code Box */}
              {Boolean(currentRoomInfo?.code) && (
                <View style={styles.roomPinBox}>
                  <View>
                    <Text style={styles.roomPinLabel}>Código PIN da Sala</Text>
                    <Text style={styles.roomPinValue}>{currentRoomInfo?.code}</Text>
                  </View>
                  <View style={styles.pinTagBadge}>
                    <Text style={styles.pinTagText}>Compartilhe com amigos</Text>
                  </View>
                </View>
              )}

              {/* Members List */}
              <Text style={styles.profileSectionLabel}>
                Participantes ({currentRoomInfo?.members?.length || 1}):
              </Text>
              <View style={styles.roomMembersContainer}>
                {(currentRoomInfo?.members || [nickname]).map((memName, idx) => {
                  const isUserMe = memName.toLowerCase() === nickname.toLowerCase();
                  const isAdmin = currentRoomInfo?.admins?.includes(memName);
                  return (
                    <View key={idx} style={styles.roomMemberRow}>
                      {renderAvatar(memName, undefined, undefined, 34)}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.roomMemberName}>
                          {memName} {isUserMe ? '(Você)' : ''}
                        </Text>
                        <Text style={styles.roomMemberRole}>
                          {isAdmin ? 'Administrador da sala' : 'Membro'}
                        </Text>
                      </View>
                      {isAdmin && (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminBadgeText}>Admin</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setShowRoomInfoModal(false)}
              >
                <Text style={styles.closeModalBtnText}>Fechar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: ATTACHMENT MENU */}
      <Modal
        visible={showAttachmentMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachmentMenu(false)}
      >
        <TouchableOpacity
          style={styles.actionSheetBackdrop}
          activeOpacity={1}
          onPress={() => setShowAttachmentMenu(false)}
        >
          <View style={styles.actionSheetContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.attachmentSheetTitle}>Compartilhar no Chat</Text>

            <View style={styles.attachmentGrid}>
              <TouchableOpacity
                style={styles.attachmentTile}
                onPress={handlePickImage}
                activeOpacity={0.8}
              >
                <View style={[styles.attachmentTileIconBox, { backgroundColor: '#F0EFFE' }]}>
                  <Ionicons name="images" size={24} color={colors.brand.primary} />
                </View>
                <Text style={styles.attachmentTileLabel}>Galeria</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.attachmentTile}
                onPress={handleTakePhoto}
                activeOpacity={0.8}
              >
                <View style={[styles.attachmentTileIconBox, { backgroundColor: '#FFE5E5' }]}>
                  <Ionicons name="camera" size={24} color={colors.brand.action} />
                </View>
                <Text style={styles.attachmentTileLabel}>Câmera</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.attachmentTile}
                onPress={handlePickDocument}
                activeOpacity={0.8}
              >
                <View style={[styles.attachmentTileIconBox, { backgroundColor: '#E0F9F8' }]}>
                  <Ionicons name="document-text" size={24} color="#00CEC9" />
                </View>
                <Text style={styles.attachmentTileLabel}>Documento</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.attachmentTile}
                onPress={() => {
                  setShowAttachmentMenu(false);
                  setShowCreatePollModal(true);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.attachmentTileIconBox, { backgroundColor: '#FFF5DB' }]}>
                  <Ionicons name="bar-chart" size={24} color="#FDCB6E" />
                </View>
                <Text style={styles.attachmentTileLabel}>Enquete</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.actionSheetCancelBtn}
              activeOpacity={0.8}
              onPress={() => setShowAttachmentMenu(false)}
            >
              <Text style={styles.actionSheetCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: FULLSCREEN IMAGE VIEWER */}
      <Modal
        visible={Boolean(fullscreenImageUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImageUri(null)}
      >
        <View style={styles.fullscreenBackdrop}>
          <SafeAreaView style={styles.fullscreenHeader}>
            <TouchableOpacity
              style={styles.fullscreenCloseBtn}
              onPress={() => setFullscreenImageUri(null)}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.fullscreenTitle}>Imagem Anexada</Text>
            <TouchableOpacity
              style={styles.fullscreenActionBtn}
              onPress={() => {
                if (fullscreenImageUri) Linking.openURL(fullscreenImageUri);
              }}
            >
              <Ionicons name="open-outline" size={20} color="#FFF" />
            </TouchableOpacity>
          </SafeAreaView>

          <View style={styles.fullscreenImageContainer}>
            {fullscreenImageUri && (
              <Image
                source={{ uri: fullscreenImageUri }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            )}
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
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 6,
    minWidth: 180,
  },
  replyPreviewInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replyPreviewContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  replyPreviewThumbnail: {
    width: 38,
    height: 38,
    borderRadius: 6,
    marginLeft: 8,
  },
  replyPreviewSender: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.brand.primary,
  },
  replyPreviewContent: {
    fontSize: 11,
    color: '#495057',
    flexShrink: 1,
  },
  pollContainer: {
    minWidth: 250,
    paddingVertical: 2,
  },
  pollHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pollBadgeWrapper: {
    backgroundColor: '#EFEBFD',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pollBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.brand.primary,
    letterSpacing: 0.5,
  },
  pollStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pollStatusPillActive: {
    backgroundColor: '#E0F9F8',
  },
  pollStatusPillClosed: {
    backgroundColor: '#ECEFF1',
  },
  pollStatusPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  pollStatusPillTextActive: {
    color: '#008B87',
  },
  pollStatusPillTextClosed: {
    color: '#78909C',
  },
  pollQuestionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2D3436',
    marginBottom: 10,
    lineHeight: 18,
  },
  pollOptionsList: {
    gap: 6,
    marginBottom: 6,
  },
  pollOptionBtn: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 44,
    justifyContent: 'center',
  },
  pollOptionWinnerBtn: {
    borderColor: colors.brand.reward,
    borderWidth: 1.5,
  },
  pollOptionProgressBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  pollOptionContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    zIndex: 2,
  },
  pollOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  pollRadioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  pollRadioCheck: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
  pollOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D3436',
    flexShrink: 1,
  },
  pollOptionTextActive: {
    color: '#1E1E2E',
    fontWeight: '800',
  },
  pollOptionRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 48,
  },
  pollOptionPctText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#636E72',
  },
  pollOptionVotesCount: {
    fontSize: 9,
    fontWeight: '600',
    color: '#95A5A6',
    marginTop: 1,
  },
  pollFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    marginTop: 4,
  },
  pollFooterTotalText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7F8C8D',
  },
  closePollBtn: {
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  closePollBtnText: {
    fontSize: 9,
    fontWeight: '800',
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
  pollModalCard: {
    maxHeight: '85%',
  },
  pollModalScroll: {
    maxHeight: 320,
    marginBottom: 8,
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 6,
    marginTop: 4,
  },
  pollOptionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  addOptionHeaderBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#EFEBFD',
  },
  addOptionHeaderBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.brand.primary,
  },
  pollOptionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  pollOptionNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollOptionNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#636E72',
  },
  pollOptionInputFlex: {
    flex: 1,
    marginBottom: 0,
  },
  removeOptionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeOptionBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.brand.action,
  },
  addOptionDashedBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CED4DA',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  addOptionDashedBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand.primary,
  },
  pollMultiSelectBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#CED4DA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#FFFFFF',
  },
  pollMultiSelectBoxActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  pollMultiSelectCheck: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
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
  actionSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DEE2E6',
    alignSelf: 'center',
    marginBottom: 14,
  },
  quickReactionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 16,
  },
  quickReactionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionSheetPreviewCard: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    padding: 12,
    marginBottom: 14,
    overflow: 'hidden',
  },
  actionSheetPreviewAccent: {
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.brand.primary,
    marginRight: 10,
  },
  actionSheetPreviewContent: {
    flex: 1,
  },
  actionSheetPreviewSender: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.brand.primary,
    marginBottom: 2,
  },
  actionSheetPreviewText: {
    fontSize: 13,
    color: '#495057',
    lineHeight: 18,
  },
  actionSheetItemsList: {
    gap: 4,
    marginBottom: 12,
  },
  actionSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  actionSheetRowDestructive: {
    marginTop: 2,
  },
  actionSheetIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionSheetRowText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D3436',
  },
  actionSheetRowTextDestructive: {
    color: colors.brand.action,
  },
  actionSheetCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#F1F3F5',
    marginTop: 4,
  },
  actionSheetCancelText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#636E72',
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
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  reactionPillActive: {
    backgroundColor: '#EFEBFD',
    borderColor: colors.brand.primary,
  },
  reactionPillCount: {
    fontSize: 11,
    fontWeight: '700',
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
  messageWithAvatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageContentCol: {
    flex: 1,
  },
  profileModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  profileCloseIconBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#F1F3F5',
  },
  avatarPreviewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  avatarPreviewBadge: {
    position: 'absolute',
    bottom: 0,
    right: '36%',
    backgroundColor: colors.brand.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  profileSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D3436',
    marginTop: 12,
    marginBottom: 8,
  },
  avatarPresetsScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  presetAvatarBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  presetAvatarBtnActive: {
    borderColor: colors.brand.primary,
  },
  presetAvatarImg: {
    width: '100%',
    height: '100%',
  },
  presetCheckOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(108, 92, 231, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customUrlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  clearPhotoBtn: {
    padding: 10,
    backgroundColor: '#FFE3E3',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPaletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleActive: {
    borderWidth: 3,
    borderColor: '#2D3436',
  },
  statusPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  statusPresetPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F1F3F5',
    borderRadius: 12,
  },
  statusPresetPillActive: {
    backgroundColor: '#EFEBFD',
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  statusPresetPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#495057',
  },
  statusPresetPillTextActive: {
    color: colors.brand.primary,
    fontWeight: '800',
  },
  bioInput: {
    height: 60,
    textAlignVertical: 'top',
    paddingTop: 8,
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
  roomInfoHero: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  roomInfoName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2D3436',
    marginTop: 10,
  },
  roomInfoDesc: {
    fontSize: 12,
    color: '#868E96',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
  roomPinBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0EFFE',
    padding: 12,
    borderRadius: 14,
    marginVertical: 12,
  },
  roomPinLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.brand.primary,
  },
  roomPinValue: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.brand.primary,
    letterSpacing: 1,
    marginTop: 2,
  },
  pinTagBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pinTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.brand.primary,
  },
  roomMembersContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F3F5',
    padding: 8,
    marginBottom: 16,
  },
  roomMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  roomMemberName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D3436',
  },
  roomMemberRole: {
    fontSize: 11,
    color: '#868E96',
  },
  adminBadge: {
    backgroundColor: '#FFE3E3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.brand.action,
  },
  attachmentImageContainer: {
    marginTop: 2,
    marginBottom: 2,
    maxWidth: 240,
  },
  imageBubbleWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageImage: {
    width: 220,
    height: 160,
  },
  imageOverlayBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  attachmentMetaText: {
    fontSize: 10,
    color: '#868E96',
    flex: 1,
  },
  attachmentShaText: {
    fontSize: 9,
    color: '#A0AEC0',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  attachmentFileContainer: {
    marginVertical: 2,
    minWidth: 200,
    maxWidth: 240,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  fileCardMe: {
    backgroundColor: '#D7F5CA',
    borderColor: '#BCE8AB',
  },
  fileCardOther: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E9ECEF',
  },
  fileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0EFFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D3436',
  },
  fileSubText: {
    fontSize: 10,
    color: '#868E96',
    marginTop: 2,
  },
  fileDownloadBtn: {
    padding: 4,
  },
  voiceNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
    minWidth: 180,
    maxWidth: 240,
  },
  voicePlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
    height: 28,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
  },
  voiceDurationText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.brand.primary,
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
  attachmentSheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2D3436',
    textAlign: 'center',
    marginBottom: 16,
  },
  attachmentGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  attachmentTile: {
    alignItems: 'center',
    gap: 6,
  },
  attachmentTileIconBox: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentTileLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#495057',
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: '#0A0C16',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2337',
  },
  fullscreenCloseBtn: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
  },
  fullscreenActionBtn: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
  },
  fullscreenTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  fullscreenImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
});
