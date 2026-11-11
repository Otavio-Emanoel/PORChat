import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWebSocketContext } from '../context/WebSocketContext';
import { TactileButton } from '../components/TactileButton';

const DEMO_USERS = [
  {
    name: 'Otavio',
    email: 'otavio@porchat.app',
    role: 'Co-fundador • Backend',
    color: '#6C5CE7',
    icon: 'code-slash',
  },
  {
    name: 'Pedro',
    email: 'pedro@porchat.app',
    role: 'Co-fundador • Mobile',
    color: '#00CEC9',
    icon: 'phone-portrait-outline',
  },
  {
    name: 'Raul',
    email: 'raul@porchat.app',
    role: 'Co-fundador • TV Mode',
    color: '#FF7675',
    icon: 'tv-outline',
  },
];

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const {
    loginWithCredentials,
    registerWithCredentials,
    serverHost,
    setServerHost,
    sessionTerminationNotice,
    clearSessionTerminationNotice,
  } = useWebSocketContext();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);
  const [showHostConfig, setShowHostConfig] = useState(false);
  const [tempHost, setTempHost] = useState(serverHost);

  // Gentle floating animation for brand logo
  const floatAnim = useRef(new Animated.Value(0)).current;
  const formFadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim]);

  const switchMode = (newMode: 'login' | 'register') => {
    if (newMode === mode) return;
    Animated.sequence([
      Animated.timing(formFadeAnim, { toValue: 0.2, duration: 90, useNativeDriver: true }),
      Animated.timing(formFadeAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
    setMode(newMode);
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Preencha o e-mail e a senha.');
      return;
    }

    if (mode === 'register' && !nickname.trim()) {
      Alert.alert('Atenção', 'Preencha seu apelido / nome.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const ok = await loginWithCredentials(email.trim().toLowerCase(), password);
        if (!ok) {
          Alert.alert('Erro ao Entrar', 'E-mail ou senha incorretos.');
        }
      } else {
        const ok = await registerWithCredentials(nickname.trim(), email.trim().toLowerCase(), password);
        if (!ok) {
          Alert.alert('Erro ao Cadastrar', 'Não foi possível cadastrar a conta. Verifique os dados.');
        }
      }
    } catch (e: any) {
      Alert.alert('Falha na Conexão', e?.message || 'Não foi possível conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (userEmail: string, userName: string) => {
    setLoadingDemo(userName);
    try {
      const ok = await loginWithCredentials(userEmail, '123456');
      if (!ok) {
        Alert.alert('Erro', `Não foi possível entrar como ${userName}. Verifique o servidor.`);
      }
    } catch (e: any) {
      Alert.alert('Erro de Conexão', e?.message || 'Verifique o endereço IP do servidor.');
    } finally {
      setLoadingDemo(null);
    }
  };

  const handleSaveHost = () => {
    const clean = tempHost.trim();
    if (!clean) {
      Alert.alert('Aviso', 'O endereço do servidor não pode ser vazio.');
      return;
    }
    setServerHost(clean);
    setShowHostConfig(false);
    Alert.alert('Servidor Atualizado', `Conectando em http://${clean}`);
  };

  return (
    <View
      style={[
        styles.safeArea,
        {
          paddingTop: Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 16),
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Brand with Gentle Floating Animation */}
          <Animated.View style={[styles.brandHeader, { transform: [{ translateY: floatAnim }] }]}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>POR</Text>
            </View>
            <Text style={styles.brandTitle}>PORChat</Text>
            <Text style={styles.brandSubtitle}>
              Pedro, Otavio & Raul • Chat & Party Games
            </Text>
          </Animated.View>

          {/* Session Termination Notice Banner */}
          {sessionTerminationNotice && (
            <View style={styles.terminationBanner}>
              <View style={styles.terminationIconBox}>
                <Ionicons name="warning-outline" size={24} color="#FFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.terminationTitle}>Sessão Encerrada</Text>
                <Text style={styles.terminationText}>{sessionTerminationNotice}</Text>
              </View>
              <TouchableOpacity
                onPress={clearSessionTerminationNotice}
                style={styles.terminationCloseBtn}
              >
                <Ionicons name="close" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* 1-Click Fast Demo Logins */}
          <View style={styles.demoSection}>
            <Text style={styles.sectionHeading}>⚡ Acesso Rápido de Teste (1 Toque):</Text>
            <View style={styles.demoCardsRow}>
              {DEMO_USERS.map((u) => {
                const isSelected = loadingDemo === u.name;
                return (
                  <View key={u.name} style={{ flex: 1 }}>
                    <TactileButton
                      style={[
                        styles.demoCard,
                        { borderTopColor: u.color, borderTopWidth: 4 },
                        isSelected && styles.demoCardActive,
                      ]}
                      onPress={() => handleDemoLogin(u.email, u.name)}
                      disabled={loading || loadingDemo !== null}
                    >
                      <View style={[styles.demoAvatar, { backgroundColor: u.color }]}>
                        {isSelected ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={styles.demoAvatarText}>{u.name[0]}</Text>
                        )}
                      </View>
                      <Text style={styles.demoCardName}>{u.name}</Text>
                      <Text style={styles.demoCardRole} numberOfLines={1}>
                        {u.role.split('•')[1]?.trim() || u.role}
                      </Text>
                    </TactileButton>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Main Auth Card */}
          <View style={styles.card}>
            {/* Mode Switch Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabBtn, mode === 'login' && styles.tabBtnActive]}
                onPress={() => switchMode('login')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabBtnText, mode === 'login' && styles.tabBtnTextActive]}>
                  Entrar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, mode === 'register' && styles.tabBtnActive]}
                onPress={() => switchMode('register')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabBtnText, mode === 'register' && styles.tabBtnTextActive]}>
                  Criar Conta
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Fields Animated */}
            <Animated.View style={{ opacity: formFadeAnim }}>
              {mode === 'register' && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Apelido / Nome</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={18} color="#8892B0" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ex: Joãozinho"
                      placeholderTextColor="#64748B"
                      value={nickname}
                      onChangeText={setNickname}
                      autoCapitalize="words"
                      editable={!loading}
                    />
                  </View>
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>E-mail</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={18} color="#8892B0" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="seu@email.com"
                    placeholderTextColor="#64748B"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!loading}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Senha</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color="#8892B0" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    placeholder="Sua senha secreta"
                    placeholderTextColor="#64748B"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={{ padding: 6 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#8892B0"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>

            {/* Submit CTA */}
            <TactileButton
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading || loadingDemo !== null}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name={mode === 'login' ? 'log-in-outline' : 'person-add-outline'}
                    size={20}
                    color="#FFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.submitBtnText}>
                    {mode === 'login' ? 'Entrar no PORChat' : 'Cadastrar e Conectar'}
                  </Text>
                </View>
              )}
            </TactileButton>
          </View>

          {/* Server Config Collapsible */}
          <View style={styles.serverConfigContainer}>
            <TouchableOpacity
              style={styles.serverConfigToggle}
              onPress={() => setShowHostConfig((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Ionicons name="server-outline" size={16} color="#94A3B8" />
              <Text style={styles.serverConfigToggleText}>
                Servidor: <Text style={{ color: '#00CEC9' }}>{serverHost}</Text>
              </Text>
              <Ionicons
                name={showHostConfig ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="#94A3B8"
              />
            </TouchableOpacity>

            {showHostConfig && (
              <View style={styles.serverConfigCard}>
                <Text style={styles.serverConfigHint}>
                  Informe o IP do computador na rede local (ex: 192.168.3.138:8081):
                </Text>
                <TextInput
                  style={styles.serverConfigInput}
                  value={tempHost}
                  onChangeText={setTempHost}
                  placeholder="IP_DO_PC:8081"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                />
                <View style={styles.serverConfigActions}>
                  <TouchableOpacity
                    style={styles.serverConfigResetBtn}
                    onPress={() => setTempHost('localhost:8081')}
                  >
                    <Text style={styles.serverConfigResetText}>localhost:8081</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.serverConfigSaveBtn}
                    onPress={handleSaveHost}
                  >
                    <Text style={styles.serverConfigSaveText}>Salvar IP</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1E1E2E',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 10,
  },
  logoBadgeText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F8F9FA',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  terminationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF7675',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    shadowColor: '#FF7675',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  terminationIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminationTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  terminationText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  terminationCloseBtn: {
    padding: 6,
  },
  demoSection: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  demoCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  demoCard: {
    flex: 1,
    backgroundColor: '#27293D',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#383B56',
  },
  demoCardActive: {
    borderColor: '#00CEC9',
    backgroundColor: '#30334C',
  },
  demoAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  demoAvatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  demoCardName: {
    color: '#F8F9FA',
    fontSize: 14,
    fontWeight: 'bold',
  },
  demoCardRole: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  card: {
    backgroundColor: '#27293D',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#383B56',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E1E2E',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#6C5CE7',
  },
  tabBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#383B56',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: 46,
    color: '#F8F9FA',
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: '#6C5CE7',
    borderRadius: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  serverConfigContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  serverConfigToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#27293D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#383B56',
  },
  serverConfigToggleText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  serverConfigCard: {
    marginTop: 10,
    width: '100%',
    backgroundColor: '#27293D',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#383B56',
  },
  serverConfigHint: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 8,
  },
  serverConfigInput: {
    backgroundColor: '#1E1E2E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#383B56',
    color: '#F8F9FA',
    height: 40,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  serverConfigActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  serverConfigResetBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#1E1E2E',
    borderRadius: 8,
  },
  serverConfigResetText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  serverConfigSaveBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#00CEC9',
    borderRadius: 8,
  },
  serverConfigSaveText: {
    color: '#1E1E2E',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
