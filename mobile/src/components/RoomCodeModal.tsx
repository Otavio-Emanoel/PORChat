import React from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { formatRoomPin } from '../utils/chatHelpers';
import { modalStyles } from './modalStyles';

interface RoomCodeModalProps {
  visible: boolean;
  roomPin: string;
  onChangeRoomPin: (formatted: string) => void;
  onJoin: () => void;
  onClose: () => void;
}

export const RoomCodeModal: React.FC<RoomCodeModalProps> = ({
  visible,
  roomPin,
  onChangeRoomPin,
  onJoin,
  onClose,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.modalBackdrop}>
        <View style={modalStyles.modalCard}>
          <Text style={modalStyles.modalTitle}>Entrar por Código PIN</Text>
          <Text style={modalStyles.modalSubtitle}>Digite o código da sala (ex: POR-1000):</Text>

          <TextInput
            style={[modalStyles.modalInput, styles.pinInput]}
            value={roomPin}
            onChangeText={(text) => onChangeRoomPin(formatRoomPin(text))}
            placeholder="POR-1000"
            placeholderTextColor="#999"
            autoCapitalize="characters"
          />

          <TouchableOpacity style={modalStyles.primaryModalBtn} onPress={onJoin}>
            <Text style={modalStyles.primaryModalBtnText}>Entrar na Sala</Text>
          </TouchableOpacity>

          <TouchableOpacity style={modalStyles.closeModalBtn} onPress={onClose}>
            <Text style={modalStyles.closeModalBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  pinInput: {
    letterSpacing: 2,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
