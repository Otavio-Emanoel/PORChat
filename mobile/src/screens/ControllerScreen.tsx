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

const PARTY_REACTIONS = ['Top', 'Concordo', 'Discordo', 'Genial', 'Polemico'];

const QUICK_ARGUMENTS = [
  'Minha tese irrefutável é que...',
  'A tradição e o bom senso mostram...',
  'Discordo veementemente porque...',
  'Pense nas consequências lógicas...',
];

let globalHapticsEnabled = true;

const triggerHaptic = (type: 'tap' | 'success' | 'buzzer' = 'tap') => {
  if (!globalHapticsEnabled) return;
  if (Platform.OS === 'web') {
    try {
      const nav = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>).navigator as { vibrate?: (pattern: number | number[]) => void } | undefined : undefined;
      if (nav && typeof nav.vibrate === 'function') {
        if (type === 'tap') nav.vibrate(30);
        else if (type === 'success') nav.vibrate([0, 40, 50, 60]);
        else nav.vibrate([0, 100, 50, 100]);
      }
    } catch {
      // Ignore vibration errors on unsupported browsers
    }
    return;
  }
  if (type === 'tap') Vibration.vibrate(40);
  else if (type === 'success') Vibration.vibrate([0, 50, 60, 70]);
  else Vibration.vibrate([0, 120, 60, 120]);
};

const TactileCard: React.FC<{
  onPress: () => void;
  style?: unknown;
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
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style as object]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

