'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageSquare, Plus, Search, Users } from 'lucide-react';
import type { User } from '@/lib/auth';
import type { Room } from '@/lib/types';
import { formatRelativeTime, getMonogram } from '@/lib/chatHelpers';

export interface Contact {
  id: string;
  nickname: string;
  email: string;
  avatar_color?: string;
  status_text?: string;
  bio?: string;
}

interface RoomSidebarProps {
  roomId: string;
  currentUser: User | null;
  nickname: string;
  userAvatar: string;
  userStatus: string;
  allRooms: Room[];
  filteredRooms: Room[];
  contacts: Contact[];
  activeTab: 'all' | 'groups' | 'direct' | 'contacts';
  searchQuery: string;
  nowTick: number;
  onSetActiveTab: (tab: 'all' | 'groups' | 'direct' | 'contacts') => void;
  onSetSearchQuery: (query: string) => void;
  onOpenProfile: () => void;
  onOpenCreateGroup: () => void;
  onSelectRoom: (targetRoomId: string) => void;
  onStartDirectChat: (contact: Contact) => void;
  onLogout: () => void;
}

/**
 * WhatsApp-style desktop sidebar showing profile summary, search, room tabs, and contacts.
 */
export const RoomSidebar: React.FC<RoomSidebarProps> = ({
  roomId,
  currentUser,
  nickname,
  userAvatar,
  userStatus,
  allRooms,
  filteredRooms,
  contacts,
  activeTab,
  searchQuery,
  nowTick,
  onSetActiveTab,
  onSetSearchQuery,
  onOpenProfile,
  onOpenCreateGroup,
  onSelectRoom,
  onStartDirectChat,
  onLogout,
}) => {
  const groupCount = allRooms.filter((r) => r.is_group).length;

  return (
    <aside className="w-88 sm:w-96 bg-white border-r border-gray-200 flex flex-col justify-between hidden md:flex shadow-xs select-none">
      <div className="flex flex-col h-full">
        {/* Top User Bar */}
        <div className="p-3.5 bg-[#F0F2F5] border-b border-gray-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-3 text-left hover:opacity-90 transition-all group"
            title="Clique para customizar perfil, senha e estatísticas"
          >
            <div className="relative">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-xs group-hover:scale-105 transition-transform"
                style={{ backgroundColor: userAvatar.startsWith('#') ? userAvatar : '#6C5CE7' }}
              >
                {getMonogram(nickname || 'OE')}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div className="leading-tight">
              <span className="text-sm font-bold text-ink-main block truncate max-w-[130px]">
                {nickname}
              </span>
              <span className="text-[10px] text-gray-500 font-medium block truncate max-w-[130px]">
                {userStatus}
              </span>
            </div>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenCreateGroup}
              className="p-2 rounded-full hover:bg-gray-200 text-gray-600 hover:text-brand-primary transition-colors flex items-center gap-1 text-xs font-bold"
              title="Criar Novo Grupo"
            >
              <Plus className="w-5 h-5 text-brand-primary" />
              <span className="hidden lg:inline text-[11px]">Novo Grupo</span>
            </button>
            <Link
              href="/"
              className="p-2 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
              title="Voltar para a Página Inicial"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-2.5 bg-white border-b border-gray-100">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSetSearchQuery(e.target.value)}
              placeholder="Pesquisar conversas ou contatos..."
              className="w-full pl-9 pr-4 py-1.5 bg-[#F0F2F5] rounded-xl text-xs text-ink-main placeholder:text-gray-400 outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary transition-all"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-3 pt-2 pb-1 bg-white border-b border-gray-100 gap-1 text-xs font-bold">
          {(
            [
              { id: 'all', label: 'Todas' },
              { id: 'groups', label: 'Grupos', badge: groupCount },
              { id: 'direct', label: 'Diretas' },
              { id: 'contacts', label: 'Contatos' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSetActiveTab(tab.id)}
              className={`flex-1 py-1.5 text-center rounded-lg transition-colors flex items-center justify-center gap-1 ${
                activeTab === tab.id
                  ? 'bg-brand-primary/10 text-brand-primary'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span>{tab.label}</span>
              {'badge' in tab && tab.badge > 0 && (
                <span className="w-4 h-4 rounded-full bg-brand-primary text-white text-[9px] flex items-center justify-center font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Conversations or Contacts List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {activeTab === 'contacts' ? (
            <div className="p-2 space-y-1">
              <span className="px-3 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Contatos Cadastrados ({contacts.length})
              </span>
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm"
                      style={{ backgroundColor: c.avatar_color || '#6C5CE7' }}
                    >
                      {c.nickname[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-ink-main">{c.nickname}</div>
                      <div className="text-[11px] text-gray-400">{c.status_text || c.email}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onStartDirectChat(c)}
                    className="px-3 py-1.5 rounded-xl bg-brand-primary text-white text-[11px] font-bold shadow-xs hover:bg-brand-primary/90 transition-all cursor-pointer"
                  >
                    Conversar
                  </button>
                </div>
              ))}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
                <MessageSquare className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-xs font-semibold text-gray-600 mb-1">Nenhuma conversa encontrada</p>
              <p className="text-[11px] text-gray-400 mb-4">
                {searchQuery
                  ? 'Tente pesquisar por outro termo.'
                  : 'Inicie uma conversa na aba Contatos ou crie um Novo Grupo!'}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => onSetActiveTab('contacts')}
                  className="px-3 py-1.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 transition-all shadow-xs cursor-pointer"
                >
                  Ver Contatos
                </button>
              )}
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isActive = room.id === roomId;
              return (
                <button
                  key={room.id}
                  onClick={() => onSelectRoom(room.id)}
                  className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors border-l-4 ${
                    isActive
                      ? 'bg-[#EBEBF5] border-brand-primary'
                      : 'hover:bg-gray-50 border-transparent'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-heading font-bold text-lg shrink-0 shadow-2xs ${
                      room.is_group
                        ? 'bg-gradient-to-br from-brand-primary to-purple-800'
                        : 'bg-brand-action'
                    }`}
                  >
                    {room.is_group ? <Users className="w-6 h-6" /> : room.name[0].toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-sm text-ink-main truncate">{room.name}</span>
                      <span className="text-[10px] text-gray-400 font-medium shrink-0 ml-1">
                        {room.last_message_at ? formatRelativeTime(room.last_message_at, nowTick) : room.code}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="truncate max-w-[155px]">
                        {room.last_message ||
                          (room.is_group ? 'Toque para conversar e jogar' : 'Conversa iniciada')}
                      </span>
                      {room.unread_count && room.unread_count > 0 ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-brand-action text-white text-[10px] font-bold">
                          {room.unread_count}
                        </span>
                      ) : room.is_group ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary text-[9px] font-bold uppercase shrink-0">
                          Grupo
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Session */}
      {currentUser && (
        <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>
            Logado como <strong>{currentUser.nickname}</strong>
          </span>
          <button
            onClick={onLogout}
            className="text-red-500 hover:underline font-bold text-[11px] cursor-pointer"
          >
            Sair
          </button>
        </div>
      )}
    </aside>
  );
};
