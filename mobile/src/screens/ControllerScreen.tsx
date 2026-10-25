import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
  Animated,
  Vibration,
} from 'react-native';
import { useWebSocketContext } from '../context/WebSocketContext';
import { colors } from '../theme/colors';

const QUIZ_BUTTON_COLORS = {
  A: { bg: '#FF6B6B', border: '#D63031' }, // Coral
  B: { bg: '#48DBFB', border: '#0ABDE3' }, // Ocean
  C: { bg: '#FECA57', border: '#EE5253' }, // Mustard
  D: { bg: '#1DD1A1', border: '#10AC84' }, // Emerald
};

const PARTY_REACTIONS = ['🔥', '💀', '🍅', '👏', '🤯', '👑', '🎯'];

const QUICK_ARGUMENTS = [
  'Minha tese irrefutável é que...',
  'A tradição e o bom senso mostram...',
  'Discordo veementemente porque...',
  'Pense nas consequências lógicas...',
];

const triggerHaptic = (type: 'tap' | 'success' | 'buzzer' = 'tap') => {
  if (Platform.OS === 'web') {
    try {
      const nav = typeof globalThis !== 'undefined' ? (globalThis as any).navigator : null;
      if (nav && 'vibrate' in nav) {
        if (type === 'tap') nav.vibrate(30);
        else if (type === 'success') nav.vibrate([0, 40, 50, 60]);
        else nav.vibrate([0, 100, 50, 100]);
      }
    } catch (e) {}
    return;
  }
  if (type === 'tap') Vibration.vibrate(40);
  else if (type === 'success') Vibration.vibrate([0, 50, 60, 70]);
  else Vibration.vibrate([0, 120, 60, 120]);
};

