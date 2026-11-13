import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../theme/colors';
import type { ContactItem } from '../utils/chatHelpers';
import { modalStyles } from './modalStyles';

interface CreateGroupModalProps {
  visible: boolean;
  newGroupName: string;
  contacts: ContactItem[];
  selectedContacts: string[];
  isCreatingGroup: boolean;
  onChangeGroupName: (value: string) => void;
  onToggleContact: (nickname: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  visible,
  newGroupName,
  contacts,
  selectedContacts,
  isCreatingGroup,
  onChangeGroupName,
  onToggleContact,
  onSubmit,
  onClose,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={modalStyles.modalBackdrop}
      >
        <View style={modalStyles.modalCard}>
          <View style={modalStyles.modalHeaderRow}>
            <Text style={modalStyles.modalTitle}>Novo Grupo</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.modalCloseX}>Fechar</Text>
            </TouchableOpacity>
          </View>

          <Text style={modalStyles.modalSubtitle}>
            Dê um nome ao grupo e escolha os amigos para convidar:
          </Text>

          <TextInput
            style={modalStyles.modalInput}
            value={newGroupName}
            onChangeText={onChangeGroupName}
            placeholder="Nome do grupo (ex: Amigos do Debate)"
            placeholderTextColor="#999"
          />

          <Text style={modalStyles.modalSectionLabel}>Selecione os contatos:</Text>

          <ScrollView style={styles.contactsScroll}>
            {contacts.map((c) => {
              const isChecked = selectedContacts.includes(c.nickname);
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    modalStyles.contactCheckRow,
                    isChecked && modalStyles.contactCheckRowActive,
                  ]}
                  onPress={() => onToggleContact(c.nickname)}
                  activeOpacity={0.7}
                >
                  <View style={modalStyles.contactAvatarSmall}>
                    <Text style={modalStyles.contactAvatarSmallText}>
                      {c.nickname.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={modalStyles.contactCheckName}>{c.nickname}</Text>
                    <Text style={modalStyles.contactCheckEmail}>{c.email}</Text>
                  </View>
                  <View style={[styles.checkboxBox, isChecked && styles.checkboxBoxActive]}>
                    {isChecked && <Text style={styles.checkboxCheck}>OK</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[modalStyles.primaryModalBtn, isCreatingGroup && styles.disabledBtn]}
            onPress={onSubmit}
            disabled={isCreatingGroup}
            activeOpacity={0.8}
          >
            <Text style={modalStyles.primaryModalBtnText}>
              {isCreatingGroup ? 'Criando Grupo...' : 'Criar Grupo'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  contactsScroll: {
    maxHeight: 180,
    marginBottom: 16,
  },
  contactInfo: {
    flex: 1,
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
  disabledBtn: {
    opacity: 0.7,
  },
});
