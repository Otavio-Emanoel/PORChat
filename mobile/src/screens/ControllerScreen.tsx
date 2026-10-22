import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { useWebSocketContext } from '../context/WebSocketContext';
import { colors } from '../theme/colors';

export const ControllerScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { gameState, castVote, sendReaction, submitArgument, nickname } = useWebSocketContext();
  const [argumentText, setArgumentText] = useState('');
  const [votedSide, setVotedSide] = useState<'side_a' | 'side_b' | null>(null);

  const phase = gameState?.phase || 'CHAT';
  const remaining = gameState?.remaining_seconds ?? 0;
  const debate = gameState?.debate_state;

  const handleVote = (side: 'side_a' | 'side_b') => {
    setVotedSide(side);
    castVote(side);
  };

  const handleSubmitArg = () => {
    if (!argumentText.trim()) return;
    submitArgument(argumentText.trim());
    setArgumentText('');
  };

  const isDebater =
    debate?.debater_a?.nickname === nickname ||
    debate?.debater_b?.nickname === nickname;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Controller Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Text style={styles.backButtonText}>← Voltar ao Chat</Text>
        </TouchableOpacity>
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{remaining}s</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Phase & Topic Card */}
        <View style={styles.topicCard}>
          <Text style={styles.phaseBadge}>FASE: {phase}</Text>
          <Text style={styles.topicText}>"{debate?.topic || 'Abacaxi na pizza é crime ou alta gastronomia?'}"</Text>
        </View>

        {/* Dynamic Views per Phase */}
        {phase === 'LOBBY' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>⚖️ Tribunal em Preparação</Text>
            <Text style={styles.sectionSubtitle}>
              Prepare-se! Em instantes os debatedores apresentarão suas teses de acusação e defesa.
            </Text>
            <View style={styles.matchupRow}>
              <View style={[styles.playerBadge, { borderColor: colors.brand.action }]}>
                <Text style={[styles.playerBadgeLabel, { color: colors.brand.action }]}>LADO A</Text>
                <Text style={styles.playerBadgeName}>{debate?.debater_a?.nickname || 'Defesa A'}</Text>
              </View>
              <Text style={styles.vsText}>VS</Text>
              <View style={[styles.playerBadge, { borderColor: colors.brand.mint }]}>
                <Text style={[styles.playerBadgeLabel, { color: colors.brand.mint }]}>LADO B</Text>
                <Text style={styles.playerBadgeName}>{debate?.debater_b?.nickname || 'Defesa B'}</Text>
              </View>
            </View>
          </View>
        )}

        {(phase === 'OPENING_ARGUMENTS' || phase === 'REBUTTAL') && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {phase === 'OPENING_ARGUMENTS' ? 'Argumentos Iniciais' : 'Fase de Réplica'}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {isDebater
                ? 'Você é um dos debatedores! Digite sua tese e envie para o palco:'
                : 'Você está no júri. Acompanhe os argumentos ao vivo e prepare seu voto:'}
            </Text>

            <TextInput
              style={styles.textArea}
              value={argumentText}
              onChangeText={setArgumentText}
              placeholder="Digite seu argumento ou ponto de vista aqui..."
              placeholderTextColor={colors.ink.muted}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity style={styles.submitArgButton} onPress={handleSubmitArg}>
              <Text style={styles.submitArgButtonText}>Enviar Argumento ao Palco</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Voting View (Massive Tactile Buzzer Buttons) */}
        {phase === 'VOTING' && (
          <View style={styles.votingContainer}>
            <Text style={styles.votingTitle}>Qual lado venceu?</Text>
            <Text style={styles.votingSubtitle}>Toque no cartão para computar seu voto na TV:</Text>

            {/* Side A (Coral) Tactile Button */}
            <TouchableOpacity
              activeOpacity={0.75}
              style={[
                styles.hugeVoteButton,
                styles.voteButtonSideA,
                votedSide === 'side_a' && styles.selectedVoteButton,
              ]}
              onPress={() => handleVote('side_a')}
            >
              <Text style={styles.hugeVoteButtonLabel}>LADO A (CORAL)</Text>
              <Text style={styles.hugeVoteButtonName}>
                {debate?.debater_a?.nickname || 'Defesa A'}
              </Text>
              {votedSide === 'side_a' && (
                <View style={styles.votedBadgeContainer}>
                  <Text style={styles.votedBadge}>✓ SEU VOTO</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Side B (Mint) Tactile Button */}
            <TouchableOpacity
              activeOpacity={0.75}
              style={[
                styles.hugeVoteButton,
                styles.voteButtonSideB,
                votedSide === 'side_b' && styles.selectedVoteButton,
              ]}
              onPress={() => handleVote('side_b')}
            >
              <Text style={[styles.hugeVoteButtonLabel, { color: colors.ink.main }]}>LADO B (MENTA)</Text>
              <Text style={[styles.hugeVoteButtonName, { color: colors.ink.main }]}>
                {debate?.debater_b?.nickname || 'Defesa B'}
              </Text>
              {votedSide === 'side_b' && (
                <View style={styles.votedBadgeContainer}>
                  <Text style={[styles.votedBadge, { color: colors.ink.main }]}>✓ SEU VOTO</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Results View */}
        {phase === 'RESULTS' && (
          <View style={styles.card}>
            <Text style={styles.winnerTitle}>🏆 Veredito dos Jurados</Text>
            <Text style={styles.winnerSubtitle}>
              {debate?.winner_side === 'side_a'
                ? 'Lado A conquistou a vitória!'
                : debate?.winner_side === 'side_b'
                ? 'Lado B conquistou a vitória!'
                : 'Empate total no veredito!'}
            </Text>
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreText, { color: colors.brand.action }]}>
                Lado A: {debate?.votes_count?.side_a ?? 0}
              </Text>
              <Text style={styles.scoreTextDivider}>•</Text>
              <Text style={[styles.scoreText, { color: colors.brand.mint }]}>
                Lado B: {debate?.votes_count?.side_b ?? 0}
              </Text>
            </View>
          </View>
        )}

        {/* Live Audience Emojis Burst */}
        <View style={styles.reactionSection}>
          <Text style={styles.reactionTitle}>Disparar Reações para o Modo TV:</Text>
          <View style={styles.reactionRow}>
            {['🔥', '👏', '🤯', '🍅'].map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionButton}
                onPress={() => sendReaction(emoji)}
                activeOpacity={0.5}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.tv,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
  },
  backButtonText: {
    color: colors.surface.white,
    fontWeight: '700',
    fontSize: 13,
  },
  timerContainer: {
    backgroundColor: 'rgba(253, 203, 110, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.brand.reward,
  },
  timerText: {
    color: colors.brand.reward,
    fontWeight: '900',
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  topicCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  phaseBadge: {
    color: colors.brand.reward,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  topicText: {
    color: colors.surface.white,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.surface.white,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink.main,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.ink.muted,
    lineHeight: 18,
    marginBottom: 14,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  playerBadge: {
    flex: 1,
    padding: 12,
    borderWidth: 2,
    borderRadius: 16,
    alignItems: 'center',
  },
  playerBadgeLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
  },
  playerBadgeName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink.main,
  },
  vsText: {
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '900',
    color: colors.ink.muted,
  },
  textArea: {
    backgroundColor: colors.surface.light,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 18,
    padding: 14,
    fontSize: 14,
    color: colors.ink.main,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  submitArgButton: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  submitArgButtonText: {
    color: colors.surface.white,
    fontWeight: '800',
    fontSize: 15,
  },
  votingContainer: {
    gap: 14,
  },
  votingTitle: {
    color: colors.surface.white,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  votingSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 6,
  },
  hugeVoteButton: {
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 6,
    borderBottomColor: 'rgba(0,0,0,0.3)',
  },
  voteButtonSideA: {
    backgroundColor: colors.brand.action, // Coral
  },
  voteButtonSideB: {
    backgroundColor: colors.brand.mint,   // Mint
  },
  selectedVoteButton: {
    borderWidth: 4,
    borderColor: colors.brand.reward,
  },
  hugeVoteButtonLabel: {
    color: colors.surface.white,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
  hugeVoteButtonName: {
    color: colors.surface.white,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
  },
  votedBadgeContainer: {
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  votedBadge: {
    color: colors.surface.white,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
  winnerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.brand.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  winnerSubtitle: {
    fontSize: 15,
    color: colors.ink.main,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '900',
  },
  scoreTextDivider: {
    fontSize: 18,
    color: colors.ink.muted,
  },
  reactionSection: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 16,
    marginTop: 8,
  },
  reactionTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  reactionButton: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.3)',
  },
  reactionEmoji: {
    fontSize: 30,
  },
});
