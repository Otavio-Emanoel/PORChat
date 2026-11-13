import React from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { ChatMessage, PinnedMessageInfo } from '../types';
import {
  QUICK_ACTION_REACTIONS,
  REACTION_CONFIG,
  REACTION_EMOJIS,
  type ReplyTarget,
} from '../utils/chatHelpers';
import { modalStyles } from './modalStyles';

interface MessageActionSheetProps {
  selectedMessage: ChatMessage | null;
  nickname: string;
  pinnedMessage: PinnedMessageInfo | null;
  bottomInset: number;
  scaleAnim: Animated.Value;
  opacityAnim: Animated.Value;
  translateAnim: Animated.Value;
  onClose: () => void;
  onReact: (messageId: string, key: string, emoji: string) => void;
  onReply: (target: ReplyTarget) => void;
  onTogglePin: (messageId: string) => void;
  onEdit: (msg: { id: string; content: string }) => void;
  onDelete: (messageId: string) => void;
}

export const MessageActionSheet: React.FC<MessageActionSheetProps> = ({
  selectedMessage,
  nickname,
  pinnedMessage,
  bottomInset,
  scaleAnim,
  opacityAnim,
  translateAnim,
  onClose,
  onReact,
  onReply,
  onTogglePin,
  onEdit,
  onDelete,
}) => {
  const isPinned = Boolean(selectedMessage && pinnedMessage?.message_id === selectedMessage.id);
  const isOwn = selectedMessage?.nickname === nickname;

  return (
    <Modal visible={Boolean(selectedMessage)} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={modalStyles.actionSheetBackdrop} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[
            modalStyles.actionSheetContainer,
            {
              paddingBottom: Math.max(bottomInset + 16, 24),
              transform: [{ scale: scaleAnim }, { translateY: translateAnim }],
              opacity: opacityAnim,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={modalStyles.actionSheetHandle} />

          <View style={styles.quickReactionBar}>
            {QUICK_ACTION_REACTIONS.map((rKey) => {
              const meta = REACTION_CONFIG[rKey];
              const isSelected = Boolean(
                selectedMessage?.reactions?.[rKey]?.some(
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
                    if (selectedMessage) {
                      onReact(selectedMessage.id, rKey, REACTION_EMOJIS[rKey] || '✨');
                      onClose();
                    }
                  }}
                >
                  <Ionicons name={meta.iconName} size={22} color={meta.color} />
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedMessage && (
            <View style={styles.actionSheetPreviewCard}>
              <View style={styles.actionSheetPreviewAccent} />
              <View style={styles.actionSheetPreviewContent}>
                <Text style={styles.actionSheetPreviewSender}>{selectedMessage.nickname}</Text>
                <Text style={styles.actionSheetPreviewText} numberOfLines={2}>
                  {selectedMessage.content}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.actionSheetItemsList}>
            <TouchableOpacity
              style={styles.actionSheetRow}
              activeOpacity={0.7}
              onPress={() => {
                if (selectedMessage) {
                  onReply({
                    id: selectedMessage.id,
                    nickname: selectedMessage.nickname,
                    content: selectedMessage.content,
                    type: selectedMessage.type,
                    attachment: selectedMessage.attachment,
                    poll: selectedMessage.poll,
                  });
                  onClose();
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
                if (selectedMessage) {
                  onTogglePin(selectedMessage.id);
                  onClose();
                }
              }}
            >
              <View style={[styles.actionSheetIconWrapper, { backgroundColor: '#FFF8E7' }]}>
                <Ionicons name="pin-outline" size={18} color="#D4A017" />
              </View>
              <Text style={styles.actionSheetRowText}>
                {isPinned ? 'Desafixar do Topo' : 'Fixar no Topo'}
              </Text>
            </TouchableOpacity>

            {isOwn && selectedMessage?.type === 'text' && (
              <TouchableOpacity
                style={styles.actionSheetRow}
                activeOpacity={0.7}
                onPress={() => {
                  if (selectedMessage) {
                    onEdit({ id: selectedMessage.id, content: selectedMessage.content });
                    onClose();
                  }
                }}
              >
                <View style={[styles.actionSheetIconWrapper, { backgroundColor: '#E0F9F8' }]}>
                  <Ionicons name="pencil-outline" size={18} color="#008B87" />
                </View>
                <Text style={styles.actionSheetRowText}>Editar Mensagem</Text>
              </TouchableOpacity>
            )}

            {isOwn && (
              <TouchableOpacity
                style={[styles.actionSheetRow, styles.actionSheetRowDestructive]}
                activeOpacity={0.7}
                onPress={() => {
                  if (selectedMessage) {
                    onDelete(selectedMessage.id);
                    onClose();
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

          <TouchableOpacity
            style={modalStyles.actionSheetCancelBtn}
            activeOpacity={0.8}
            onPress={onClose}
          >
            <Text style={modalStyles.actionSheetCancelText}>Fechar</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
});
