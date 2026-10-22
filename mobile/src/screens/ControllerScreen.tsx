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
  const { gameState, castVote, sendReaction, submitArgument } = useWebSocketContext();
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
        {/* Phase & Topic */}
        <View style={styles.topicCard}>
          <Text style={styles.phaseBadge}>FASE: {phase}</Text>
          <Text style={styles.topicText}>"{debate?.topic || 'Tema em debate'}"</Text>
        </View>

        {/* Dynamic Role Views */}
        {phase === 'OPENING_ARGUMENTS' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Defenda seu Lado!</Text>
            <Text style={styles.sectionSubtitle}>Digite seu argumento e envie antes do tempo zerar:</Text>
            <TextInput
              style={styles.textArea}
              value={argumentText}
              onChangeText={setArgumentText}
              placeholder="Escreva seu argumento aqui..."
              placeholderTextColor={colors.ink.muted}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity style={styles.submitArgButton} onPress={handleSubmitArg}>
              <Text style={styles.submitArgButtonText}>Enviar Argumento</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Voting View (Massive Tactile Buttons) */}
        {phase === 'VOTING' && (
          <View style={styles.votingContainer}>
            <Text style={styles.votingTitle}>Qual lado venceu?</Text>
            <Text style={styles.votingSubtitle}>Escolha seu voto no painel do júri:</Text>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.hugeVoteButton,
                styles.voteButtonSideA,
                votedSide === 'side_a' && styles.selectedVoteButton,
              ]}
              onPress={() => handleVote('side_a')}
            >
              <Text style={styles.hugeVoteButtonLabel}>LADO A</Text>
              <Text style={styles.hugeVoteButtonName}>
                {debate?.debater_a?.nickname || 'Defensor A'}
              </Text>
              {votedSide === 'side_a' && <Text style={styles.votedBadge}>✓ VOTO REGISTRADO</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.hugeVoteButton,
                styles.voteButtonSideB,
                votedSide === 'side_b' && styles.selectedVoteButton,
              ]}
              onPress={() => handleVote('side_b')}
            >
              <Text style={[styles.hugeVoteButtonLabel, { color: colors.ink.main }]}>LADO B</Text>
              <Text style={[styles.hugeVoteButtonName, { color: colors.ink.main }]}>
                {debate?.debater_b?.nickname || 'Defensor B'}
              </Text>
              {votedSide === 'side_b' && <Text style={styles.votedBadge}>✓ VOTO REGISTRADO</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Results View */}
        {phase === 'RESULTS' && (
          <View style={styles.card}>
            <Text style={styles.winnerTitle}>🏆 Veredito Final!</Text>
            <Text style={styles.resultsText}>
              Lado A: {debate?.votes_count?.side_a ?? 0} votos | Lado B: {debate?.votes_count?.side_b ?? 0} votos
            </Text>
          </View>
        )}

        {/* Live Reaction Emojis Burst */}
        <View style={styles.reactionSection}>
          <Text style={styles.reactionTitle}>Reações ao Vivo na TV:</Text>
          <View style={styles.reactionRow}>
            {['🔥', '👏', '🤯', '🍅'].map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionButton}
                onPress={() => sendReaction(emoji)}
                activeOpacity={0.6}
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
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  backButtonText: {
    color: colors.surface.white,
    fontWeight: '700',
    fontSize: 13,
  },
  timerContainer: {
    backgroundColor: 'rgba(253, 203, 110, 0.2)',
    paddingHorizontal: 14,
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
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  phaseBadge: {
    color: colors.brand.reward,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
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
    marginBottom: 12,
  },
  textArea: {
    backgroundColor: colors.surface.light,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: 16,
    padding: 12,
    fontSize: 14,
    color: colors.ink.main,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  submitArgButton: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitArgButtonText: {
    color: colors.surface.white,
    fontWeight: '800',
    fontSize: 15,
  },
  votingContainer: {
    gap: 12,
  },
  votingTitle: {
    color: colors.surface.white,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  votingSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  hugeVoteButton: {
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 6,
    borderBottomColor: 'rgba(0,0,0,0.25)',
  },
  voteButtonSideA: {
    backgroundColor: colors.brand.action, // Coral
  },
  voteButtonSideB: {
    backgroundColor: colors.brand.mint,   // Mint
  },
  selectedVoteButton: {
    borderWidth: 3,
    borderColor: colors.brand.reward,
  },
  hugeVoteButtonLabel: {
    color: colors.surface.white,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  hugeVoteButtonName: {
    color: colors.surface.white,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  votedBadge: {
    marginTop: 8,
    color: colors.surface.white,
    fontWeight: '800',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  winnerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.brand.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  resultsText: {
    fontSize: 14,
    color: colors.ink.main,
    textAlign: 'center',
    fontWeight: '600',
  },
  reactionSection: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 16,
    marginTop: 8,
  },
  reactionTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  reactionButton: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.3)',
  },
  reactionEmoji: {
    fontSize: 28,
  },
});
