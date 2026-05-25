import React, { useState, useEffect } from 'react';
import {
  Shield, Download, Trash2, Clock, FileText, Eye, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp, Lock, RefreshCw, Users,
  Database, Calendar
} from 'lucide-react';
import { Button, Card, Toggle, Badge, Modal, Select } from '../components/ui';
import { format, subDays } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { gdprApi } from '../lib/api';

interface ConsentLogEntry {
  id: string;
  contact: string;
  action: string;
  platform: string;
  channel: string;
  timestamp: string;
  ip: string;
  method: string;
}

const DATA_CATEGORIES = [
  { name: 'Contact profiles', description: 'Name, username, platform IDs, loyalty tier', retention: 90, canDelete: true, records: 3421 },
  { name: 'Conversation messages', description: 'Full DM thread history and timestamps', retention: 365, canDelete: true, records: 48200 },
  { name: 'AI audit logs', description: 'LLM prompts, responses, token counts, costs', retention: 365, canDelete: false, records: 12100 },
  { name: 'Attribution events', description: 'Click events, purchase signals, UTM data', retention: 730, canDelete: true, records: 8900 },
  { name: 'Short link clicks', description: 'Anonymized click tracking with identity tokens', retention: 730, canDelete: true, records: 1251 },
  { name: 'Flow run history', description: 'Execution traces, node outputs, test runs', retention: 90, canDelete: true, records: 22400 },
];

