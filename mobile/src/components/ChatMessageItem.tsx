import React from 'react';
import { Alert, Image, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { ChatMessage } from '../types';
import {
  POLL_PALETTE,
  REACTION_EMOJIS,
  getMobileReplyPreviewMeta,
  getReactionMeta,
  resolveMobileMediaUrl,
} from '../utils/chatHelpers';
import { AvatarBadge } from './AvatarBadge';
import { ReplyPreviewContent } from './ReplyPreviewContent';

interface ChatMessageItemProps {
  item: ChatMessage;
  allMessages: ChatMessage[];
  nickname: string;
  serverHost: string;
  playingAudioId: string | null;
  onLongPress: (msg: ChatMessage) => void;
  onPressReplyJump: (replyMessageId: string) => void;
  onVotePoll: (messageId: string, optionId: string) => void;
  onClosePoll: (messageId: string) => void;
  onOpenImage: (uri: string) => void;
  onToggleAudio: (messageId: string) => void;
  onReact: (messageId: string, key: string, emoji: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  item,
  allMessages,
  nickname,
  serverHost,
  playingAudioId,
  onLongPress,
  onPressReplyJump,
  onVotePoll,
  onClosePoll,
  onOpenImage,
  onToggleAudio,
  onReact,
}) => {
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
    item.attachment?.data_url || resolveMobileMediaUrl(item.attachment?.url, serverHost);

  if (isSystem || isGameCard) {
    return (
      <View style={[styles.systemMessageContainer, isGameCard && styles.gameCardMessageContainer]}>
        <Text style={[styles.systemMessageText, isGameCard && styles.gameCardMessageText]}>
          {item.content}
        </Text>
      </View>
    );
  }

  const repliedMsg = item.reply_preview
    ? allMessages.find((m) => m.id === item.reply_preview?.id) ||
      allMessages.find((m) => m.id === item.reply_to_id)
    : undefined;
  const replyMeta = item.reply_preview
    ? getMobileReplyPreviewMeta(item.reply_preview, serverHost, repliedMsg)
    : null;

  return (
    <View style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.otherMessageWrapper]}>
      <View style={!isMe ? styles.messageWithAvatarRow : undefined}>
        {!isMe && <AvatarBadge name={item.nickname} size={30} />}
        <View style={!isMe ? styles.messageContentCol : undefined}>
          {!isMe && <Text style={styles.senderName}>{item.nickname}</Text>}
          <TouchableOpacity
            activeOpacity={0.85}
            onLongPress={() => onLongPress(item)}
            style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}
          >
            {/* Rich Reply Preview */}
            {item.reply_preview && replyMeta && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.replyPreviewBox}
                onPress={() => {
                  if (item.reply_preview?.id) {
                    onPressReplyJump(item.reply_preview.id);
                  }
                }}
              >
                <View style={styles.replyPreviewInnerRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.replyPreviewSender}>{item.reply_preview.nickname}</Text>
                    <View style={styles.replyPreviewContentRow}>
                      <ReplyPreviewContent meta={replyMeta} iconSize={12} textVariant="bubble" />
                    </View>
                  </View>
                  {replyMeta.kind === 'image' && replyMeta.imageUri ? (
                    <Image
                      source={{ uri: replyMeta.imageUri }}
                      style={styles.replyPreviewThumbnail}
                      resizeMode="cover"
                    />
                  ) : null}
                </View>
              </TouchableOpacity>
            )}

            {/* Message Body by Type */}
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
                              onPress={() => onVotePoll(item.id, opt.id)}
                            >
                              {pct > 0 && (
                                <View
                                  style={[
                                    styles.pollOptionProgressBar,
                                    { width: `${pct}%`, backgroundColor: optColor.fill },
                                  ]}
                                />
                              )}

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

                      <View style={styles.pollFooterRow}>
                        <Text style={styles.pollFooterTotalText}>
                          {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}
                          {item.poll.multi_select ? ' • Múltipla escolha' : ''}
                        </Text>

                        {!item.poll.is_closed &&
                          item.poll.created_by.toLowerCase() === nickname.toLowerCase() && (
                            <TouchableOpacity
                              style={styles.closePollBtn}
                              onPress={() => onClosePoll(item.id)}
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
                    onPress={() => onOpenImage(attachmentUrl)}
                    onLongPress={() => onLongPress(item)}
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
                    <Ionicons
                      name="image-outline"
                      size={12}
                      color={isMe ? '#2E7D32' : '#868E96'}
                    />
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
                  onLongPress={() => onLongPress(item)}
                  style={[styles.fileCard, isMe ? styles.fileCardMe : styles.fileCardOther]}
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
                  style={[styles.voicePlayBtn, isMe && { backgroundColor: '#2E7D32' }]}
                  onPress={() => onToggleAudio(item.id)}
                >
                  <Ionicons
                    name={playingAudioId === item.id ? 'pause' : 'play'}
                    size={15}
                    color="#FFF"
                  />
                </TouchableOpacity>
                <View style={styles.waveformContainer}>
                  {(
                    item.attachment?.waveform || [
                      30, 60, 45, 80, 50, 95, 40, 70, 85, 55, 65, 40, 75, 50, 30,
                    ]
                  ).map((h, i) => (
                    <View
                      key={i}
                      style={[
                        styles.waveformBar,
                        { height: Math.max(6, Math.min(24, Math.round(h * 0.24))) },
                        isMe
                          ? { backgroundColor: playingAudioId === item.id ? '#1B5E20' : '#81C784' }
                          : {
                              backgroundColor:
                                playingAudioId === item.id ? colors.brand.primary : '#A29BFE',
                            },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.voiceDurationText, isMe && { color: '#2E7D32' }]}>
                  {item.attachment?.duration_seconds
                    ? `${Math.floor(item.attachment.duration_seconds / 60)}:${(
                        item.attachment.duration_seconds % 60
                      )
                        .toString()
                        .padStart(2, '0')}`
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

          {/* Reaction Badges */}
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
                    onPress={() => onReact(item.id, key, REACTION_EMOJIS[key] || '✨')}
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

const styles = StyleSheet.create({
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
  messageWithAvatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageContentCol: {
    flex: 1,
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
  reactionPillCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
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
});
