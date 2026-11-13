import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import type { MatchHistoryRecord, RoomLeaderboardEntry } from '../types';
import { modalStyles } from './modalStyles';

interface LeaderboardModalProps {
  visible: boolean;
  leaderboardData: RoomLeaderboardEntry[];
  historyData: MatchHistoryRecord[];
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  visible,
  leaderboardData,
  historyData,
  onClose,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.modalBackdrop}>
        <View style={modalStyles.modalCard}>
          <Text style={modalStyles.modalTitle}>Ranking & Histórico da Sala</Text>
          <Text style={modalStyles.modalSubtitle}>
            Pontuação oficial acumulada em Debates e Quizzes:
          </Text>

          <ScrollView style={styles.scroll}>
            {leaderboardData.length === 0 ? (
              <Text style={styles.emptyStateText}>
                Nenhuma partida finalizada nesta sala ainda.
              </Text>
            ) : (
              leaderboardData.map((entry, idx) => (
                <View key={entry.user_id} style={modalStyles.contactCheckRow}>
                  <View style={modalStyles.contactAvatarSmall}>
                    <Text style={modalStyles.contactAvatarSmallText}>#{idx + 1}</Text>
                  </View>
                  <View style={styles.flexOne}>
                    <Text style={modalStyles.contactCheckName}>{entry.nickname}</Text>
                    <Text style={modalStyles.contactCheckEmail}>
                      {entry.debates_won} vitórias Debate • {entry.quiz_wins} vitórias Quiz
                    </Text>
                  </View>
                  <Text style={styles.pointsText}>{entry.total_points} pts</Text>
                </View>
              ))
            )}

            {historyData.length > 0 && (
              <View style={styles.historySection}>
                <Text style={modalStyles.modalSectionLabel}>Últimas Partidas:</Text>
                {historyData.slice(0, 5).map((m) => (
                  <View key={m.id} style={modalStyles.contactCheckRow}>
                    <View style={styles.flexOne}>
                      <Text style={modalStyles.contactCheckName}>{m.title}</Text>
                      <Text style={modalStyles.contactCheckEmail}>
                        Vencedor: {m.winner_nickname}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[modalStyles.primaryModalBtn, styles.closeBtn]}
            onPress={onClose}
          >
            <Text style={modalStyles.primaryModalBtnText}>Fechar Ranking</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 320,
  },
  emptyStateText: {
    color: '#868E96',
    fontSize: 13,
  },
  flexOne: {
    flex: 1,
  },
  pointsText: {
    fontWeight: '900',
    color: colors.brand.primary,
  },
  historySection: {
    marginTop: 12,
  },
  closeBtn: {
    marginTop: 12,
  },
});
