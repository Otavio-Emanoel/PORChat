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
import { modalStyles } from './modalStyles';

interface CreatePollModalProps {
  visible: boolean;
  pollQuestion: string;
  pollOptions: string[];
  pollMultiSelect: boolean;
  onChangeQuestion: (question: string) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
  onChangeOption: (index: number, value: string) => void;
  onToggleMultiSelect: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  visible,
  pollQuestion,
  pollOptions,
  pollMultiSelect,
  onChangeQuestion,
  onAddOption,
  onRemoveOption,
  onChangeOption,
  onToggleMultiSelect,
  onSubmit,
  onClose,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={modalStyles.modalBackdrop}
      >
        <View style={[modalStyles.modalCard, styles.pollModalCard]}>
          <View style={modalStyles.modalHeaderRow}>
            <Text style={modalStyles.modalTitle}>Nova Enquete na Sala</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={modalStyles.modalCloseX}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={modalStyles.modalSubtitle}>
            Crie uma votação com opções personalizadas para o grupo:
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.pollModalScroll}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.modalFieldLabel}>Pergunta da Enquete</Text>
            <TextInput
              style={modalStyles.modalInput}
              value={pollQuestion}
              onChangeText={onChangeQuestion}
              placeholder="Ex: Qual o melhor jogo para jogar agora?"
              placeholderTextColor="#999"
            />

            <View style={styles.pollOptionsHeaderRow}>
              <Text style={styles.modalFieldLabel}>Opções ({pollOptions.length}/8)</Text>
              {pollOptions.length < 8 && (
                <TouchableOpacity style={styles.addOptionHeaderBtn} onPress={onAddOption}>
                  <Text style={styles.addOptionHeaderBtnText}>+ Adicionar Opção</Text>
                </TouchableOpacity>
              )}
            </View>

            {pollOptions.map((opt, idx) => (
              <View key={idx} style={styles.pollOptionInputRow}>
                <View style={styles.pollOptionNumberBadge}>
                  <Text style={styles.pollOptionNumberText}>{idx + 1}</Text>
                </View>
                <TextInput
                  style={[modalStyles.modalInput, styles.pollOptionInputFlex]}
                  value={opt}
                  onChangeText={(val) => onChangeOption(idx, val)}
                  placeholder={`Opção ${idx + 1}${idx < 2 ? ' (obrigatória)' : ''}`}
                  placeholderTextColor="#999"
                />
                {pollOptions.length > 2 && (
                  <TouchableOpacity
                    style={styles.removeOptionBtn}
                    onPress={() => onRemoveOption(idx)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.removeOptionBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {pollOptions.length < 8 && (
              <TouchableOpacity style={styles.addOptionDashedBtn} onPress={onAddOption}>
                <Text style={styles.addOptionDashedBtnText}>+ Adicionar outra opção</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                modalStyles.contactCheckRow,
                pollMultiSelect && modalStyles.contactCheckRowActive,
              ]}
              onPress={onToggleMultiSelect}
            >
              <View
                style={[
                  styles.pollMultiSelectBox,
                  pollMultiSelect && styles.pollMultiSelectBoxActive,
                ]}
              >
                {pollMultiSelect && <Text style={styles.pollMultiSelectCheck}>✓</Text>}
              </View>
              <Text style={modalStyles.contactCheckName}>Permitir múltiplos votos</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity style={modalStyles.primaryModalBtn} onPress={onSubmit}>
            <Text style={modalStyles.primaryModalBtnText}>Publicar Enquete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={modalStyles.closeModalBtn} onPress={onClose}>
            <Text style={modalStyles.closeModalBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  pollModalCard: {
    maxHeight: '85%',
  },
  pollModalScroll: {
    maxHeight: 320,
    marginBottom: 8,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 6,
    marginTop: 4,
  },
  pollOptionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  addOptionHeaderBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#EFEBFD',
  },
  addOptionHeaderBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.brand.primary,
  },
  pollOptionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  pollOptionNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollOptionNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#636E72',
  },
  pollOptionInputFlex: {
    flex: 1,
    marginBottom: 0,
  },
  removeOptionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeOptionBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.brand.action,
  },
  addOptionDashedBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CED4DA',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  addOptionDashedBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand.primary,
  },
  pollMultiSelectBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#CED4DA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#FFFFFF',
  },
  pollMultiSelectBoxActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  pollMultiSelectCheck: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
  },
});
