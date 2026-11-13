import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { getAvatarBgColor, type RoomItem } from '../utils/chatHelpers';
import { AvatarBadge } from './AvatarBadge';
import { modalStyles } from './modalStyles';

interface RoomInfoModalProps {
  visible: boolean;
  roomId: string;
  roomInfo: RoomItem | null;
  nickname: string;
  onClose: () => void;
}

export const RoomInfoModal: React.FC<RoomInfoModalProps> = ({
  visible,
  roomId,
  roomInfo,
  nickname,
  onClose,
}) => {
  const isGroup = roomInfo?.is_group ?? true;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.modalBackdrop}>
        <View style={[modalStyles.modalCard, styles.card]}>
          <View style={modalStyles.profileModalHeader}>
            <Text style={modalStyles.modalTitle}>Informações da Sala</Text>
            <TouchableOpacity style={modalStyles.profileCloseIconBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#636E72" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.roomInfoHero}>
              <AvatarBadge
                name={roomInfo?.name || 'Chat'}
                color={isGroup ? colors.brand.primary : getAvatarBgColor(roomId)}
                avatarUrl={roomInfo?.avatar_url}
                size={68}
                rounded={false}
              />
              <Text style={styles.roomInfoName}>{roomInfo?.name || 'Sala'}</Text>
              <Text style={styles.roomInfoDesc}>
                {roomInfo?.description ||
                  'Sala de conversa em tempo real e jogos sincrônicos no PORChat.'}
              </Text>
            </View>

            {Boolean(roomInfo?.code) && (
              <View style={styles.roomPinBox}>
                <View>
                  <Text style={styles.roomPinLabel}>Código PIN da Sala</Text>
                  <Text style={styles.roomPinValue}>{roomInfo?.code}</Text>
                </View>
                <View style={styles.pinTagBadge}>
                  <Text style={styles.pinTagText}>Compartilhe com amigos</Text>
                </View>
              </View>
            )}

            <Text style={modalStyles.profileSectionLabel}>
              Participantes ({roomInfo?.members?.length || 1}):
            </Text>
            <View style={styles.roomMembersContainer}>
              {(roomInfo?.members || [nickname]).map((memName, idx) => {
                const isUserMe = memName.toLowerCase() === nickname.toLowerCase();
                const isAdmin = roomInfo?.admins?.includes(memName);
                return (
                  <View key={idx} style={styles.roomMemberRow}>
                    <AvatarBadge name={memName} size={34} />
                    <View style={styles.memberTextCol}>
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

            <TouchableOpacity style={modalStyles.closeModalBtn} onPress={onClose}>
              <Text style={modalStyles.closeModalBtnText}>Fechar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  card: {
    maxHeight: '85%',
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
  memberTextCol: {
    flex: 1,
    marginLeft: 10,
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
});
