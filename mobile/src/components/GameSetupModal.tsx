import React from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import type { TriviaDifficulty } from '../types';
import { modalStyles } from './modalStyles';

const QUIZ_CATEGORIES = [
  'Todas',
  'Tecnologia',
  'Games',
  'Ciência',
  'História',
  'Cultura Pop',
] as const;

const QUIZ_DIFFICULTIES: TriviaDifficulty[] = ['Todas', 'Fácil', 'Média', 'Difícil'];
const QUIZ_ROUND_COUNTS = [3, 5, 8, 10] as const;

interface GameSetupModalProps {
  visible: boolean;
  mode: 'debate' | 'quiz';
  debateTopic: string;
  debateSideA: string;
  debateSideB: string;
  quizCategory: string;
  quizDifficulty: TriviaDifficulty;
  quizRoundCount: number;
  onChangeDebateTopic: (topic: string) => void;
  onChangeDebateSideA: (nickname: string) => void;
  onChangeDebateSideB: (nickname: string) => void;
  onChangeQuizCategory: (category: string) => void;
  onChangeQuizDifficulty: (difficulty: TriviaDifficulty) => void;
  onChangeQuizRoundCount: (count: number) => void;
  onLaunch: () => void;
  onClose: () => void;
}

export const GameSetupModal: React.FC<GameSetupModalProps> = ({
  visible,
  mode,
  debateTopic,
  debateSideA,
  debateSideB,
  quizCategory,
  quizDifficulty,
  quizRoundCount,
  onChangeDebateTopic,
  onChangeDebateSideA,
  onChangeDebateSideB,
  onChangeQuizCategory,
  onChangeQuizDifficulty,
  onChangeQuizRoundCount,
  onLaunch,
  onClose,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.modalBackdrop}>
        <View style={modalStyles.modalCard}>
          <Text style={modalStyles.modalTitle}>
            {mode === 'debate' ? 'Configurar Modo Debate' : 'Configurar Quiz Relâmpago'}
          </Text>

          {mode === 'debate' ? (
            <View style={styles.sectionBody}>
              <Text style={modalStyles.modalSectionLabel}>Tema do Debate (opcional):</Text>
              <TextInput
                style={modalStyles.modalInput}
                value={debateTopic}
                onChangeText={onChangeDebateTopic}
                placeholder="Deixe em branco para sortear tema..."
                placeholderTextColor="#999"
              />
              <Text style={modalStyles.modalSectionLabel}>Debatedor Lado A (Coral):</Text>
              <TextInput
                style={modalStyles.modalInput}
                value={debateSideA}
                onChangeText={onChangeDebateSideA}
                placeholder="Apelido Lado A"
                placeholderTextColor="#999"
              />
              <Text style={modalStyles.modalSectionLabel}>Debatedor Lado B (Menta):</Text>
              <TextInput
                style={modalStyles.modalInput}
                value={debateSideB}
                onChangeText={onChangeDebateSideB}
                placeholder="Apelido Lado B"
                placeholderTextColor="#999"
              />
            </View>
          ) : (
            <View style={styles.sectionBody}>
              <Text style={modalStyles.modalSectionLabel}>Categoria:</Text>
              <View style={styles.categoriesRow}>
                {QUIZ_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => onChangeQuizCategory(cat)}
                    style={[
                      styles.chipBtn,
                      quizCategory === cat && { backgroundColor: colors.brand.primary },
                    ]}
                  >
                    <Text style={[styles.chipBtnText, quizCategory === cat && { color: '#FFF' }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={modalStyles.modalSectionLabel}>Dificuldade:</Text>
              <View style={styles.difficultiesRow}>
                {QUIZ_DIFFICULTIES.map((diff) => (
                  <TouchableOpacity
                    key={diff}
                    onPress={() => onChangeQuizDifficulty(diff)}
                    style={[
                      styles.chipBtn,
                      quizDifficulty === diff && { backgroundColor: colors.brand.primary },
                    ]}
                  >
                    <Text style={[styles.chipBtnText, quizDifficulty === diff && { color: '#FFF' }]}>
                      {diff}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={modalStyles.modalSectionLabel}>
                Rodadas ({quizRoundCount} perguntas):
              </Text>
              <View style={styles.roundsRow}>
                {QUIZ_ROUND_COUNTS.map((cnt) => (
                  <TouchableOpacity
                    key={cnt}
                    onPress={() => onChangeQuizRoundCount(cnt)}
                    style={[
                      styles.chipBtn,
                      quizRoundCount === cnt && { backgroundColor: colors.brand.primary },
                    ]}
                  >
                    <Text style={[styles.chipBtnText, quizRoundCount === cnt && { color: '#FFF' }]}>
                      {cnt}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity style={modalStyles.primaryModalBtn} onPress={onLaunch}>
            <Text style={modalStyles.primaryModalBtnText}>Iniciar Partida na Sala</Text>
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
  sectionBody: {
    marginVertical: 10,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  difficultiesRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  roundsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  chipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F1F3F5',
    borderRadius: 14,
  },
  chipBtnText: {
    color: '#495057',
    fontWeight: '700',
    fontSize: 12,
  },
});
