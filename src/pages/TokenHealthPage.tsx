import React, { useState, useEffect } from 'react';
import { RefreshCw, Link2, Clock, Activity, Zap, Shield, AlertTriangle, CheckCircle2, ExternalLink, Plus } from 'lucide-react';
import { Button, Badge, Card, MetricCard, CircuitBadge, PlatformIcon, Modal, Input } from '../components/ui';
import { formatDistanceToNow, addHours, format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { tokenVaultApi, oauthApi } from '../lib/api';

interface AccountDisplay {
  id: string;
  platform: string;
  username: string;
  health_status: string;
  last_refresh_at: string;
  token_expires_at: string;
  last_webhook_at: string;
  circuit_state: string;
  failure_rate: number;
  rate_limit_pct: number;
  granted_scopes: string[];
  missing_scopes: string[];
  refresh_history: { at: string; result: string; trigger: string; duration: number }[];
}

const REQUIRED_SCOPES = {
  INSTAGRAM: ['instagram_manage_messages', 'instagram_manage_comments', 'pages_messaging', 'pages_manage_metadata'],
  FACEBOOK: ['pages_messaging', 'pages_manage_metadata', 'pages_messaging_subscriptions'],
  TIKTOK: ['dm.send', 'comment.list', 'user.info.basic', 'business.account.info'],
};

export function TokenHealthPage() {
  const { tenant, brand } = useAuth();
  const [accounts, setAccounts] = useState<AccountDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant) return;
    async function loadAccounts() {
      setLoading(true);
      const { data, error } = await supabase
        .from('connected_accounts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('platform');

      if (error) {
        console.error('Failed to load connected accounts:', error);
        setLoading(false);
        return;
      }

      const mapped: AccountDisplay[] = (data || []).map(row => {
        const required = REQUIRED_SCOPES[row.platform as keyof typeof REQUIRED_SCOPES] || [];
        const granted = row.granted_scopes || [];
        const missing = required.filter(s => !granted.includes(s));

        return {
          id: row.id,
          platform: row.platform,
          username: row.platform_username || row.platform_account_id,
          health_status: row.health_status || 'HEALTHY',
          last_refresh_at: row.last_refresh_at || new Date().toISOString(),
          token_expires_at: row.token_expires_at || new Date().toISOString(),
          last_webhook_at: row.last_webhook_at || new Date().toISOString(),
          circuit_state: row.circuit_state || 'CLOSED',
          failure_rate: row.failure_count ?? 0,
          rate_limit_pct: 0,
          granted_scopes: granted,
          missing_scopes: missing,
          refresh_history: [],
        };
      });

      setAccounts(mapped);
      setLoading(false);
    }
    loadAccounts();
  }, [tenant]);

  const healthy = accounts.filter(a => a.health_status === 'HEALTHY').length;
  const expiring = accounts.filter(a => a.health_status === 'EXPIRING').length;
  const broken = accounts.filter(a => a.health_status === 'BROKEN').length;

  async function forceRefresh(id: string) {
    setRefreshing(id);
    try {
      await tokenVaultApi.forceRefresh(id);
      // Re-fetch accounts to reflect updated state
      if (tenant) {
        const { data } = await supabase
          .from('connected_accounts')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('platform');
        if (data) {
          const mapped: AccountDisplay[] = data.map(row => {
            const required = REQUIRED_SCOPES[row.platform as keyof typeof REQUIRED_SCOPES] || [];
            const granted = row.granted_scopes || [];
            const missing = required.filter(s => !granted.includes(s));
            return {
              id: row.id,
              platform: row.platform,
              username: row.platform_username || row.platform_account_id,
              health_status: row.health_status || 'HEALTHY',
              last_refresh_at: row.last_refresh_at || new Date().toISOString(),
              token_expires_at: row.token_expires_at || new Date().toISOString(),
              last_webhook_at: row.last_webhook_at || new Date().toISOString(),
              circuit_state: row.circuit_state || 'CLOSED',
              failure_rate: row.failure_count ?? 0,
              rate_limit_pct: 0,
              granted_scopes: granted,
              missing_scopes: missing,
              refresh_history: [],
            };
          });
          setAccounts(mapped);
        }
      }
    } catch (err) {
      console.error('Force refresh failed:', err);
    } finally {
      setRefreshing(null);
    }
  }

  async function reauthenticate(acc: AccountDisplay) {
    if (!tenant || !brand) return;
    try {
      const isTiktok = acc.platform === 'TIKTOK';
      const result = isTiktok
        ? await oauthApi.tiktokAuthorizeUrl(tenant.id, brand.id)
        : await oauthApi.metaAuthorizeUrl(tenant.id, brand.id);
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      console.error('Re-authenticate failed:', err);
    }
  }

  async function addAccount(platform: string) {
    if (!tenant || !brand) return;
    try {
      const isTiktok = platform === 'TIKTOK';
      const result = isTiktok
        ? await oauthApi.tiktokAuthorizeUrl(tenant.id, brand.id)
        : await oauthApi.metaAuthorizeUrl(tenant.id, brand.id);
      setShowAddModal(false);
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      console.error('Add account failed:', err);
    }
  }

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#F0F2FF]">Connected Accounts & Health</h1>
          <p className="text-xs text-[#8B90A7] mt-0.5">Monitor token health, scopes, and circuit breakers</p>
        </div>
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" /> Add Account
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Healthy Accounts" value={healthy} icon={<CheckCircle2 className="w-4 h-4" />} iconColor="text-green-400" />
        <MetricCard label="Expiring Soon" value={expiring} icon={<Clock className="w-4 h-4" />} iconColor="text-amber-400" subtitle="< 72h until expiry" />
        <MetricCard label="Broken" value={broken} icon={<AlertTriangle className="w-4 h-4" />} iconColor="text-red-400" subtitle="Flows paused" />
        <MetricCard label="Total Platforms" value={accounts.length} icon={<Activity className="w-4 h-4" />} subtitle="Across all brands" />
      </div>

      {/* Broken alert banner */}
      {broken > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-300">{broken} account{broken > 1 ? 's' : ''} have broken tokens</p>
            <p className="text-xs text-[#8B90A7] mt-0.5">Flows for these accounts are paused. Re-authenticate to restore service.</p>
          </div>
        </div>
      )}

      {/* Account cards */}
      <div className="grid grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-[#4B5068] text-sm">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-[#4B5068] text-sm">No connected accounts yet. Click "Add Account" to get started.</div>
        ) : accounts.map(acc => (
          <div key={acc.id} className={`bg-[#1A1C24] rounded-xl border transition-all ${acc.health_status === 'BROKEN' ? 'border-red-500/30 bg-red-500/5' : acc.health_status === 'EXPIRING' ? 'border-amber-500/20' : 'border-[#2A2E42]'}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1E2130]">
              <div className="flex items-center gap-3">
                <PlatformIcon platform={acc.platform} size={24} />
                <div>
                  <p className="text-sm font-semibold text-[#F0F2FF]">{acc.username}</p>
                  <p className="text-[10px] text-[#4B5068]">{acc.platform}</p>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${acc.health_status === 'HEALTHY' ? 'bg-green-400' : acc.health_status === 'EXPIRING' ? 'bg-amber-400' : 'bg-red-400'} ${acc.health_status === 'BROKEN' ? 'priority-red-pulse' : ''}`} />
            </div>

            {/* Broken banner */}
            {acc.health_status === 'BROKEN' && (
              <div className="mx-4 mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-300 font-medium">Token broken — flows paused</p>
                <p className="text-[10px] text-[#8B90A7] mt-0.5">Broken {formatDistanceToNow(new Date(acc.last_refresh_at))} ago</p>
              </div>
            )}

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3 p-4">
              {[
                { label: 'Token age', value: `${formatDistanceToNow(new Date(acc.last_refresh_at))} ago` },
                { label: 'Expires', value: new Date(acc.token_expires_at) < new Date() ? 'Expired' : `In ${formatDistanceToNow(new Date(acc.token_expires_at))}` },
                { label: 'Last webhook', value: `${formatDistanceToNow(new Date(acc.last_webhook_at))} ago` },
                { label: 'Failure rate', value: `${acc.failure_rate}%` },
                { label: 'Rate limit used', value: `${acc.rate_limit_pct}%` },
                { label: 'Circuit', value: <CircuitBadge state={acc.circuit_state} /> },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-[#4B5068] uppercase tracking-wider">{label}</p>
                  <div className="text-xs font-medium text-[#F0F2FF] mt-0.5">{value}</div>
                </div>
              ))}
            </div>

            {/* Scopes */}
            <div className="px-4 pb-3">
              <p className="text-[10px] text-[#4B5068] uppercase tracking-wider mb-2">Scopes</p>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {REQUIRED_SCOPES[acc.platform as keyof typeof REQUIRED_SCOPES]?.map(scope => {
                  const granted = acc.granted_scopes.includes(scope);
                  return (
                    <div key={scope} className="flex items-center gap-1.5">
                      {granted
                        ? <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                        : <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                      }
                      <span className={`text-[10px] font-mono ${granted ? 'text-[#8B90A7]' : 'text-red-400'}`}>{scope}</span>
                    </div>
                  );
                })}
              </div>
              {acc.missing_scopes.length > 0 && (
                <button className="text-[10px] text-blue-400 hover:text-blue-300 mt-1.5 flex items-center gap-1">
                  Fix missing scopes <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 p-4 pt-2 border-t border-[#1E2130]">
              <Button
                variant="secondary"
                size="sm"
                loading={refreshing === acc.id}
                onClick={() => forceRefresh(acc.id)}
                className="flex-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Force Refresh
              </Button>
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => reauthenticate(acc)}>
                <Link2 className="w-3.5 h-3.5" /> Re-authenticate
              </Button>
            </div>

            {/* Refresh history */}
            <div className="px-4 pb-4">
              <button
                onClick={() => setExpandedHistory(expandedHistory === acc.id ? null : acc.id)}
                className="text-[10px] text-[#4B5068] hover:text-[#F0F2FF] flex items-center gap-1"
              >
                Refresh history ({acc.refresh_history.length})
              </button>
              {expandedHistory === acc.id && (
                <div className="mt-2 space-y-1.5 slide-up">
                  {acc.refresh_history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="text-[#4B5068]">{format(new Date(h.at), 'MMM d, HH:mm')}</span>
                      <span className={h.result === 'success' ? 'text-green-400' : 'text-red-400'}>{h.result}</span>
                      <span className="text-[#4B5068]">{h.trigger}</span>
                      <span className="text-[#4B5068] font-mono">{h.duration}ms</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Account Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Connect New Account">
        <div className="space-y-3">
          <p className="text-xs text-[#8B90A7]">Choose a platform to connect. You'll be redirected through the platform's OAuth flow.</p>
          {[
            { platform: 'INSTAGRAM', label: 'Instagram', desc: 'Connect via Meta Business Extension' },
            { platform: 'FACEBOOK', label: 'Facebook', desc: 'Connect Facebook Page via MBE' },
            { platform: 'TIKTOK', label: 'TikTok', desc: 'Connect TikTok Business account' },
          ].map(p => (
            <button
              key={p.platform}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-[#111318] border border-[#2A2E42] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all text-left"
              onClick={() => addAccount(p.platform)}
            >
              <PlatformIcon platform={p.platform} size={24} />
              <div>
                <p className="text-sm font-semibold text-[#F0F2FF]">{p.label}</p>
                <p className="text-xs text-[#8B90A7]">{p.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