export function GDPRPage() {
  const { tenant, brand } = useAuth();
  const [retentions, setRetentions] = useState<Record<string, number>>(
    Object.fromEntries(DATA_CATEGORIES.map(c => [c.name, c.retention]))
  );
  const [exportModal, setExportModal] = useState(false);
  const [purgeModal, setPurgeModal] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [autoDeleteExpired, setAutoDeleteExpired] = useState(true);
  const [anonymizeOnDelete, setAnonymizeOnDelete] = useState(true);
  const [doubleOptIn, setDoubleOptIn] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [purging, setPurging] = useState(false);
  const [region, setRegion] = useState('EU');
  const [consentLogs, setConsentLogs] = useState<ConsentLogEntry[]>([]);
  const [complianceStats, setComplianceStats] = useState<{
    consentRate: string;
    optOutsThisMonth: number;
    pendingDsars: number;
    lastAudit: string;
    compliant: boolean;
  } | null>(null);
  const [selectedContactId, setSelectedContactId] = useState('');

  useEffect(() => {
    if (!tenant) return;
    gdprApi.consentLogs(tenant.id)
      .then((data: any[]) => {
        const mapped: ConsentLogEntry[] = data.map((entry: any) => ({
          id: entry.id,
          contact: entry.contact_name || entry.contact_id || '—',
          action: entry.action,
          platform: entry.platform || '—',
          channel: entry.channel || '—',
          timestamp: entry.created_at || entry.timestamp,
          ip: entry.ip || '—',
          method: entry.method || '—',
        }));
        setConsentLogs(mapped);
      })
      .catch(() => setConsentLogs([]));
  }, [tenant]);

  useEffect(() => {
    if (!tenant) return;
    gdprApi.complianceStatus(tenant.id)
      .then((data: any) => {
        setComplianceStats({
          consentRate: data.consent_rate != null ? `${data.consent_rate}%` : '—',
          optOutsThisMonth: data.opt_outs_this_month ?? 0,
          pendingDsars: data.pending_dsars ?? 0,
          lastAudit: data.last_audit || format(subDays(new Date(), 3), 'yyyy-MM-dd'),
          compliant: data.compliant !== false,
        });
      })
      .catch(() => setComplianceStats(null));
  }, [tenant]);

  async function handleExport() {
    if (!tenant || !brand || !selectedContactId) return;
    setExporting(true);
    try {
      await gdprApi.exportContact(selectedContactId, tenant.id, brand.id);
    } catch { /* error handled silently */ }
    setExporting(false);
    setExportModal(false);
  }

  async function handlePurge() {
    if (!tenant || !brand || !selectedContactId) return;
    setPurging(true);
    try {
      await gdprApi.eraseContact(selectedContactId, tenant.id, brand.id);
    } catch { /* error handled silently */ }
    setPurging(false);
    setPurgeModal(false);
  }

  const actionColors: Record<string, string> = {
    OPT_IN: 'success',
    OPT_OUT: 'warning',
    DATA_EXPORT: 'info',
    SOFT_DELETE: 'danger',
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#F0F2FF] mb-0.5">GDPR & Compliance</h2>
        <p className="text-xs text-[#8B90A7]">Manage data retention, consent logs, and subject access requests</p>
      </div>

      {/* Compliance Status */}
      <Card>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl ${complianceStats?.compliant !== false ? 'bg-green-500/10' : 'bg-red-500/10'} flex items-center justify-center flex-shrink-0`}>
            <Shield className={`w-5 h-5 ${complianceStats?.compliant !== false ? 'text-green-400' : 'text-red-400'}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-[#F0F2FF]">Compliance Status</h3>
              <Badge variant={complianceStats?.compliant !== false ? 'success' : 'danger'}>
                {complianceStats?.compliant !== false ? <><CheckCircle2 className="w-3 h-3" /> Compliant</> : <><AlertTriangle className="w-3 h-3" /> Non-compliant</>}
              </Badge>
            </div>
            <p className="text-xs text-[#8B90A7] mb-3">Your account {complianceStats?.compliant !== false ? 'meets' : 'does not meet'} GDPR/CCPA requirements. Last audit: {complianceStats?.lastAudit ? format(new Date(complianceStats.lastAudit), 'MMM d, yyyy') : '—'}.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Consent rate', value: complianceStats?.consentRate ?? '—', positive: complianceStats ? parseInt(complianceStats.consentRate) >= 90 : null },
                { label: 'Opt-outs this month', value: String(complianceStats?.optOutsThisMonth ?? '—'), positive: null },
                { label: 'Pending DSARs', value: String(complianceStats?.pendingDsars ?? '—'), positive: complianceStats ? complianceStats.pendingDsars === 0 : null },
              ].map(stat => (
                <div key={stat.label} className="p-2.5 rounded-lg bg-[#0A0B0F] border border-[#1E2130]">
                  <p className={`text-base font-bold ${stat.positive === true ? 'text-green-400' : stat.positive === false ? 'text-red-400' : 'text-[#F0F2FF]'}`}>{stat.value}</p>
                  <p className="text-[10px] text-[#4B5068]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Compliance Settings */}
      <Card>
        <h3 className="text-sm font-semibold text-[#F0F2FF] mb-4">Compliance Controls</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-[#1E2130]">
            <div>
              <p className="text-sm font-medium text-[#F0F2FF]">Double opt-in for new contacts</p>
              <p className="text-xs text-[#8B90A7] mt-0.5">Require explicit confirmation before adding contacts to flows</p>
            </div>
            <Toggle checked={doubleOptIn} onChange={setDoubleOptIn} />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-[#1E2130]">
            <div>
              <p className="text-sm font-medium text-[#F0F2FF]">Auto-delete expired data</p>
              <p className="text-xs text-[#8B90A7] mt-0.5">Automatically delete records that have exceeded their retention period</p>
            </div>
            <Toggle checked={autoDeleteExpired} onChange={setAutoDeleteExpired} />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-[#1E2130]">
            <div>
              <p className="text-sm font-medium text-[#F0F2FF]">Anonymize on delete</p>
              <p className="text-xs text-[#8B90A7] mt-0.5">Replace PII with anonymous tokens instead of hard-deleting (preserves analytics)</p>
            </div>
            <Toggle checked={anonymizeOnDelete} onChange={setAnonymizeOnDelete} />
          </div>
          <div className="flex items-start justify-between py-3">
            <div>
              <p className="text-sm font-medium text-[#F0F2FF]">Data residency region</p>
              <p className="text-xs text-[#8B90A7] mt-0.5">Where your contact data is stored and processed</p>
            </div>
            <Select
              value={region}
              onChange={e => setRegion(e.target.value)}
              options={[
                { value: 'EU', label: 'EU (Frankfurt)' },
                { value: 'US', label: 'US (Virginia)' },
                { value: 'APAC', label: 'APAC (Singapore)' },
              ]}
              className="w-44"
            />
          </div>
        </div>
      </Card>

      {/* Data Retention */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#F0F2FF]">Data Retention Periods</h3>
            <p className="text-xs text-[#8B90A7] mt-0.5">Configure how long each data category is retained</p>
          </div>
          <Button variant="secondary" size="sm">Save retention policy</Button>
        </div>
        <div className="space-y-4">
          {DATA_CATEGORIES.map(cat => (
            <div key={cat.name} className="p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130]">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-[#F0F2FF]">{cat.name}</p>
                    {!cat.canDelete && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400">
                        <Lock className="w-2.5 h-2.5" /> Required for compliance
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#4B5068] mt-0.5">{cat.description}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-xs text-[#8B90A7]">{cat.records.toLocaleString()} records</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={cat.canDelete ? 30 : 365}
                  max={730}
                  step={30}
                  value={retentions[cat.name]}
                  onChange={e => setRetentions(prev => ({ ...prev, [cat.name]: Number(e.target.value) }))}
                  disabled={!cat.canDelete}
                  className="flex-1 accent-blue-500 disabled:opacity-40"
                />
                <span className="text-xs font-semibold text-[#F0F2FF] w-20 text-right">
                  {retentions[cat.name]} days
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Subject Access & Erasure */}
      <Card>
        <h3 className="text-sm font-semibold text-[#F0F2FF] mb-1">Data Subject Requests (DSAR)</h3>
        <p className="text-xs text-[#8B90A7] mb-4">Export or erase all data for a specific contact (Art. 15, 17 GDPR)</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="secondary" onClick={() => setExportModal(true)}>
            <Download className="w-4 h-4" /> Export Contact Data
          </Button>
          <Button variant="danger" onClick={() => setPurgeModal(true)}>
            <Trash2 className="w-4 h-4" /> Erase Contact Data
          </Button>
        </div>
      </Card>

      {/* Consent Log */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#F0F2FF]">Consent Audit Log</h3>
            <p className="text-xs text-[#8B90A7] mt-0.5">Immutable log of all consent events — 1 year retention</p>
          </div>
          <Button variant="secondary" size="sm">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#1E2130]">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="bg-[#0A0B0F] border-b border-[#1E2130]">
                {['Time', 'Contact', 'Action', 'Platform', 'Method', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {consentLogs.map(log => (
                <React.Fragment key={log.id}>
                  <tr
                    className="border-b border-[#1E2130] hover:bg-[#0A0B0F] transition-colors cursor-pointer"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <td className="px-3 py-2.5 text-xs text-[#8B90A7]">{format(new Date(log.timestamp), 'MMM d HH:mm')}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-[#F0F2FF]">{log.contact}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={actionColors[log.action] as any}>{log.action.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[#8B90A7]">{log.platform}</td>
                    <td className="px-3 py-2.5 text-xs text-[#8B90A7] max-w-[160px] truncate">{log.method}</td>
                    <td className="px-3 py-2.5 text-[#4B5068]">
                      {expandedLog === log.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </td>
                  </tr>
                  {expandedLog === log.id && (
                    <tr className="border-b border-[#1E2130]">
                      <td colSpan={6} className="px-3 py-3 bg-[#0A0B0F]">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px]">
                          <div><span className="text-[#4B5068]">Contact: </span><span className="text-[#F0F2FF]">{log.contact}</span></div>
                          <div><span className="text-[#4B5068]">Channel: </span><span className="text-[#F0F2FF]">{log.channel}</span></div>
                          <div><span className="text-[#4B5068]">IP: </span><span className="text-[#F0F2FF]">{log.ip}</span></div>
                          <div><span className="text-[#4B5068]">Timestamp: </span><span className="text-[#F0F2FF]">{format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}</span></div>
                          <div className="col-span-2"><span className="text-[#4B5068]">Method: </span><span className="text-[#F0F2FF]">{log.method}</span></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Export Modal */}
      <Modal
        open={exportModal}
        onClose={() => setExportModal(false)}
        title="Export Contact Data"
        footer={
          <>
            <Button variant="ghost" onClick={() => setExportModal(false)}>Cancel</Button>
            <Button variant="primary" loading={exporting} onClick={handleExport}>
              <Download className="w-3.5 h-3.5" /> Generate Export
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-[#8B90A7]">Export all personal data held for a contact as a machine-readable JSON file, compliant with GDPR Art. 15 (right of access).</p>
          <Select
            label="Select contact"
            value={selectedContactId}
            onChange={e => setSelectedContactId(e.target.value)}
            options={[
              { value: '', label: 'Search or select a contact...' },
              { value: 'emma', label: 'Emma Watson (@emma.w)' },
              { value: 'jake', label: 'Jake Chen (@jakec)' },
              { value: 'maria', label: 'Maria Santos (@marias)' },
            ]}
          />
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#8B90A7]">Export includes:</p>
            {['Profile data & platform IDs', 'Full conversation history', 'Tags, segments, loyalty score', 'Attribution events', 'Consent log entries', 'Flow execution history'].map(item => (
              <div key={item} className="flex items-center gap-2 text-xs text-[#8B90A7]">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <p className="text-xs text-blue-300">Export will be delivered as a secure download link via email within 2 minutes.</p>
          </div>
        </div>
      </Modal>

      {/* Purge Modal */}
      <Modal
        open={purgeModal}
        onClose={() => setPurgeModal(false)}
        title="Erase Contact Data"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPurgeModal(false)}>Cancel</Button>
            <Button variant="danger" loading={purging} onClick={handlePurge}>
              <Trash2 className="w-3.5 h-3.5" /> Confirm Erasure
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">This action is irreversible. All personal data for the selected contact will be anonymized (PII replaced with tokens) in accordance with GDPR Art. 17.</p>
          </div>
          <Select
            label="Select contact"
            value={selectedContactId}
            onChange={e => setSelectedContactId(e.target.value)}
            options={[
              { value: '', label: 'Search or select a contact...' },
              { value: 'emma', label: 'Emma Watson (@emma.w)' },
              { value: 'jake', label: 'Jake Chen (@jakec)' },
              { value: 'maria', label: 'Maria Santos (@marias)' },
            ]}
          />
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#8B90A7]">What will be anonymized:</p>
            {['Name, username, profile picture', 'Phone/email if collected', 'All message content', 'Platform user IDs', 'IP addresses in consent log'].map(item => (
              <div key={item} className="flex items-center gap-2 text-xs text-[#8B90A7]">
                <Trash2 className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <p className="text-xs text-[#4B5068]">Aggregated analytics data (counts, conversions) will be preserved with all PII removed.</p>
        </div>
      </Modal>
    </div>
  );
}
