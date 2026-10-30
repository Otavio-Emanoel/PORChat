'use client';

import React, { useState, useEffect } from 'react';
import { X, Users, Check, AlertCircle, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getStoredToken } from '@/lib/auth';

interface Contact {
  id: string;
  nickname: string;
  email: string;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserNickname?: string;
}

export function CreateGroupModal({ isOpen, onClose, currentUserNickname }: CreateGroupModalProps) {
  const router = useRouter();
  const [groupName, setGroupName] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
      fetch(`${apiBase}/api/users`)
        .then((res) => res.json())
        .then((data: Contact[]) => {
          // Exclude current user from selection list
          const others = data.filter((u) => u.nickname !== currentUserNickname);
          setContacts(others);
        })
        .catch((err) => console.error(err));
    }
  }, [isOpen, currentUserNickname]);

  if (!isOpen) return null;

  const toggleContact = (nickname: string) => {
    setSelectedContacts((prev) =>
      prev.includes(nickname) ? prev.filter((n) => n !== nickname) : [...prev, nickname]
    );
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
      const allMembers = [currentUserNickname || 'Você', ...selectedContacts];

      const token = getStoredToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${apiBase}/api/rooms`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: groupName.trim(),
          is_group: true,
          members: allMembers,
          created_by: currentUserNickname || 'Anônimo',
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao criar grupo');
      }

      const room = await res.json();
      onClose();
      router.push(`/room/${room.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar grupo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden font-body">
        {/* Top Header Banner */}
        <div className="h-3 bg-gradient-to-r from-brand-primary via-brand-mint to-brand-reward" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-primary/10 text-brand-primary mb-3">
              <Users className="w-7 h-7" />
            </div>
            <h2 className="font-heading text-2xl text-ink-main tracking-tight">
              Novo Grupo
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              Dê um nome ao grupo e selecione os contatos para adicionar:
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Nome do Grupo
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ex: Pedro, Otávio e Raul, Resenha..."
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">
                Adicionar Participantes ({selectedContacts.length} selecionados)
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {contacts.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-2">Carregando contatos...</p>
                ) : (
                  contacts.map((contact) => {
                    const isSelected = selectedContacts.includes(contact.nickname);
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => toggleContact(contact.nickname)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                            : 'bg-gray-50 border-gray-200/80 hover:bg-gray-100 text-ink-main'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                              isSelected
                                ? 'bg-brand-primary text-white'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {contact.nickname[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-bold">{contact.nickname}</div>
                            <div className="text-[10px] text-gray-400">{contact.email}</div>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                            isSelected
                              ? 'bg-brand-primary border-brand-primary text-white'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !groupName.trim()}
              className="w-full mt-4 py-3 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl font-bold text-sm shadow-md tactile-btn transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Criar Grupo
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
