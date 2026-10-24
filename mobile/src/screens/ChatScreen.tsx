import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
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
    isConnected,
    gameState,
    nickname,
    setNickname,
    roomId,
    setRoomId,
    serverHost,
    setServerHost,
    sendReaction,
  } = useWebSocketContext();

  const [inputText, setInputText] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);

  // Profile Form State
  const [tempNick, setTempNick] = useState(nickname);

  // Room PIN Form State
  const [roomPin, setRoomPin] = useState('');
  const [roomList, setRoomList] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [currentRoomName, setCurrentRoomName] = useState('Lobby');

  // Floating Emoji Particles
  const [particles, setParticles] = useState<FloatingParticle[]>([]);

  // Pulse animation for controller button
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Fetch active rooms list
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const host = serverHost.trim() || 'localhost:8081';
        const res = await fetch(`http://${host}/api/rooms`);
        if (res.ok) {
          const data = await res.json();
          setRoomList(data);
          const current = data.find((r: { id: string }) => r.id === roomId);
          if (current) setCurrentRoomName(current.name);
        }
      } catch (e) {
        // Fallback
      }
    };
    fetchRooms();
  }, [roomId, serverHost]);

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

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText.trim());
    setInputText('');
  };

  const handleTriggerReaction = (emoji: string) => {
    sendReaction(emoji);

    // Spawn animated floating particle on mobile screen
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
          toValue: 1.3,
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
      const room = await res.json();
      setRoomId(room.id);
      setCurrentRoomName(room.name);
      setRoomPin('');
      setShowRoomModal(false);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
    }
  };

  const handleQuickProfile = (name: string) => {
    setNickname(name);
    setTempNick(name);
    setShowProfileModal(false);
  };

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
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
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
                transform: [
                  { translateY: p.animY },
                  { scale: p.animScale },
                ],
              },
            ]}
          >
            <Text style={{ fontSize: 36 }}>{p.emoji}</Text>
          </Animated.View>
        ))}
      </View>

      {/* Top Header */}
      <View style={styles.header}>
        {/* User Profile Pill */}
        <TouchableOpacity
          style={styles.profilePill}
          onPress={() => setShowProfileModal(true)}
          activeOpacity={0.8}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{nickname.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.profileNick}>{nickname}</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isConnected ? colors.brand.mint : colors.brand.action },
                ]}
              />
              <Text style={styles.statusText}>
                {isConnected ? 'Online' : 'Conectando'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Room Switcher / PIN Button */}
        <TouchableOpacity
          style={styles.roomBadge}
          onPress={() => setShowRoomModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.roomName} numberOfLines={1}>{currentRoomName}</Text>
          <Text style={styles.roomChangeAction}>Trocar Sala ▾</Text>
        </TouchableOpacity>

        {/* Game Active Controller Action */}
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
      </View>

      {/* Message Feed */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.chatArea}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
        />

        {/* Quick Emoji Reaction Bar */}
        <View style={styles.reactionBar}>
          <Text style={styles.reactionBarLabel}>Reagir ao vivo:</Text>
          <View style={styles.reactionRow}>
            {['🔥', '👏', '😂', '👑', '🤯', '💀'].map((emoji) => (
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
            onChangeText={setInputText}
            placeholder={`Conversar como ${nickname}...`}
            placeholderTextColor="#888"
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend} activeOpacity={0.8}>
            <Text style={styles.sendButtonText}>Enviar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ==================================================================== */}
      {/* ==================== MODAL 1: PERFIL & NICKNAME ==================== */}
      {/* ==================================================================== */}
      <Modal
        visible={showProfileModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Meu Perfil no PORChat</Text>
            <Text style={styles.modalSubtitle}>
              Altere seu apelido ou selecione uma conta de teste rápida:
            </Text>

            <TextInput
              style={styles.modalInput}
              value={tempNick}
              onChangeText={setTempNick}
              placeholder="Digite seu apelido..."
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

            <View style={styles.demoDivider}>
              <Text style={styles.demoDividerText}>OU ESCOLHA COM 1 TOQUE</Text>
            </View>

            <View style={styles.demoButtonsRow}>
              {['Otavio', 'Pedro', 'Raul'].map((name) => (
                <TouchableOpacity
                  key={name}
                  style={styles.demoBtn}
                  onPress={() => handleQuickProfile(name)}
                >
                  <Text style={styles.demoBtnText}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowProfileModal(false)}
            >
              <Text style={styles.closeModalBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================================== */}
      {/* ===================== MODAL 2: TROCAR DE SALA ====================== */}
      {/* ==================================================================== */}
      <Modal
        visible={showRoomModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRoomModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Entrar em uma Sala</Text>
            <Text style={styles.modalSubtitle}>
              Digite o código da sala ou escolha uma das salas públicas ativas:
            </Text>

            <TextInput
              style={[styles.modalInput, styles.pinInput]}
              value={roomPin}
              onChangeText={(t) => setRoomPin(t.toUpperCase())}
              placeholder="CÓDIGO (EX: POR-1000)"
              placeholderTextColor="#999"
              autoCapitalize="characters"
            />

            <TouchableOpacity style={styles.primaryModalBtn} onPress={handleJoinByPin}>
              <Text style={styles.primaryModalBtnText}>Entrar pelo Código</Text>
            </TouchableOpacity>

            <View style={styles.demoDivider}>
              <Text style={styles.demoDividerText}>SALAS PÚBLICAS DISPONÍVEIS</Text>
            </View>

            <FlatList
              data={roomList}
              keyExtractor={(r) => r.id}
              style={{ maxHeight: 180, width: '100%' }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.roomListItem,
                    item.id === roomId && styles.activeRoomListItem,
                  ]}
                  onPress={() => {
                    setRoomId(item.id);
                    setCurrentRoomName(item.name);
                    setShowRoomModal(false);
                  }}
                >
                  <Text style={styles.roomListText}>{item.name}</Text>
                  <Text style={styles.roomListCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowRoomModal(false)}
            >
              <Text style={styles.closeModalBtnText}>Fechar</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  profileNick: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
  },
  roomBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0EFFE',
    borderRadius: 14,
    alignItems: 'center',
    maxWidth: 130,
  },
  roomName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.brand.primary,
  },
  roomChangeAction: {
    fontSize: 9,
    color: colors.brand.primary,
    opacity: 0.8,
  },
  controllerCTA: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.brand.action,
    borderRadius: 16,
    shadowColor: colors.brand.action,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  controllerCTAText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  chatArea: {
    flex: 1,
  },
  messageList: {
    padding: 16,
    paddingBottom: 24,
  },
  messageWrapper: {
    marginBottom: 12,
    maxWidth: '82%',
  },
  myMessageWrapper: {
    alignSelf: 'flex-end',
  },
  otherMessageWrapper: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: 11,
    color: '#636E72',
    fontWeight: '700',
    marginBottom: 3,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  myBubble: {
    backgroundColor: colors.brand.primary,
    borderTopRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#2D3436',
  },
  systemMessageContainer: {
    alignSelf: 'center',
    backgroundColor: '#ECECF8',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginVertical: 8,
  },
  systemMessageText: {
    fontSize: 11,
    color: '#555',
    fontWeight: '600',
  },
  reactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  reactionBarLabel: {
    fontSize: 10,
    color: '#999',
    fontWeight: 'bold',
  },
  reactionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  reactionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  reactionEmoji: {
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F4F5F7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 14,
    color: '#2D3436',
  },
  sendButton: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  floatingEmoji: {
    position: 'absolute',
    pointerEvents: 'none',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2D3436',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalInput: {
    width: '100%',
    backgroundColor: '#F4F5F7',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#2D3436',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  pinInput: {
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  primaryModalBtn: {
    width: '100%',
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
  demoDivider: {
    marginVertical: 16,
  },
  demoDividerText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#AAA',
    letterSpacing: 1,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 16,
  },
  demoBtn: {
    flex: 1,
    backgroundColor: '#F0EFFE',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  demoBtnText: {
    color: colors.brand.primary,
    fontWeight: 'bold',
    fontSize: 12,
  },
  roomListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    marginBottom: 6,
    width: '100%',
  },
  activeRoomListItem: {
    backgroundColor: '#ECECF8',
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  roomListText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  roomListCode: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.brand.primary,
    fontWeight: 'bold',
  },
  closeModalBtn: {
    marginTop: 8,
    paddingVertical: 8,
  },
  closeModalBtnText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
});
