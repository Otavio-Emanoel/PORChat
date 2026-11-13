import React from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { User } from '../types';
import { getAvatarBgColor, type ContactItem, type RoomItem } from '../utils/chatHelpers';
import { AvatarBadge } from './AvatarBadge';

interface ChatListViewProps {
  topInset: number;
  bottomInset: number;
  isConnected: boolean;
  nickname: string;
  userProfile: User | null;
  roomId: string;
  roomList: RoomItem[];
  filteredRooms: RoomItem[];
  contacts: ContactItem[];
  filteredContacts: ContactItem[];
  activeTab: 'all' | 'groups' | 'contacts';
  searchQuery: string;
  isRefreshing: boolean;
  fabScaleAnim: Animated.Value;
  onSetActiveTab: (tab: 'all' | 'groups' | 'contacts') => void;
  onSetSearchQuery: (q: string) => void;
  onRefresh: () => void;
  onOpenProfile: () => void;
  onOpenRoomCode: () => void;
  onLogout: () => void;
  onSelectRoom: (room: RoomItem) => void;
  onStartDirectChat: (contact: ContactItem) => void;
  onOpenCreateGroup: () => void;
}

export const ChatListView: React.FC<ChatListViewProps> = ({
  topInset,
  bottomInset,
  isConnected,
  nickname,
  userProfile,
  roomId,
  roomList,
  filteredRooms,
  contacts,
  filteredContacts,
  activeTab,
  searchQuery,
  isRefreshing,
  fabScaleAnim,
  onSetActiveTab,
  onSetSearchQuery,
  onRefresh,
  onOpenProfile,
  onOpenRoomCode,
  onLogout,
  onSelectRoom,
  onStartDirectChat,
  onOpenCreateGroup,
}) => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            Sem conexão com o servidor. Reconectando...
          </Text>
        </View>
      )}

      {/* WhatsApp Top Brand Bar */}
      <View
        style={[
          styles.waHeader,
          {
            paddingTop: Math.max(
              topInset,
              Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 12
            ),
          },
        ]}
      >
        <View style={styles.waBrandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>POR</Text>
          </View>
          <Text style={styles.waTitle}>PORChat</Text>
        </View>

        <View style={styles.waHeaderActions}>
          <TouchableOpacity style={styles.profileBtn} onPress={onOpenProfile} activeOpacity={0.8}>
            <AvatarBadge
              name={nickname}
              color={userProfile?.avatar_color}
              avatarUrl={userProfile?.avatar_url}
              size={26}
            />
            <Text style={styles.profileBtnText}>{nickname}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.pinCodeBtn} onPress={onOpenRoomCode} activeOpacity={0.8}>
            <Text style={styles.pinCodeBtnText}># Entrar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerLogoutBtn}
            onPress={() => {
              Alert.alert('Sair da Conta', 'Deseja realmente sair e desconectar?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Sair', style: 'destructive', onPress: onLogout },
              ]);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color="#FF7675" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'all' && styles.activeTabItem]}
          onPress={() => onSetActiveTab('all')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabLabel, activeTab === 'all' && styles.activeTabLabel]}>
            Conversas ({roomList.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'groups' && styles.activeTabItem]}
          onPress={() => onSetActiveTab('groups')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabLabel, activeTab === 'groups' && styles.activeTabLabel]}>
            Grupos ({roomList.filter((r) => r.is_group).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'contacts' && styles.activeTabItem]}
          onPress={() => onSetActiveTab('contacts')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabLabel, activeTab === 'contacts' && styles.activeTabLabel]}>
            Contatos ({contacts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={onSetSearchQuery}
          placeholder={
            activeTab === 'contacts' ? 'Buscar nos contatos...' : 'Buscar conversas ou grupos...'
          }
          placeholderTextColor="#888"
        />
      </View>

      {activeTab === 'contacts' ? (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(bottomInset + 90, 90) },
          ]}
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatListItem}
              onPress={() => onStartDirectChat(item)}
              activeOpacity={0.7}
            >
              <AvatarBadge
                name={item.nickname}
                color={item.avatar_color}
                avatarUrl={item.avatar_url}
                size={44}
                rounded={false}
              />
              <View style={styles.chatInfo}>
                <View style={styles.chatTitleRow}>
                  <Text style={styles.chatName}>{item.nickname}</Text>
                  <View style={styles.contactBadge}>
                    <Text style={styles.contactBadgeText}>{item.status_text || 'Disponível'}</Text>
                  </View>
                </View>
                <Text style={styles.chatPreview}>{item.email}</Text>
              </View>
              <TouchableOpacity
                style={styles.startDirectBtn}
                onPress={() => onStartDirectChat(item)}
              >
                <Text style={styles.startDirectBtnText}>Conversar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Nenhum contato encontrado.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(bottomInset + 90, 90) },
          ]}
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          renderItem={({ item }) => {
            const isGroup = item.is_group;
            const isSelected = item.id === roomId;
            return (
              <TouchableOpacity
                style={[styles.chatListItem, isSelected && styles.chatListItemSelected]}
                onPress={() => onSelectRoom(item)}
                activeOpacity={0.7}
              >
                <AvatarBadge
                  name={item.name}
                  color={isGroup ? colors.brand.primary : getAvatarBgColor(item.id)}
                  avatarUrl={item.avatar_url}
                  size={44}
                  rounded={false}
                />
                <View style={styles.chatInfo}>
                  <View style={styles.chatTitleRow}>
                    <Text style={styles.chatName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.chatCodeBadge}>{item.code}</Text>
                  </View>
                  <Text style={styles.chatPreview} numberOfLines={1}>
                    {item.last_message ||
                      (isGroup
                        ? `${item.members?.length || 3} participantes • Toque para abrir`
                        : 'Conversa direta • Toque para abrir')}
                  </Text>
                </View>
                <Text style={styles.chatArrow}>{'>'}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Nenhuma conversa encontrada.</Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button (FAB) */}
      <Animated.View
        style={[
          styles.fabContainer,
          {
            bottom: Math.max(bottomInset + 20, 24),
            transform: [{ scale: fabScaleAnim }],
          },
        ]}
      >
        <TouchableOpacity style={styles.fabButton} onPress={onOpenCreateGroup} activeOpacity={0.85}>
          <Text style={styles.fabIcon}>+</Text>
          <Text style={styles.fabText}>Novo Grupo</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  offlineBanner: {
    backgroundColor: '#F59E0B',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBannerText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  waHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  waBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.brand.primary,
    borderRadius: 8,
  },
  logoBadgeText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  waTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2D3436',
  },
  waHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F0EFFE',
    borderRadius: 14,
  },
  profileBtnText: {
    color: colors.brand.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  pinCodeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F1F3F5',
    borderRadius: 14,
  },
  pinCodeBtnText: {
    color: '#495057',
    fontWeight: '700',
    fontSize: 12,
  },
  headerLogoutBtn: {
    padding: 6,
    backgroundColor: '#FFF0F0',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: colors.brand.primary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#868E96',
  },
  activeTabLabel: {
    color: colors.brand.primary,
    fontWeight: '800',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
    color: '#2D3436',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  chatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F3F5',
    elevation: 1,
  },
  chatListItemSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: '#FBFBFF',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2D3436',
    flex: 1,
    marginRight: 6,
  },
  chatCodeBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.brand.primary,
    backgroundColor: '#F0EFFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chatPreview: {
    fontSize: 12,
    color: '#868E96',
  },
  chatArrow: {
    fontSize: 16,
    color: '#CED4DA',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  contactBadge: {
    backgroundColor: '#E6FCF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  contactBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0CA678',
  },
  startDirectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.brand.primary,
    borderRadius: 12,
  },
  startDirectBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 11,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#868E96',
    fontSize: 13,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    elevation: 6,
  },
  fabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 8,
  },
  fabIcon: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  fabText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