export const ControllerScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    gameState,
    castVote,
    sendReaction,
    submitArgument,
    playerReady,
    askCourtQuestion,
    submitQuizAnswer,
    nickname,
  } = useWebSocketContext();

  const [argumentText, setArgumentText] = useState('');
  const [argumentSent, setArgumentSent] = useState(false);
  const [courtQuestionText, setCourtQuestionText] = useState('');
  const [courtQuestionSent, setCourtQuestionSent] = useState(false);
  const [votedSide, setVotedSide] = useState<'side_a' | 'side_b' | null>(null);
  const [votedQuizChoice, setVotedQuizChoice] = useState<'A' | 'B' | 'C' | 'D' | null>(null);

  const [hapticsOn, setHapticsOn] = useState(true);
  const [answerTimeMs, setAnswerTimeMs] = useState<number | null>(null);
  const questionStartRef = useRef<number>(Date.now());

  const [comboCount, setComboCount] = useState(0);
  const comboTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isQuiz = gameState?.game_type === 'quiz';
  const phase = gameState?.phase || 'CHAT';
  const remaining = gameState?.remaining_seconds ?? 0;
  const debate = gameState?.debate_state;
  const quiz = gameState?.quiz_state;

  useEffect(() => {
    if (phase === 'QUESTION') {
      setVotedQuizChoice(null);
      setAnswerTimeMs(null);
      questionStartRef.current = Date.now();
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
    submitArgument(argumentText.trim(), phase === 'REBUTTAL' ? 'rebuttal' : 'opening');
    setArgumentSent(true);
    setTimeout(() => setArgumentSent(false), 3000);
  };

  const handleSubmitCourtQuestion = () => {
    if (!courtQuestionText.trim()) return;
    triggerHaptic('success');
    askCourtQuestion(courtQuestionText.trim());
    setCourtQuestionText('');
    setCourtQuestionSent(true);
    setTimeout(() => setCourtQuestionSent(false), 2500);
  };

  const handleQuizAnswer = (choice: 'A' | 'B' | 'C' | 'D') => {
    if (votedQuizChoice) return;
    const elapsed = Date.now() - questionStartRef.current;
    setAnswerTimeMs(elapsed);
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

  const isDebaterA =
    debate?.debater_a?.nickname.toLowerCase() === nickname.toLowerCase() ||
    debate?.debater_a?.id.toLowerCase() === nickname.toLowerCase();
  const isDebaterB =
    debate?.debater_b?.nickname.toLowerCase() === nickname.toLowerCase() ||
    debate?.debater_b?.id.toLowerCase() === nickname.toLowerCase();
  const isDebater = isDebaterA || isDebaterB;

  const isReady = Boolean(debate?.ready_players?.[nickname]);
  const opponentOpening = isDebaterA
    ? debate?.debater_b?.opening_argument || debate?.debater_b?.argument
    : debate?.debater_a?.opening_argument || debate?.debater_a?.argument;

  const myQuizScore = quiz?.leaderboard?.find(
    (entry) => entry.nickname.toLowerCase() === nickname.toLowerCase()
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Controller Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Text style={styles.backButtonText}>{'< Voltar ao Chat'}</Text>
        </TouchableOpacity>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={[styles.hapticsBtn, !hapticsOn && styles.hapticsBtnOff]}
            onPress={() => {
              const next = !hapticsOn;
              setHapticsOn(next);
              globalHapticsEnabled = next;
            }}
          >
            <Text style={styles.hapticsBtnText}>{hapticsOn ? 'Vibração' : 'Silencioso'}</Text>
          </TouchableOpacity>
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{remaining}s</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Phase Badge */}
        <View style={styles.topicCard}>
          <Text style={styles.phaseBadge}>
            {isQuiz ? 'QUIZ RELÂMPAGO' : 'MODO DEBATE'} • FASE: {phase}
          </Text>
          <Text style={styles.topicText}>
            {isQuiz
              ? quiz?.current_question?.prompt || 'Aguardando próxima pergunta...'
              : `"${debate?.topic || 'Abacaxi na pizza é crime ou alta gastronomia?'}"`}
          </Text>
        </View>

        {/* Debate Role Banner */}
        {!isQuiz && (
          <View style={[styles.roleBanner, isDebater ? styles.roleBannerDebater : styles.roleBannerJuror]}>
            <Text style={styles.roleBannerIcon}>{isDebater ? 'DEFESA' : 'JURI'}</Text>
            <View style={styles.roleBannerTextCol}>
              <Text style={styles.roleBannerTitle}>
                {isDebater
                  ? `VOCÊ É DEBATEDOR (${isDebaterA ? debate?.side_a_label || 'LADO A' : debate?.side_b_label || 'LADO B'})`
                  : 'VOCÊ É JURADO DA BANCADA'}
              </Text>
              <Text style={styles.roleBannerDesc}>
                {isDebater
                  ? 'Defenda sua tese! Envie seu argumento inicial e sua réplica antes do fim do tempo.'
                  : 'Envie perguntas aos debatedores, reaja em tempo real e vote no lado vencedor!'}
              </Text>
            </View>
          </View>
        )}

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
                        {isSelected && <Text style={styles.quizChoiceCheck}>[ENVIADO]</Text>}
                      </TactileCard>
                    );
                  })}
                </View>

                {/* Speed Progress Indicator */}
                {votedQuizChoice !== null && (
                  <View style={styles.speedIndicatorCard}>
                    <Text style={styles.speedIndicatorTitle}>
                      Resposta confirmada em {answerTimeMs !== null ? `${answerTimeMs}ms` : '< 1s'}
                    </Text>
                    <View style={styles.speedProgressBarBg}>
                      <View
                        style={[
                          styles.speedProgressBarFill,
                          {
                            width: `${Math.max(10, Math.min(100, 100 - ((answerTimeMs || 800) / 15000) * 100))}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.speedRatingText}>
                      {(answerTimeMs || 800) < 2000
                        ? 'Velocidade Máxima! (Multiplicador de Pontos Ativo)'
                        : 'Resposta enviada! Acompanhe a revelação no telão.'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {phase === 'REVEAL' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  {votedQuizChoice === quiz?.correct_option ? 'Você Acertou!' : 'Resposta Incorreta'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  A alternativa correta é a letra {quiz?.correct_option}.
                </Text>
                {quiz?.fastest_responder && (
                  <Text style={[styles.sectionSubtitle, { color: colors.brand.mint, fontWeight: 'bold' }]}>
                    Mais rápido na rodada: {quiz.fastest_responder.nickname} ({quiz.fastest_responder.response_ms}ms)
                  </Text>
                )}
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
                  {phase === 'FINAL_RESULTS' ? 'Fim do Quiz!' : 'Sua Posição'}
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
                <Text style={styles.sectionTitle}>Tribunal em Preparação</Text>
                <Text style={styles.sectionSubtitle}>
                  Prepare-se! Quando os dois debatedores confirmarem presença, a fase de Abertura começará imediatamente.
                </Text>
                <View style={styles.matchupRow}>
                  <View style={[styles.playerBadge, { borderColor: colors.brand.action }]}>
                    <Text style={[styles.playerBadgeLabel, { color: colors.brand.action }]}>
                      {debate?.side_a_label || 'LADO A'}
                    </Text>
                    <Text style={styles.playerBadgeName}>
                      {debate?.debater_a?.nickname || 'Defesa A'}
                    </Text>
                  </View>
                  <Text style={styles.vsText}>VS</Text>
                  <View style={[styles.playerBadge, { borderColor: colors.brand.mint }]}>
                    <Text style={[styles.playerBadgeLabel, { color: colors.brand.mint }]}>
                      {debate?.side_b_label || 'LADO B'}
                    </Text>
                    <Text style={styles.playerBadgeName}>
                      {debate?.debater_b?.nickname || 'Defesa B'}
                    </Text>
                  </View>
                </View>

                {isDebater && (
                  <TouchableOpacity
                    style={[
                      styles.submitArgButton,
                      { marginTop: 18 },
                      isReady && styles.submitArgButtonSuccess,
                    ]}
                    disabled={isReady}
                    onPress={() => {
                      triggerHaptic('success');
                      playerReady();
                    }}
                  >
                    <Text style={styles.submitArgButtonText}>
                      {isReady ? '[OK] Você está pronto para o debate!' : 'Confirmar Estou Pronto'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Dedicated Debater Argument Workspace OR Juror Courtroom Question Box */}
            {(phase === 'OPENING_ARGUMENTS' || phase === 'REBUTTAL') && (
              <View style={styles.card}>
                <View style={styles.roleHeader}>
                  <Text style={[styles.roleBadge, isDebater ? styles.roleDebater : styles.roleJuror]}>
                    {isDebater ? 'VOCÊ É O DEBATEDOR OFICIAL' : 'VOCÊ É JURADO POPULAR'}
                  </Text>
                </View>

                {isDebater ? (
                  <>
                    <Text style={styles.sectionTitle}>
                      {phase === 'OPENING_ARGUMENTS'
                        ? 'Argumento Inicial de Defesa'
                        : 'Fase de Réplica (Contra-Argumento)'}
                    </Text>
                    <Text style={styles.sectionSubtitle}>
                      {phase === 'OPENING_ARGUMENTS'
                        ? 'Apresente sua tese inicial com clareza para o telão:'
                        : 'Rebata diretamente o argumento apresentado pelo seu oponente:'}
                    </Text>

                    {phase === 'REBUTTAL' && opponentOpening ? (
                      <View style={styles.opponentBox}>
                        <Text style={styles.opponentBoxLabel}>TESE DO OPONENTE:</Text>
                        <Text style={styles.opponentBoxText}>"{opponentOpening}"</Text>
                      </View>
                    ) : null}

                    {/* Inspiration Template Pills */}
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

                    <TextInput
                      style={styles.textArea}
                      value={argumentText}
                      onChangeText={setArgumentText}
                      placeholder={
                        phase === 'OPENING_ARGUMENTS'
                          ? 'Escreva seu argumento de abertura...'
                          : 'Escreva sua réplica contra o oponente...'
                      }
                      placeholderTextColor={colors.ink.muted}
                      multiline
                      maxLength={280}
                      numberOfLines={4}
                    />

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
                        {argumentSent
                          ? '[OK] Argumento Transmitido ao Telão!'
                          : phase === 'REBUTTAL'
                          ? 'Transmitir Réplica ao Telão TV'
                          : 'Transmitir Argumento Inicial'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.sectionTitle}>Perguntas da Bancada de Jurados</Text>
                    <Text style={styles.sectionSubtitle}>
                      Envie uma pergunta provocativa que aparecerá ao vivo no telão para os dois debatedores responderem:
                    </Text>

                    <TextInput
                      style={styles.textArea}
                      value={courtQuestionText}
                      onChangeText={setCourtQuestionText}
                      placeholder="Ex: Como sua tese explica o custo real disso?"
                      placeholderTextColor={colors.ink.muted}
                      multiline
                      maxLength={200}
                      numberOfLines={3}
                    />

                    <TouchableOpacity
                      style={[
                        styles.submitArgButton,
                        { marginTop: 12 },
                        courtQuestionSent && styles.submitArgButtonSuccess,
                      ]}
                      onPress={handleSubmitCourtQuestion}
                    >
                      <Text style={styles.submitArgButtonText}>
                        {courtQuestionSent
                          ? '[OK] Pergunta Enviada ao Telão!'
                          : 'Enviar Pergunta aos Debatedores'}
                      </Text>
                    </TouchableOpacity>

                    {debate?.court_questions && debate.court_questions.length > 0 && (
                      <View style={{ marginTop: 14 }}>
                        <Text style={styles.reactionTitle}>Perguntas em Destaque:</Text>
                        {debate.court_questions.slice(-3).map((q) => (
                          <View key={q.id} style={styles.opponentBox}>
                            <Text style={styles.opponentBoxLabel}>{q.nickname}:</Text>
                            <Text style={styles.opponentBoxText}>"{q.question}"</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}
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
                      <Text style={styles.votedBadge}>[SEU VOTO FOI COMPUTADO]</Text>
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
                      <Text style={[styles.votedBadge, { color: colors.ink.main }]}>
                        [SEU VOTO FOI COMPUTADO]
                      </Text>
                    </View>
                  )}
                </TactileCard>
              </View>
            )}

            {/* Results View */}
            {phase === 'RESULTS' && (
              <View style={styles.card}>
                <Text style={styles.winnerTitle}>Veredito dos Jurados</Text>
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

        {/* Live Audience Reactions Burst Row */}
        <View style={styles.reactionSection}>
          <View style={styles.reactionHeaderRow}>
            <Text style={styles.reactionTitle}>Reações no Telão em Tempo Real:</Text>
            {comboCount > 1 && (
              <View style={styles.comboBadge}>
                <Text style={styles.comboText}>x{comboCount} COMBO!</Text>
              </View>
            )}
          </View>

          <View style={styles.reactionRow}>
            {PARTY_REACTIONS.map((label) => (
              <TouchableOpacity
                key={label}
                style={styles.reactionButton}
                onPress={() => handleReactionPress(label)}
                activeOpacity={0.6}
              >
                <Text style={styles.reactionEmoji}>{label}</Text>
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
  opponentBox: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  opponentBoxLabel: {
    color: colors.brand.reward,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 3,
  },
  opponentBoxText: {
    color: '#FFF',
    fontSize: 12,
    fontStyle: 'italic',
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
    minHeight: 90,
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
    flexWrap: 'wrap',
    gap: 6,
  },
  reactionButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hapticsBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  hapticsBtnOff: {
    opacity: 0.5,
  },
  hapticsBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  roleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
  },
  roleBannerDebater: {
    backgroundColor: 'rgba(255, 118, 117, 0.15)',
    borderColor: 'rgba(255, 118, 117, 0.35)',
  },
  roleBannerJuror: {
    backgroundColor: 'rgba(0, 206, 201, 0.15)',
    borderColor: 'rgba(0, 206, 201, 0.35)',
  },
  roleBannerIcon: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.brand.reward,
  },
  roleBannerTextCol: {
    flex: 1,
  },
  roleBannerTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  roleBannerDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    lineHeight: 15,
  },
  speedIndicatorCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  speedIndicatorTitle: {
    color: colors.brand.reward,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  speedProgressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  speedProgressBarFill: {
    height: '100%',
    backgroundColor: colors.brand.reward,
    borderRadius: 3,
  },
  speedRatingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontStyle: 'italic',
  },
});
