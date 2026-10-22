import React, { useState } from 'react';
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
} from 'react-native';
import { useWebSocketContext } from '../context/WebSocketContext';
import { colors } from '../theme/colors';
import type { ChatMessage } from '../types';

export const ChatScreen: React.FC<{ onOpenController: () => void }> = ({ onOpenController }) => {
  const { messages, sendMessage, isConnected, gameState, nickname, serverHost, setServerHost } = useWebSocketContext();
  const [inputText, setInputText] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [hostInput, setHostInput] = useState(serverHost);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText.trim());
    setInputText('');
  };

  const handleSaveHost = () => {
    if (!hostInput.trim()) return;
    setServerHost(hostInput.trim());
    setShowConfig(false);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.nickname === nickname;
    const isSystem = item.type === 'system';

    if (isSystem) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.content}</Text>
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

  const isGameActive = gameState && gameState.phase !== 'CHAT';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>PORChat</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? colors.brand.mint : colors.brand.action }]} />
            <Text style={styles.statusText}>
              {isConnected ? `Conectado (${serverHost})` : 'Reconectando...'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.configButton}
            onPress={() => setShowConfig(!showConfig)}
          >
            <Text style={styles.configButtonText}>⚙️ IP Host</Text>
          </TouchableOpacity>

          {isGameActive && (
            <TouchableOpacity style={styles.controllerButton} onPress={onOpenController}>
              <Text style={styles.controllerButtonText}>🎮 ABRIR CONTROLE</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* LAN Host Configuration Drawer */}
      {showConfig && (
        <View style={styles.configDrawer}>
          <Text style={styles.configTitle}>Configurar Servidor (LAN / Wi-Fi)</Text>
          <Text style={styles.configDesc}>
            Para testar no celular físico, insira o IP do computador na rede local (ex: 192.168.1.100:8080):
          </Text>

          <TextInput
            style={styles.hostTextInput}
            value={hostInput}
            onChangeText={setHostInput}
            placeholder="IP:Porta (ex: 192.168.1.50:8080)"
            placeholderTextColor={colors.ink.muted}
            autoCapitalize="none"
          />

          <View style={styles.presetRow}>
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => setHostInput('localhost:8080')}
            >
              <Text style={styles.presetButtonText}>Localhost</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => setHostInput('10.0.2.2:8080')}
            >
              <Text style={styles.presetButtonText}>Emulador (10.0.2.2)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveHostButton} onPress={handleSaveHost}>
              <Text style={styles.saveHostButtonText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Active Game Notice Banner */}
      {isGameActive && (
        <TouchableOpacity style={styles.gameBanner} onPress={onOpenController}>
          <Text style={styles.gameBannerTitle}>
            {gameState.game_type === 'quiz' ? '⚡ Quiz Relâmpago Ativo!' : '⚖️ Modo Debate em Julgamento!'}
          </Text>
          <Text style={styles.gameBannerSubtitle}>
            Toque para abrir a tela de controle do jogo ({gameState.remaining_seconds}s)
          </Text>
        </TouchableOpacity>
      )}

      {/* Chat Messages List */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
      />

      {/* Input Bar */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={`Mensagem como ${nickname}...`}
            placeholderTextColor={colors.ink.muted}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
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
    backgroundColor: colors.surface.light,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink.main,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    color: colors.ink.muted,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  configButton: {
    backgroundColor: colors.surface.light,
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  configButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink.main,
  },
  controllerButton: {
    backgroundColor: colors.brand.action,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  controllerButtonText: {
    color: colors.surface.white,
    fontWeight: '800',
    fontSize: 12,
  },
  configDrawer: {
    backgroundColor: '#EDF2F7',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
    gap: 8,
  },
  configTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink.main,
  },
  configDesc: {
    fontSize: 11,
    color: colors.ink.muted,
    lineHeight: 16,
  },
  hostTextInput: {
    backgroundColor: colors.surface.white,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.ink.main,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
  },
  presetButton: {
    backgroundColor: colors.surface.white,
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  presetButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink.muted,
  },
  saveHostButton: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  saveHostButtonText: {
    color: colors.surface.white,
    fontWeight: '800',
    fontSize: 12,
  },
  gameBanner: {
    backgroundColor: colors.brand.primary,
    padding: 12,
    alignItems: 'center',
  },
  gameBannerTitle: {
    color: colors.surface.white,
    fontWeight: '800',
    fontSize: 14,
  },
  gameBannerSubtitle: {
    color: colors.brand.reward,
    fontSize: 12,
    marginTop: 2,
  },
  messagesList: {
    padding: 16,
    gap: 10,
  },
  messageWrapper: {
    maxWidth: '80%',
    marginBottom: 6,
  },
  myMessageWrapper: {
    alignSelf: 'flex-end',
  },
  otherMessageWrapper: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: 11,
    color: colors.ink.muted,
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: colors.brand.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: colors.surface.white,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: colors.surface.white,
  },
  otherMessageText: {
    color: colors.ink.main,
  },
  systemMessageContainer: {
    alignSelf: 'center',
    backgroundColor: 'rgba(253, 203, 110, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginVertical: 4,
  },
  systemMessageText: {
    fontSize: 12,
    color: colors.ink.main,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: colors.surface.white,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface.light,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink.main,
  },
  sendButton: {
    backgroundColor: colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  sendButtonText: {
    color: colors.surface.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
