import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  RefreshCw,
  Key,
  Users,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Layers,
  Copy,
  Check,
} from 'lucide-react';
import { OwnerStats } from '../lib/types';

interface OwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  onQuotaReset?: () => void;
}

interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  freeModels: string[];
  rpm: number;
  rpd?: number;
  envVar: string;
  signUpUrl: string;
  notes: string;
}

export const OwnerModal: React.FC<OwnerModalProps> = ({ isOpen, onClose, userEmail, onQuotaReset }) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'presets'>('monitor');
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [presets, setPresets] = useState<ProviderPreset[]>([]);
  const [configuredKeys, setConfiguredKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [copiedEnv, setCopiedEnv] = useState<string | null>(null);

  const fetchStatsAndProviders = async () => {
    setLoading(true);
    try {
      const [statsRes, provRes] = await Promise.all([
        fetch(`/api/owner/stats?email=${encodeURIComponent(userEmail || '')}`),
        fetch('/api/owner/providers'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (provRes.ok) {
        const provData = await provRes.json();
        setPresets(provData.presets || []);
        setConfiguredKeys(provData.configuredKeys || []);
      }
    } catch (err) {
      console.error('Failed to fetch owner data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatsAndProviders();
    }
  }, [isOpen]);

  const handleResetUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId.trim()) return;
    try {
      const res = await fetch('/api/owner/reset-quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerEmail: userEmail, targetUserId: resetUserId.trim() }),
      });
      if (res.ok) {
        setResetMessage(`Reset quota for user ${resetUserId.trim()}`);
        setResetUserId('');
        fetchStatsAndProviders();
        if (onQuotaReset) onQuotaReset();
        setTimeout(() => setResetMessage(''), 3000);
      }
    } catch (err) {
      console.error('Failed to reset quota:', err);
    }
  };

  const copyEnvSnippet = (envVar: string, defaultModel: string) => {
    const text = `${envVar}="your-key-here"`;
    navigator.clipboard.writeText(text);
    setCopiedEnv(envVar);
    setTimeout(() => setCopiedEnv(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[#0f0f12] border border-zinc-800 rounded-xl p-6 shadow-2xl max-h-[88vh] flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-orange-500" />
            <h2 className="text-sm font-semibold text-white tracking-tight">
              Owner Operations &amp; Free LLM Key Pool
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
              Aarush Gupta
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatsAndProviders}
              disabled={loading}
              className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-2 text-xs">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'monitor'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Live Monitor &amp; Slots
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'presets'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers size={13} />
            <span>Free LLM API Catalog ({presets.length})</span>
          </button>
        </div>

        {/* Tab 1: Monitor */}
        {activeTab === 'monitor' && (
          <div className="flex-1 overflow-y-auto space-y-5 pr-1 text-xs">
            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-[#141417] border border-zinc-800">
                <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                  <Users size={13} />
                  <span>Total Users</span>
                </div>
                <div className="text-lg font-semibold text-white">{stats?.totalUsers ?? '—'}</div>
                <div className="text-[10px] text-zinc-500">testing accounts</div>
              </div>

              <div className="p-3 rounded-lg bg-[#141417] border border-zinc-800">
                <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                  <MessageSquare size={13} />
                  <span>Messages Used</span>
                </div>
                <div className="text-lg font-semibold text-white">{stats?.totalMessagesUsed ?? '—'}</div>
                <div className="text-[10px] text-zinc-500">
                  {stats?.activeReservations ? `${stats.activeReservations} pending` : '0 pending'}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#141417] border border-zinc-800">
                <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                  <Key size={13} />
                  <span>Active Key Slots</span>
                </div>
                <div className="text-lg font-semibold text-white">
                  {stats?.keySlots?.length ?? 1}
                </div>
                <div className="text-[10px] text-emerald-400">{stats?.systemHealth || 'Operational'}</div>
              </div>
            </div>

            {/* Key Slots Status Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-zinc-300">Configured Key Slots &amp; Health</h3>
                <span className="text-[11px] text-zinc-500">Failover active</span>
              </div>
              <div className="rounded-lg border border-zinc-800 overflow-hidden bg-[#121215]">
                <div className="grid grid-cols-5 p-2 bg-zinc-900/80 text-[11px] font-medium text-zinc-400 border-b border-zinc-800">
                  <span>Slot</span>
                  <span>Provider</span>
                  <span>Model</span>
                  <span>Status</span>
                  <span className="text-right">Failures</span>
                </div>
                {stats?.keySlots && stats.keySlots.length > 0 ? (
                  stats.keySlots.map((slot) => (
                    <div
                      key={slot.slot}
                      className="grid grid-cols-5 p-2 text-[11px] text-zinc-300 border-b border-zinc-800/50 last:border-0 items-center"
                    >
                      <span className="font-mono text-zinc-400">#{slot.slot}</span>
                      <span className="capitalize">{slot.provider}</span>
                      <span className="font-mono text-[10px] text-zinc-400">{slot.model}</span>
                      <span>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            slot.status === 'healthy'
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                              : slot.status === 'cooldown'
                              ? 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                              : 'bg-red-950/60 text-red-300 border border-red-800/40'
                          }`}
                        >
                          {slot.status}
                        </span>
                      </span>
                      <span className="text-right font-mono text-zinc-400">{slot.failureCount}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-zinc-500 text-xs">
                    1 primary key active in server environment
                  </div>
                )}
              </div>
            </div>

            {/* Reset Test Quota for QA */}
            <div className="p-3 rounded-lg bg-[#141417] border border-zinc-800 space-y-2">
              <h4 className="text-xs font-medium text-zinc-300">Reset User Testing Quota (QA Tool)</h4>
              <form onSubmit={handleResetUser} className="flex gap-2">
                <input
                  type="text"
                  value={resetUserId}
                  onChange={(e) => setResetUserId(e.target.value)}
                  placeholder="Enter User ID (or paste your own UID)"
                  className="flex-1 bg-black text-xs text-white px-2.5 py-1.5 rounded-md border border-zinc-800 outline-none focus:border-zinc-700"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-orange-600 hover:bg-orange-500 text-white cursor-pointer transition-colors"
                >
                  Reset to 5 Free
                </button>
              </form>
              {resetMessage && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <CheckCircle2 size={12} />
                  <span>{resetMessage}</span>
                </div>
              )}
            </div>

            {/* Operational Event Log */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-zinc-300">Operational Health Events (Sanitized)</h3>
              <div className="rounded-lg border border-zinc-800 bg-[#121215] p-2 max-h-40 overflow-y-auto space-y-1.5 font-mono text-[11px]">
                {stats?.logs && stats.logs.length > 0 ? (
                  stats.logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between gap-2 p-1.5 rounded bg-zinc-900/60 border border-zinc-800/40"
                    >
                      <div>
                        <span className="text-zinc-500 mr-2">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span
                          className={
                            log.status === 'error'
                              ? 'text-red-400'
                              : log.status === 'warning'
                              ? 'text-amber-400'
                              : log.status === 'success'
                              ? 'text-emerald-400'
                              : 'text-zinc-300'
                          }
                        >
                          {log.event}
                        </span>
                        {log.details && (
                          <div className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-md">
                            {log.details}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-500 text-center py-4">No events logged yet</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Free LLM API Presets */}
        {activeTab === 'presets' && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
            <div className="p-3 rounded-lg bg-orange-950/20 border border-orange-800/40 text-zinc-300 space-y-1">
              <div className="text-xs font-medium text-orange-400 flex items-center gap-1.5">
                <ShieldCheck size={14} />
                <span>Zero Cost · Permanent Free Tier LLM Providers</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Curated from <strong>awesome-freellm-apis</strong>. Add any of these environment variables to your
                Vercel deployment or <code>.env</code> file. Hearth automatically recognizes them, assigns user slots,
                and routes requests with failover.
              </p>
            </div>

            <div className="space-y-3">
              {presets.map((preset) => {
                const isConfigured = configuredKeys.some((k) => k.provider === preset.id);

                return (
                  <div
                    key={preset.id}
                    className="p-3.5 rounded-lg bg-[#141417] border border-zinc-800/80 hover:border-zinc-700 transition-colors space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{preset.name}</span>
                        {isConfigured ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/50">
                            Active in pool
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400">
                            Ready to configure
                          </span>
                        )}
                      </div>

                      <a
                        href={preset.signUpUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] text-orange-400 hover:text-orange-300"
                      >
                        <span>Get Free Key</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>

                    <p className="text-[11px] text-zinc-400">{preset.notes}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-black/40 p-2 rounded-md font-mono text-[10px]">
                      <div>
                        <span className="text-zinc-500 block">Default Model:</span>
                        <span className="text-zinc-200">{preset.defaultModel}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Rate Limit:</span>
                        <span className="text-zinc-200">{preset.rpm} RPM</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Env Variable:</span>
                        <span className="text-orange-300 font-semibold">{preset.envVar}</span>
                      </div>
                    </div>

                    {/* Copy variable action */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="text-[10px] text-zinc-500 truncate max-w-sm">
                        Available models: {preset.freeModels.join(', ')}
                      </div>

                      <button
                        onClick={() => copyEnvSnippet(preset.envVar, preset.defaultModel)}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer transition-colors"
                      >
                        {copiedEnv === preset.envVar ? (
                          <>
                            <Check size={11} className="text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Copy .env snippet</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