const TactileCard: React.FC<{
  onPress: () => void;
  style?: any;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onPress, style, disabled, children }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    triggerHaptic('tap');
    Animated.spring(scaleAnim, {
      toValue: 0.93,
      useNativeDriver: true,
      friction: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 3,
      tension: 40,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

export const ControllerScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { gameState, castVote, sendReaction, submitArgument, submitQuizAnswer, nickname } = useWebSocketContext();
  const [argumentText, setArgumentText] = useState('');
  const [argumentSent, setArgumentSent] = useState(false);
  const [votedSide, setVotedSide] = useState<'side_a' | 'side_b' | null>(null);
  const [votedQuizChoice, setVotedQuizChoice] = useState<'A' | 'B' | 'C' | 'D' | null>(null);

  // Reaction Combo Multiplier (Item 21)
  const [comboCount, setComboCount] = useState(0);
  const comboTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isQuiz = gameState?.game_type === 'quiz';
  const phase = gameState?.phase || 'CHAT';
  const remaining = gameState?.remaining_seconds ?? 0;
  const debate = gameState?.debate_state;
  const quiz = gameState?.quiz_state;

  // Reset answer when new question arrives
  useEffect(() => {
    if (phase === 'QUESTION') {
      setVotedQuizChoice(null);
      triggerHaptic('buzzer');
    }
  }, [quiz?.current_question_index, phase]);

  const handleVote = (side: 'side_a' | 'side_b') => {
    triggerHaptic('success');
    setVotedSide(side);
    castVote(side);
  };

  const handleSubmitArg = () => {
    if (!argumentText.trim()) return;
    triggerHaptic('success');
    submitArgument(argumentText.trim());
    setArgumentSent(true);
    setTimeout(() => setArgumentSent(false), 3000);
  };

  const handleQuizAnswer = (choice: 'A' | 'B' | 'C' | 'D') => {
    if (votedQuizChoice) return;
    triggerHaptic('buzzer');
    setVotedQuizChoice(choice);
    submitQuizAnswer(choice);
  };

  const handleReactionPress = (emoji: string) => {
    triggerHaptic('tap');
    sendReaction(emoji);

    setComboCount((prev) => prev + 1);
    if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
    comboTimeoutRef.current = setTimeout(() => {
      setComboCount(0);
    }, 1400);
  };

  const isDebater =
    debate?.debater_a?.nickname === nickname ||
    debate?.debater_b?.nickname === nickname ||
    debate?.debater_a?.id === nickname ||
    debate?.debater_b?.id === nickname;

  const myQuizScore = quiz?.leaderboard?.find((entry) => entry.nickname === nickname);

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
        {/* Phase Badge */}
        <View style={styles.topicCard}>
          <Text style={styles.phaseBadge}>
            {isQuiz ? '⚡ QUIZ RELÂMPAGO' : '⚖️ MODO DEBATE'} • FASE: {phase}
          </Text>
          <Text style={styles.topicText}>
            {isQuiz
              ? quiz?.current_question?.prompt || 'Aguardando próxima pergunta...'
              : `"${debate?.topic || 'Abacaxi na pizza é crime ou alta gastronomia?'}"`}
          </Text>
        </View>

        {/* ==================================================================== */}
        {/* ======================== TRIVIA CONTROLLER ========================= */}
        {/* ==================================================================== */}
        {isQuiz ? (
          <View style={styles.quizWrapper}>
            {phase === 'QUESTION' && (
              <View style={styles.quizControls}>
                <Text style={styles.sectionSubtitle}>
                  Selecione sua resposta o mais rápido possível:
                </Text>

                {/* 4 Geometric Colored Buttons */}
                <View style={styles.quizGrid}>
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                    const optionText = quiz?.current_question?.options?.[opt] || '';
                    const isSelected = votedQuizChoice === opt;
                    const colorScheme = QUIZ_BUTTON_COLORS[opt];

                    return (
                      <TactileCard
                        key={opt}
                        disabled={votedQuizChoice !== null}
                        style={[
                          styles.quizButton,
                          { backgroundColor: colorScheme.bg, borderBottomColor: colorScheme.border },
                          isSelected && styles.selectedQuizButton,
                          votedQuizChoice !== null && !isSelected && styles.dimmedQuizButton,
                        ]}
                        onPress={() => handleQuizAnswer(opt)}
                      >
                        <Text style={styles.quizOptionLetter}>{opt}</Text>
                        <Text style={styles.quizOptionText} numberOfLines={2}>
                          {optionText}
                        </Text>
                        {isSelected && <Text style={styles.quizChoiceCheck}>✓ ENVIADO</Text>}
                      </TactileCard>
                    );
                  })}
                </View>
              </View>
            )}

            {phase === 'REVEAL' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  {votedQuizChoice === quiz?.correct_option ? '🎉 Você Acertou!' : '❌ Resposta Incorreta'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  A alternativa correta é a letra {quiz?.correct_option}.
                </Text>
                {myQuizScore && (
                  <View style={styles.scoreRow}>
                    <Text style={styles.scoreText}>Pontos ganhos: +{myQuizScore.round_score} pts</Text>
                  </View>
                )}
              </View>
            )}

            {(phase === 'LEADERBOARD' || phase === 'FINAL_RESULTS') && (
              <View style={styles.card}>
                <Text style={styles.winnerTitle}>
                  {phase === 'FINAL_RESULTS' ? '🏆 Fim do Quiz!' : '📊 Sua Posição'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {myQuizScore
                    ? `Você está em #${myQuizScore.rank} com ${myQuizScore.total_score} pontos!`
                    : 'Aguardando atualização das posições...'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* ==================================================================== */
          /* ======================== DEBATE CONTROLLER ========================= */
          /* ==================================================================== */
          <View style={styles.debateWrapper}>
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

            {/* Dedicated Debater Argument Workspace (Item 20) */}
            {(phase === 'OPENING_ARGUMENTS' || phase === 'REBUTTAL') && (
              <View style={styles.card}>
                <View style={styles.roleHeader}>
                  <Text style={[styles.roleBadge, isDebater ? styles.roleDebater : styles.roleJuror]}>
                    {isDebater ? '🎤 VOCÊ É O DEBATEDOR OFICIAL' : '👀 VOCÊ É JURADO POPULAR'}
                  </Text>
                </View>

                <Text style={styles.sectionTitle}>
                  {phase === 'OPENING_ARGUMENTS' ? 'Argumentos Iniciais' : 'Fase de Réplica'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {isDebater
                    ? 'Digite sua tese com clareza. Ela aparecerá com destaque no telão da sala:'
                    : 'Acompanhe os debatedores pelo telão e prepare seu voto para a próxima fase!'}
                </Text>

                {/* Inspiration Template Pills */}
                {isDebater && (
                  <View style={styles.templatePillsRow}>
                    {QUICK_ARGUMENTS.map((arg, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.templatePill}
                        onPress={() => setArgumentText((prev) => (prev ? `${prev} ${arg}` : arg))}
                      >
                        <Text style={styles.templatePillText}>{arg}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <TextInput
                  style={styles.textArea}
                  value={argumentText}
                  onChangeText={setArgumentText}
                  placeholder={
                    isDebater
                      ? 'Escreva aqui seus melhores argumentos e defenda sua posição...'
                      : 'Você pode enviar sugestões ou notas para a bancada...'
                  }
                  placeholderTextColor={colors.ink.muted}
                  multiline
                  maxLength={280}
                  numberOfLines={4}
                />

                {/* Character Count */}
                <View style={styles.charCountRow}>
                  <Text style={[styles.charCountText, argumentText.length > 250 && styles.charCountWarning]}>
                    {argumentText.length} / 280 caracteres
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.submitArgButton, argumentSent && styles.submitArgButtonSuccess]}
                  onPress={handleSubmitArg}
                >
                  <Text style={styles.submitArgButtonText}>
                    {argumentSent ? '✓ Argumento Transmitido ao Telão!' : 'Transmitir Tese ao Telão TV'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Voting View (Massive Tactile Buzzer Buttons) */}
            {phase === 'VOTING' && (
              <View style={styles.votingContainer}>
                <Text style={styles.votingTitle}>Qual lado venceu?</Text>
                <Text style={styles.votingSubtitle}>Toque no cartão para computar seu voto na TV:</Text>

                {/* Side A (Coral) Tactile Button */}
                <TactileCard
                  style={[
                    styles.hugeVoteButton,
                    styles.voteButtonSideA,
                    votedSide === 'side_a' && styles.selectedVoteButton,
                  ]}
                  onPress={() => handleVote('side_a')}
                >
                  <Text style={styles.hugeVoteButtonLabel}>
                    {debate?.side_a_label || 'LADO A (CORAL)'}
                  </Text>
                  <Text style={styles.hugeVoteButtonName}>
                    {debate?.debater_a?.nickname || 'Defesa A'}
                  </Text>
                  {votedSide === 'side_a' && (
                    <View style={styles.votedBadgeContainer}>
                      <Text style={styles.votedBadge}>✓ SEU VOTO COMPUTADO</Text>
                    </View>
                  )}
                </TactileCard>

                {/* Side B (Mint) Tactile Button */}
                <TactileCard
                  style={[
                    styles.hugeVoteButton,
                    styles.voteButtonSideB,
                    votedSide === 'side_b' && styles.selectedVoteButton,
                  ]}
                  onPress={() => handleVote('side_b')}
                >
                  <Text style={[styles.hugeVoteButtonLabel, { color: colors.ink.main }]}>
                    {debate?.side_b_label || 'LADO B (MENTA)'}
                  </Text>
                  <Text style={[styles.hugeVoteButtonName, { color: colors.ink.main }]}>
                    {debate?.debater_b?.nickname || 'Defesa B'}
                  </Text>
                  {votedSide === 'side_b' && (
                    <View style={styles.votedBadgeContainer}>
                      <Text style={[styles.votedBadge, { color: colors.ink.main }]}>✓ SEU VOTO COMPUTADO</Text>
                    </View>
                  )}
                </TactileCard>
              </View>
            )}

            {/* Results View */}
            {phase === 'RESULTS' && (
              <View style={styles.card}>
                <Text style={styles.winnerTitle}>🏆 Veredito dos Jurados</Text>
                <Text style={styles.winnerSubtitle}>
                  {debate?.winner_side === 'side_a'
                    ? 'Lado Coral conquistou a vitória!'
                    : debate?.winner_side === 'side_b'
                    ? 'Lado Menta conquistou a vitória!'
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
          </View>
        )}

        {/* Live Audience Emojis Burst Wheel (Item 21) */}
        <View style={styles.reactionSection}>
          <View style={styles.reactionHeaderRow}>
            <Text style={styles.reactionTitle}>Reações em Tempo Real:</Text>
            {comboCount > 1 && (
              <View style={styles.comboBadge}>
                <Text style={styles.comboText}>🔥 x{comboCount} COMBO!</Text>
              </View>
            )}
          </View>

          <View style={styles.reactionRow}>
            {PARTY_REACTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionButton}
                onPress={() => handleReactionPress(emoji)}
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  timerContainer: {
    backgroundColor: colors.brand.reward,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerText: {
    color: colors.ink.main,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 16,
  },
  content: {
    padding: 20,
  },
  topicCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 20,
  },
  phaseBadge: {
    color: colors.brand.reward,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },
  topicText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  quizWrapper: {
    width: '100%',
  },
  quizControls: {
    width: '100%',
  },
  quizGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  quizButton: {
    width: '48%',
    minHeight: 120,
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderBottomWidth: 6,
    justifyContent: 'space-between',
  },
  selectedQuizButton: {
    transform: [{ scale: 1.02 }],
    borderWidth: 3,
    borderColor: '#FFF',
  },
  dimmedQuizButton: {
    opacity: 0.35,
  },
  quizOptionLetter: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },
  quizOptionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  quizChoiceCheck: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 4,
  },
  debateWrapper: {
    width: '100%',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 20,
  },
  roleHeader: {
    marginBottom: 10,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    fontSize: 11,
    fontWeight: '900',
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  roleDebater: {
    backgroundColor: colors.brand.action,
    color: '#FFF',
  },
  roleJuror: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: colors.brand.reward,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  templatePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  templatePill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  templatePillText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    padding: 14,
    color: '#FFF',
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  charCountRow: {
    alignItems: 'flex-end',
    marginTop: 6,
    marginBottom: 12,
  },
  charCountText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  charCountWarning: {
    color: colors.brand.action,
    fontWeight: 'bold',
  },
  submitArgButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitArgButtonSuccess: {
    backgroundColor: '#10AC84',
  },
  submitArgButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  votingContainer: {
    marginBottom: 20,
  },
  votingTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },
  votingSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  hugeVoteButton: {
    width: '100%',
    minHeight: 130,
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
    justifyContent: 'center',
    borderBottomWidth: 8,
  },
  voteButtonSideA: {
    backgroundColor: colors.brand.action,
    borderBottomColor: '#D63031',
  },
  voteButtonSideB: {
    backgroundColor: colors.brand.mint,
    borderBottomColor: '#00A8A3',
  },
  selectedVoteButton: {
    borderWidth: 4,
    borderColor: '#FFF',
  },
  hugeVoteButtonLabel: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  hugeVoteButtonName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
  },
  votedBadgeContainer: {
    marginTop: 8,
  },
  votedBadge: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  playerBadge: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  playerBadgeLabel: {
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 4,
  },
  playerBadgeName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  vsText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 16,
    fontWeight: '900',
  },
  winnerTitle: {
    color: colors.brand.reward,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  winnerSubtitle: {
    color: '#FFF',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '900',
  },
  scoreTextDivider: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 16,
  },
  reactionSection: {
    marginTop: 10,
    marginBottom: 30,
  },
  reactionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reactionTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: 'bold',
  },
  comboBadge: {
    backgroundColor: colors.brand.action,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  comboText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reactionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 22,
  },
});
