import React from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { AVATAR_COLOR_OPTIONS, AVATAR_PRESETS, STATUS_PRESETS } from '../utils/chatHelpers';
import { AvatarBadge } from './AvatarBadge';
import { modalStyles } from './modalStyles';

interface ProfileModalProps {
  visible: boolean;
  currentNickname: string;
  tempNick: string;
  tempStatus: string;
  tempBio: string;
  tempAvatarColor: string;
  tempAvatarUrl: string;
  onChangeNick: (value: string) => void;
  onChangeStatus: (value: string) => void;
  onChangeBio: (value: string) => void;
  onChangeAvatarColor: (color: string) => void;
  onChangeAvatarUrl: (url: string) => void;
  onSave: () => Promise<void> | void;
  onLogout: () => void;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  visible,
  currentNickname,
  tempNick,
  tempStatus,
  tempBio,
  tempAvatarColor,
  tempAvatarUrl,
  onChangeNick,
  onChangeStatus,
  onChangeBio,
  onChangeAvatarColor,
  onChangeAvatarUrl,
  onSave,
  onLogout,
  onClose,
}) => {
  const handleLogoutPress = () => {
    onClose();
    Alert.alert('Sair da Conta', 'Deseja realmente sair do PORChat?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: onLogout },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.modalBackdrop}>
        <View style={[modalStyles.modalCard, styles.profileCard]}>
          <View style={modalStyles.profileModalHeader}>
            <Text style={modalStyles.modalTitle}>Perfil & Conta</Text>
            <TouchableOpacity style={modalStyles.profileCloseIconBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#636E72" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.avatarPreviewContainer}>
              <AvatarBadge
                name={tempNick || currentNickname}
                color={tempAvatarColor}
                avatarUrl={tempAvatarUrl}
                size={84}
              />
              <View style={styles.avatarPreviewBadge}>
                <Ionicons name="camera" size={14} color="#FFF" />
              </View>
            </View>

            <Text style={modalStyles.profileSectionLabel}>Fotos de Perfil Sugeridas:</Text>
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
                    onPress={() => onChangeAvatarUrl(presetUrl)}
                    style={[styles.presetAvatarBtn, isSelected && styles.presetAvatarBtnActive]}
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

            <View style={styles.customUrlInputRow}>
              <TextInput
                style={[modalStyles.modalInput, styles.customUrlInput]}
                value={tempAvatarUrl}
                onChangeText={onChangeAvatarUrl}
                placeholder="Ou cole a URL da foto (https://...)"
                placeholderTextColor="#999"
                autoCapitalize="none"
              />
              {Boolean(tempAvatarUrl) && (
                <TouchableOpacity
                  style={styles.clearPhotoBtn}
                  onPress={() => onChangeAvatarUrl('')}
                >
                  <Ionicons name="trash-outline" size={16} color="#FF7675" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={modalStyles.profileSectionLabel}>Cor do Monograma / Fundo:</Text>
            <View style={styles.colorPaletteGrid}>
              {AVATAR_COLOR_OPTIONS.map((c) => {
                const isSelected = tempAvatarColor.toLowerCase() === c.bg.toLowerCase();
                return (
                  <TouchableOpacity
                    key={c.id}
                    activeOpacity={0.8}
                    onPress={() => onChangeAvatarColor(c.bg)}
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

            <Text style={modalStyles.profileSectionLabel}>Apelido no Chat:</Text>
            <TextInput
              style={modalStyles.modalInput}
              value={tempNick}
              onChangeText={onChangeNick}
              placeholder="Seu apelido..."
              placeholderTextColor="#999"
            />

            <Text style={modalStyles.profileSectionLabel}>Recado de Status:</Text>
            <View style={styles.statusPresetsRow}>
              {STATUS_PRESETS.map((pst, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.statusPresetPill,
                    tempStatus === pst && styles.statusPresetPillActive,
                  ]}
                  onPress={() => onChangeStatus(pst)}
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
              style={modalStyles.modalInput}
              value={tempStatus}
              onChangeText={onChangeStatus}
              placeholder="Status personalizado..."
              placeholderTextColor="#999"
            />

            <Text style={modalStyles.profileSectionLabel}>Biografia Curta:</Text>
            <TextInput
              style={[modalStyles.modalInput, styles.bioInput]}
              value={tempBio}
              onChangeText={onChangeBio}
              placeholder="Compartilhe algo sobre você..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={2}
            />

            <TouchableOpacity style={modalStyles.primaryModalBtn} onPress={onSave}>
              <Text style={modalStyles.primaryModalBtnText}>Salvar Perfil</Text>
            </TouchableOpacity>

            <TouchableOpacity style={modalStyles.closeModalBtn} onPress={onClose}>
              <Text style={modalStyles.closeModalBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[modalStyles.closeModalBtn, styles.logoutBtn]}
              onPress={handleLogoutPress}
            >
              <Ionicons name="log-out-outline" size={18} color="#EF4444" style={styles.logoutIcon} />
              <Text style={[modalStyles.closeModalBtnText, styles.logoutText]}>
                Sair da Conta (Deslogar)
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  profileCard: {
    maxHeight: '90%',
  },
  scrollContent: {
    paddingBottom: 16,
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
  customUrlInput: {
    flex: 1,
    marginBottom: 0,
    fontSize: 12,
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
  logoutBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: {
    marginRight: 6,
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
});
