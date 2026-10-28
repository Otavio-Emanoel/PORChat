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
import type { ChatMessage } from '../types';

interface RoomItem {
  id: string;
  name: string;
  code: string;
  is_group: boolean;
  members?: string[];
  created_by?: string;
}

interface ContactItem {
  id: string;
  nickname: string;
  email: string;
}

interface FloatingParticle {
  id: number;
  emoji: string;
  x: number;
  animY: Animated.Value;
  animScale: Animated.Value;
  animOpacity: Animated.Value;
}

export const ChatScreen: React.FC<{ onOpenController: () => void }> = ({ onOpenController }) => {
  const {
    messages,
    sendMessage,
    sendTyping,
    typingUsers,
    isConnected,
    gameState,
    nickname,
    setNickname,
    roomId,
    setRoomId,
    serverHost,
    sendReaction,
    sendAction,
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

  // Create Group Form
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Profile Form
  const [tempNick, setTempNick] = useState(nickname);

  // Room PIN Form
  const [roomPin, setRoomPin] = useState('');

  // Floating Emoji Particles in active chat
  const [particles, setParticles] = useState<FloatingParticle[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Animations & Refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fabScaleAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<FlatList>(null);

  // Deterministic avatar pastel color hash (Item 31)
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
      const [roomsRes, usersRes] = await Promise.all([
        fetch(`http://${host}/api/rooms`),
        fetch(`http://${host}/api/users`),
      ]);

      if (roomsRes.ok) {
        const roomsData: RoomItem[] = await roomsRes.json();
        setRoomList(roomsData);
        const current = roomsData.find((r) => r.id === roomId);
        if (current) setCurrentRoomInfo(current);
      }

      if (usersRes.ok) {
        const usersData: ContactItem[] = await usersRes.json();
        setContacts(usersData);
      }
    } catch (e) {
      // Backend might be warming up
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, [roomId, serverHost]);

  // Auto-scroll to bottom on incoming messages (Item 30)
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

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

  // Typing indicator debounce & PIN formatter (Item 8 & 22)
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
    sendMessage(inputText.trim());
    setInputText('');
  };

  // Launch Debate inside current group
  const handleStartDebate = () => {
    sendAction('game:start', {
      game_type: 'debate',
      topic: 'Abacaxi na pizza é crime ou alta gastronomia?',
      debater_a_id: 'debater-a',
      debater_b_id: 'debater-b',
    });
    Alert.alert('⚖️ Debate Iniciado!', 'O modo debate começou nesta sala. Abra o telão ou controle!');
  };

  // Launch Quiz inside current group
  const handleStartQuiz = () => {
    sendAction('game:start', {
      game_type: 'quiz',
    });
    Alert.alert('⚡ Quiz Relâmpago Iniciado!', 'Preparem os buzzers!');
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
      // Check if a direct room already exists
      const existing = roomList.find(
        (r) => !r.is_group && (r.name === contact.nickname || r.members?.includes(contact.nickname))
      );
      if (existing) {
        handleSelectRoom(existing);
        return;
      }

      // Create new direct room
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
    } catch (e) {
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
    } catch (e) {
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
      const res = await fetch(`http://${host}/api/rooms/code/${clean}`);
      if (!res.ok) {
        Alert.alert('Código Inválido', 'Nenhuma sala encontrada com este código.');
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
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
    }
  };

  // Trigger Live Emoji Reaction with Multi-Stage Animation
  const handleTriggerReaction = (emoji: string) => {
    sendReaction(emoji);

    const newParticle: FloatingParticle = {
      id: Date.now() + Math.random(),
      emoji,
      x: Math.random() * 260 + 20,
      animY: new Animated.Value(0),
      animScale: new Animated.Value(0.4),
      animOpacity: new Animated.Value(1),
    };

    setParticles((prev) => [...prev.slice(-15), newParticle]);

    Animated.parallel([
      Animated.timing(newParticle.animY, {
        toValue: -350,
        duration: 1600,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.sequence([
        Animated.timing(newParticle.animScale, {
          toValue: 1.35,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(newParticle.animScale, {
          toValue: 1,
          duration: 1300,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(newParticle.animOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setParticles((prev) => prev.filter((p) => p.id !== newParticle.id));
    });
  };

  // Filtered Items for List
  const filteredRooms = roomList.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.code.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === 'groups') return r.is_group;
    if (activeTab === 'all') return true;
    return false;
  });

  const filteredContacts = contacts.filter((c) =>
    c.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render a Message Bubble
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.nickname === nickname;
    const isSystem = item.type === 'system';

    if (isSystem) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>✨ {item.content}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.otherMessageWrapper]}>
        {!isMe && <Text style={styles.senderName}>{item.nickname}</Text>}
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
            {item.content}
          </Text>
          <View style={styles.messageFooterRow}>
            <Text style={styles.messageTimeText}>
              {new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMe && <Text style={styles.checkMarkText}> ✓✓</Text>}
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
        {/* Offline Status Banner (Item 32) */}
        {!isConnected && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              ⚠️ Sem conexão com o servidor. Reconectando...
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
            {/* Quick Profile Pill */}
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => setShowProfileModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.profileBtnText}>👤 {nickname}</Text>
            </TouchableOpacity>

            {/* Room PIN Code Button */}
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
              💬 Conversas ({roomList.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'groups' && styles.activeTabItem]}
            onPress={() => setActiveTab('groups')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === 'groups' && styles.activeTabLabel]}>
              👥 Grupos ({roomList.filter((r) => r.is_group).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'contacts' && styles.activeTabItem]}
            onPress={() => setActiveTab('contacts')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === 'contacts' && styles.activeTabLabel]}>
              👤 Contatos ({contacts.length})
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
                ? 'Buscar nos contatos (Pedro, Otavio, Raul)...'
                : 'Buscar conversas ou grupos...'
            }
            placeholderTextColor="#888"
          />
        </View>

        {/* Content List with Pull-to-Refresh (Item 29) & Avatar Colors (Item 31) */}
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
                <View style={[styles.chatAvatar, { backgroundColor: getAvatarBgColor(item.id || item.nickname) }]}>
                  <Text style={styles.chatAvatarText}>
                    {item.nickname.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.chatInfo}>
                  <View style={styles.chatTitleRow}>
                    <Text style={styles.chatName}>{item.nickname}</Text>
                    <View style={styles.contactBadge}>
                      <Text style={styles.contactBadgeText}>Disponível</Text>
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
                      {isGroup ? '👥' : item.name.slice(0, 2).toUpperCase()}
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
                      {isGroup
                        ? `👥 ${item.members?.length || 3} participantes • Toque para abrir`
                        : '💬 Conversa direta • Toque para abrir'}
                    </Text>
                  </View>
                  <Text style={styles.chatArrow}>›</Text>
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
            <Text style={styles.fabIcon}>＋</Text>
            <Text style={styles.fabText}>Novo Grupo</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ================================================================== */}
        {/* MODAL: CRIAR NOVO GRUPO (WHATSAPP STYLE)                           */}
        {/* ================================================================== */}
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
                  <Text style={styles.modalCloseX}>✕</Text>
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
                        {isChecked && <Text style={styles.checkboxCheck}>✓</Text>}
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
                  {isCreatingGroup ? 'Criando Grupo...' : 'Criar Grupo 🚀'}
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
              <Text style={styles.modalTitle}>Meu Perfil no PORChat</Text>
              <Text style={styles.modalSubtitle}>
                Selecione uma conta rápida ou altere seu apelido:
              </Text>

              <View style={styles.demoButtonsRow}>
                {['Otavio', 'Pedro', 'Raul'].map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={[styles.demoBtn, nickname === name && styles.demoBtnActive]}
                    onPress={() => {
                      setNickname(name);
                      setTempNick(name);
                      setShowProfileModal(false);
                    }}
                  >
                    <Text style={[styles.demoBtnText, nickname === name && styles.demoBtnTextActive]}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.modalInput, { marginTop: 12 }]}
                value={tempNick}
                onChangeText={setTempNick}
                placeholder="Personalizar apelido..."
                placeholderTextColor="#999"
              />

              <TouchableOpacity
                style={styles.primaryModalBtn}
                onPress={() => {
                  if (tempNick.trim()) {
                    setNickname(tempNick.trim());
                    setShowProfileModal(false);
                  }
                }}
              >
                <Text style={styles.primaryModalBtnText}>Salvar Apelido</Text>
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

              <TouchableOpacity
                style={styles.pasteCodeBtn}
                onPress={async () => {
                  try {
                    const nav = typeof globalThis !== 'undefined' ? (globalThis as any).navigator : null;
                    if (Platform.OS === 'web' && nav?.clipboard?.readText) {
                      const text = await nav.clipboard.readText();
                      if (text) setRoomPin(formatRoomPin(text));
                    }
                  } catch (e) {}
                }}
              >
                <Text style={styles.pasteCodeBtnText}>📋 Colar Código</Text>
              </TouchableOpacity>

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
      {/* Offline Status Banner (Item 32) */}
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            ⚠️ Sem conexão com o servidor. Reconectando...
          </Text>
        </View>
      )}

      {/* Floating Reaction Particles Overlay */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {particles.map((p) => (
          <Animated.View
            key={p.id}
            style={[
              styles.floatingEmoji,
              {
                left: p.x,
                bottom: 80,
                opacity: p.animOpacity,
                transform: [{ translateY: p.animY }, { scale: p.animScale }],
              },
            ]}
          >
            <Text style={{ fontSize: 36 }}>{p.emoji}</Text>
          </Animated.View>
        ))}
      </View>

      {/* Top Conversation Header */}
      <View style={styles.chatViewHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentView('list')}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonArrow}>←</Text>
          <Text style={styles.backButtonText}>Conversas</Text>
        </TouchableOpacity>

        <View style={styles.chatViewTitleBlock}>
          <Text style={styles.chatViewRoomName} numberOfLines={1}>
            {currentRoomInfo?.name || 'Chat da Sala'}
          </Text>
          <Text style={styles.chatViewSubtitle} numberOfLines={1}>
            {isCurrentGroup
              ? `👥 ${currentRoomInfo?.members?.join(', ') || 'Pedro, Otavio, Raul'}`
              : '💬 Conversa Direta'}
          </Text>
        </View>

        {/* Quick Launch Game Actions */}
        <View style={styles.chatViewActions}>
          {isCurrentGroup && (
            <>
              <TouchableOpacity
                style={styles.gameActionMiniBtn}
                onPress={handleStartDebate}
                activeOpacity={0.7}
              >
                <Text style={styles.gameActionMiniText}>⚖️ Debate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.gameActionMiniBtn, { backgroundColor: '#FFF3BF' }]}
                onPress={handleStartQuiz}
                activeOpacity={0.7}
              >
                <Text style={[styles.gameActionMiniText, { color: '#D97706' }]}>⚡ Quiz</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Active Game Buzzer / Controller CTA */}
          {isGameActive && (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={styles.controllerCTA}
                onPress={onOpenController}
                activeOpacity={0.85}
              >
                <Text style={styles.controllerCTAText}>🎮 JOGAR</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Quick Leave Room Button (Item 36) */}
          <TouchableOpacity
            style={styles.leaveRoomIconBtn}
            onPress={() => setCurrentView('list')}
            activeOpacity={0.7}
          >
            <Text style={styles.leaveRoomIconText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

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
          ListFooterComponent={
            Object.keys(typingUsers).length > 0 ? (
              <View style={styles.typingRow}>
                {Object.values(typingUsers).map((u) => (
                  <Text key={u.nickname} style={styles.typingText}>
                    ✍️ {u.nickname} está digitando...
                  </Text>
                ))}
              </View>
            ) : null
          }
        />

        {/* Quick Emoji Reaction Bar (Item 21) */}
        <View style={styles.reactionBar}>
          <Text style={styles.reactionBarLabel}>Reagir ao vivo no telão:</Text>
          <View style={styles.reactionRow}>
            {['🔥', '💀', '🍅', '👏', '🤯', '👑', '🎯'].map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionButton}
                onPress={() => handleTriggerReaction(emoji)}
                activeOpacity={0.6}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Message Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleInputChange}
            placeholder={`Conversar como ${nickname}...`}
            placeholderTextColor="#888"
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend} activeOpacity={0.8}>
            <Text style={styles.sendButtonText}>Enviar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },

  // WhatsApp Header
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

  // WhatsApp Tab Bar
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

  // Search
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

  // List Items
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
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
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
    fontSize: 18,
    color: '#CED4DA',
    marginLeft: 8,
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
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#868E96',
    fontSize: 13,
  },

  // Floating Action Button (FAB)
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    elevation: 6,
    shadowColor: colors.brand.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
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

  // Active Chat View Header
  chatViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
  },
  backButtonArrow: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.brand.primary,
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

  // Chat Area & Speech Bubbles
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
  systemMessageText: {
    fontSize: 11,
    color: '#495057',
    fontWeight: '600',
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
    backgroundColor: '#E7FFDB', // WhatsApp light mint
    borderWidth: 1,
    borderColor: '#D0F0C0',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
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

  // Live Reaction Bar
  reactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F3F5',
  },
  reactionBarLabel: {
    fontSize: 10,
    color: '#868E96',
    fontWeight: '700',
    marginRight: 6,
  },
  reactionRow: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-around',
  },
  reactionButton: {
    padding: 4,
  },
  reactionEmoji: {
    fontSize: 20,
  },

  // Input Bar
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
  sendButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },

  // Floating Emoji
  floatingEmoji: {
    position: 'absolute',
    zIndex: 9999,
  },

  // Modals
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
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
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
    fontSize: 18,
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
    marginBottom: 12,
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
    marginBottom: 8,
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
    width: 22,
    height: 22,
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
    fontSize: 12,
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
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  demoBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F1F3F5',
    borderRadius: 12,
    alignItems: 'center',
  },
  demoBtnActive: {
    backgroundColor: colors.brand.primary,
  },
  demoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#495057',
  },
  demoBtnTextActive: {
    color: '#FFF',
  },
  messageFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
  },
  messageTimeText: {
    fontSize: 10,
    color: '#868E96',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  checkMarkText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.brand.primary,
  },
  pasteCodeBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  pasteCodeBtnText: {
    color: colors.brand.primary,
    fontWeight: 'bold',
    fontSize: 12,
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
  leaveRoomIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E9ECEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  leaveRoomIconText: {
    color: '#666',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
