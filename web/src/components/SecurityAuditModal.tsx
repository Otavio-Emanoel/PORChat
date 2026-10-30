'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  X,
  Download,
  FileText,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  History,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { AuditEvent, ChatMessage } from '@porchat/shared';
import { fetchAuditEvents, getStoredSecuritySettings, saveStoredSecuritySettings } from '@/lib/security';
import { downloadChatJson, downloadChatTxt } from '@/lib/chatExport';
import { getStoredToken } from '@/lib/auth';

interface SecurityAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  messages: ChatMessage[];
  currentNickname: string;
}

export function SecurityAuditModal({
  isOpen,
  onClose,
  roomId,
  roomName,
  messages,
  currentNickname,
}: SecurityAuditModalProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'audit' | 'export' | 'settings'>('status');
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [settings, setSettings] = useState(getStoredSecuritySettings());

  useEffect(() => {
    if (!isOpen) return;
    loadAuditEvents();
  }, [isOpen]);

  const loadAuditEvents = async () => {
    const token = getStoredToken();
    if (!token) return;
    setIsLoadingAudit(true);
    try {
      const events = await fetchAuditEvents(token);
      setAuditEvents(events);
    } catch {
      // Ignore error
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleExportJson = async () => {
    try {
      const archive = await downloadChatJson(roomId, roomName, messages, currentNickname, {
        format: 'json',
        include_system_events: true,
      });
      setExportFeedback(`Exportado com sucesso! Checksum: ${archive.sha256_checksum.substring(0, 12)}...`);
      setTimeout(() => setExportFeedback(null), 5000);
    } catch {
      setExportFeedback('Erro ao exportar arquivo.');
    }
  };

  const handleExportTxt = async () => {
    try {
      await downloadChatTxt(roomId, roomName, messages, currentNickname, {
        format: 'txt',
        include_system_events: false,
      });
      setExportFeedback('Arquivo de texto baixado com sucesso!');
      setTimeout(() => setExportFeedback(null), 5000);
    } catch {
      setExportFeedback('Erro ao exportar arquivo.');
    }
  };

  const handleToggleLinkGuard = () => {
    const updated = {
      ...settings,
      link_safety_interceptor: !settings.link_safety_interceptor,
    };
    setSettings(updated);
    saveStoredSecuritySettings(updated);
  };

  const handleTimeoutChange = (minutes: number) => {
    const updated = {
      ...settings,
      session_timeout_minutes: minutes,
    };
    setSettings(updated);
    saveStoredSecuritySettings(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 flex flex-col overflow-hidden max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-5 bg-[#F0F2F5] border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-heading font-bold text-base text-ink-main leading-tight">
                Central de Segurança & Auditoria
              </h3>
              <p className="text-[11px] text-gray-400 font-medium">
                Sala: {roomName} • Proteção Ativa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50/70 px-4 text-xs font-bold text-gray-500">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`py-3 px-3 border-b-2 transition-all ${
              activeTab === 'status'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent hover:text-gray-700'
            }`}
          >
            Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`py-3 px-3 border-b-2 transition-all ${
              activeTab === 'export'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent hover:text-gray-700'
            }`}
          >
            Exportar Conversa
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent hover:text-gray-700'
            }`}
          >
            <span>Log de Auditoria</span>
            {auditEvents.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-extrabold">
                {auditEvents.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-3 border-b-2 transition-all ${
              activeTab === 'settings'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent hover:text-gray-700'
            }`}
          >
            Configurações
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs font-body">
          {activeTab === 'status' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-heading font-bold text-emerald-950 text-sm">
                    Ambiente Protegido & Criptografado
                  </h4>
                  <p className="text-emerald-800 text-xs mt-1 leading-relaxed">
                    Sua sessão utiliza autenticação baseada em token JWT com verificação de origem estrita (anti-CSWSH), sanitização multi-camada contra XSS e rate limiting contra abuso.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Proteção CSWSH
                  </span>
                  <span className="text-sm font-bold text-emerald-600 block mt-1">Ativa</span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Origens não autorizadas bloqueadas
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Sanitização de XSS
                  </span>
                  <span className="text-sm font-bold text-emerald-600 block mt-1">Filtragem Ativa</span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    HTML e caracteres invisíveis neutralizados
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Taxa de Envio (Rate Limit)
                  </span>
                  <span className="text-sm font-bold text-ink-main block mt-1">30 msgs / min</span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Token bucket por IP e sessão
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Integridade de Mensagens
                  </span>
                  <span className="text-sm font-bold text-ink-main block mt-1">SHA-256</span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Exportações assinadas criptograficamente
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-4">
              <p className="text-gray-600 text-xs leading-relaxed">
                Exporte todo o histórico desta sala com verificação criptográfica de integridade SHA-256, garantindo que o arquivo não sofreu adulteração.
              </p>

              {exportFeedback && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{exportFeedback}</span>
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="w-full p-4 rounded-2xl border border-gray-200 hover:border-brand-primary bg-white hover:bg-brand-primary/5 transition-all flex items-center justify-between text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                      <FileCode className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-ink-main text-sm">
                        Exportar JSON Assinado (SHA-256)
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        Arquivo completo legível por máquinas com metadados, checksum e mensagens
                      </p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-gray-400 group-hover:text-brand-primary transition-colors" />
                </button>

                <button
                  type="button"
                  onClick={handleExportTxt}
                  className="w-full p-4 rounded-2xl border border-gray-200 hover:border-brand-primary bg-white hover:bg-brand-primary/5 transition-all flex items-center justify-between text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-ink-main text-sm">
                        Exportar Relatório em Texto (.TXT)
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        Transcrição limpa para leitura humana ou impressão
                      </p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-gray-400 group-hover:text-brand-primary transition-colors" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Eventos Recentes ({auditEvents.length})
                </span>
                <button
                  type="button"
                  onClick={loadAuditEvents}
                  disabled={isLoadingAudit}
                  className="text-xs text-brand-primary hover:underline flex items-center gap-1 font-bold"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>
              </div>

              {auditEvents.length === 0 ? (
                <div className="p-8 text-center text-gray-400 rounded-2xl bg-gray-50 border border-gray-100">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Nenhum evento crítico registrado recentemente.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {auditEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-2xl bg-gray-50 border border-gray-100 flex items-start justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-ink-main">{ev.type}</span>
                          {ev.ip && (
                            <span className="text-[10px] text-gray-400 font-mono">
                              IP: {ev.ip}
                            </span>
                          )}
                        </div>
                        {ev.details && (
                          <span className="text-[10px] text-gray-500 block mt-0.5">
                            {JSON.stringify(ev.details)}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0 font-mono">
                        {new Date(ev.timestamp * 1000).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                <div>
                  <h4 className="font-heading font-bold text-ink-main text-xs">
                    Interceptador de Links Externos
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Exibir aviso preventivo antes de abrir páginas externas fora do PORChat
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLinkGuard}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    settings.link_safety_interceptor ? 'bg-brand-primary' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white shadow-xs absolute top-0.5 transition-transform ${
                      settings.link_safety_interceptor ? 'right-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
                <div>
                  <h4 className="font-heading font-bold text-ink-main text-xs">
                    Tempo Limite de Inatividade da Sessão
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Bloqueio preventivo caso não haja atividade de mouse ou teclado
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  {[15, 30, 60, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleTimeoutChange(mins)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        settings.session_timeout_minutes === mins
                          ? 'bg-brand-primary text-white shadow-2xs'
                          : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
                      }`}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#F0F2F5] border-t border-gray-200 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-600" />
            <span>PORChat Security Protocol v1.4</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white hover:bg-gray-100 text-ink-main text-xs font-bold border border-gray-200 transition-all cursor-pointer shadow-2xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
