import React from 'react';
import {
  Image,
  Linking,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { modalStyles } from './modalStyles';

interface AttachmentModalsProps {
  showAttachmentMenu: boolean;
  onCloseAttachmentMenu: () => void;
  onPickImage: () => void;
  onTakePhoto: () => void;
  onPickDocument: () => void;
  onOpenCreatePoll: () => void;
  fullscreenImageUri: string | null;
  onCloseFullscreenImage: () => void;
  topInset: number;
}

export const AttachmentModals: React.FC<AttachmentModalsProps> = ({
  showAttachmentMenu,
  onCloseAttachmentMenu,
  onPickImage,
  onTakePhoto,
  onPickDocument,
  onOpenCreatePoll,
  fullscreenImageUri,
  onCloseFullscreenImage,
  topInset,
}) => {
  return (
    <>
      <Modal
        visible={showAttachmentMenu}
        transparent
        animationType="fade"
        onRequestClose={onCloseAttachmentMenu}
      >
        <TouchableOpacity
          style={modalStyles.actionSheetBackdrop}
          activeOpacity={1}
          onPress={onCloseAttachmentMenu}
        >
          <View style={modalStyles.actionSheetContainer} onStartShouldSetResponder={() => true}>
            <View style={modalStyles.actionSheetHandle} />
            <Text style={styles.attachmentSheetTitle}>Compartilhar no Chat</Text>

            <View style={styles.attachmentGrid}>
              <TouchableOpacity
                style={styles.attachmentTile}
                onPress={onPickImage}
                activeOpacity={0.8}
              >
                <View style={[styles.attachmentTileIconBox, { backgroundColor: '#F0EFFE' }]}>
                  <Ionicons name="images" size={24} color={colors.brand.primary} />
                </View>
                <Text style={styles.attachmentTileLabel}>Galeria</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.attachmentTile}
                onPress={onTakePhoto}
                activeOpacity={0.8}
              >
                <View style={[styles.attachmentTileIconBox, { backgroundColor: '#FFE5E5' }]}>
                  <Ionicons name="camera" size={24} color={colors.brand.action} />
                </View>
                <Text style={styles.attachmentTileLabel}>Câmera</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.attachmentTile}
                onPress={onPickDocument}
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
                  onCloseAttachmentMenu();
                  onOpenCreatePoll();
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
              style={modalStyles.actionSheetCancelBtn}
              activeOpacity={0.8}
              onPress={onCloseAttachmentMenu}
            >
              <Text style={modalStyles.actionSheetCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={Boolean(fullscreenImageUri)}
        transparent
        animationType="fade"
        onRequestClose={onCloseFullscreenImage}
      >
        <View style={styles.fullscreenBackdrop}>
          <View
            style={[
              styles.fullscreenHeader,
              {
                paddingTop: Math.max(
                  topInset,
                  Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 12
                ),
              },
            ]}
          >
            <TouchableOpacity style={styles.fullscreenCloseBtn} onPress={onCloseFullscreenImage}>
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
          </View>

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
    </>
  );
};

const styles = StyleSheet.create({
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
