import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, Star, Tag, Edit2, Trash2,
  Check, X, Plus, ExternalLink, Download, BarChart2,
  Clock, Zap, TrendingUp, AlertTriangle, ChevronRight,
  Phone, Mail, Globe, MapPin, User, Activity, Save, ChevronDown,
  Shield, Layers
} from 'lucide-react';
import {
  Button, Card, Badge, LoyaltyBadge, PlatformIcon, Toggle, Modal, Input, Progress
} from '../components/ui';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip as RechartTooltip, XAxis, YAxis
} from 'recharts';
import { format, subDays, formatDistanceToNow } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { gdprApi, loyaltyApi, flowEngineApi, contactsApi } from '../lib/api';
import { Loader2 } from 'lucide-react';

interface PlatformInfo {
  platform: string;
  username: string;
  followers: number;
  joined: Date;
  lastSeen: Date;
}

interface FlowInfo {
  name: string;
  ran: Date;
  status: string;
  converted: boolean;
}

interface AttributionInfo {
  type: string;
  amount: number | null;
  product: string | null;
  date: Date;
  source: string;
}

interface RecentMessage {
  role: string;
  text: string;
  time: Date;
}

interface ContactData {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: string;
  score: number;
  location: string;
  language: string;
  platforms: PlatformInfo[];
  tags: string[];
  sentiment: number;
  lastInteraction: Date;
  conversations: number;
  revenue: number;
  optedIn: boolean;
  notes: string;
  flows: FlowInfo[];
  timeline: { date: string; messages: number; events: number }[];
  attributionEvents: AttributionInfo[];
  recentMessages: RecentMessage[];
}

interface SegmentRow {
  id: string;
  name: string;
}

interface FlowRow {
  id: string;
  name: string;
  status: string;
}

interface ContactSegmentRow {
  id: string;
  segment_id: string;
  segments: { name: string } | null;
}

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenant, brand } = useAuth();

  const [contact, setContact] = useState<ContactData | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState('');
  const [optedIn, setOptedIn] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [gdprModal, setGdprModal] = useState<'export' | 'delete' | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'conversations' | 'flows' | 'attribution'>('overview');
  const [gdprLoading, setGdprLoading] = useState(false);

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Segments state
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [showSegmentDropdown, setShowSegmentDropdown] = useState(false);
  const [contactSegments, setContactSegments] = useState<ContactSegmentRow[]>([]);
  const [contactSegmentsLoading, setContactSegmentsLoading] = useState(false);
  const [addingToSegment, setAddingToSegment] = useState<string | null>(null);
  const [removingSegment, setRemovingSegment] = useState<string | null>(null);
  const segmentDropdownRef = React.useRef<HTMLDivElement>(null);

  // Trigger flow state
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [flowsLoading, setFlowsLoading] = useState(false);
  const [showFlowDropdown, setShowFlowDropdown] = useState(false);
  const [triggeringFlow, setTriggeringFlow] = useState<string | null>(null);
  const [flowTriggered, setFlowTriggered] = useState<string | null>(null);
  const flowDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (segmentDropdownRef.current && !segmentDropdownRef.current.contains(e.target as Node)) {
        setShowSegmentDropdown(false);
      }
      if (flowDropdownRef.current && !flowDropdownRef.current.contains(e.target as Node)) {
        setShowFlowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!id) return;
    loadContactData(id);
    loadContactSegments(id);
  }, [id]);

  async function loadContactSegments(_contactId: string) {
    setContactSegmentsLoading(true);
    // Segments API to be wired in a future iteration
    setContactSegments([]);
    setContactSegmentsLoading(false);
  }

  async function loadSegments() {
    setSegmentsLoading(true);
    // Segments API to be wired in a future iteration
    setSegments([]);
    setSegmentsLoading(false);
  }

  async function loadFlows() {
    setFlowsLoading(true);
    // Flows list API to be wired in a future iteration
    setFlows([]);
    setFlowsLoading(false);
  }

  async function addToSegment(_segmentId: string) {
    setShowSegmentDropdown(false);
    // Segment membership API to be wired in a future iteration
  }

  async function removeFromSegment(contactSegmentId: string) {
    setContactSegments(prev => prev.filter(cs => cs.id !== contactSegmentId));
    // Segment membership API to be wired in a future iteration
  }

  async function triggerFlow(flowId: string) {
    if (!id || !tenant?.id) return;
    setTriggeringFlow(flowId);
    try {
      await flowEngineApi.execute(flowId);
      setFlowTriggered(flowId);
      setTimeout(() => setFlowTriggered(null), 3000);
    } catch (err) {
      console.error('Failed to trigger flow:', err);
    } finally {
      setTriggeringFlow(null);
      setShowFlowDropdown(false);
    }
  }

  // Inline edit helpers
  function startEdit() {
    if (!contact) return;
    setEditName(contact.name);
    setEditEmail(contact.email);
    setEditPhone(contact.phone);
    setEditNotes(contact.notes);
    setIsEditing(true);
  }

  async function saveEdit() {
    if (!contact) return;
    setSavingEdit(true);
    try {
      await contactsApi.update(contact.id, {
        display_name: editName.trim() || contact.name,
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
        notes: editNotes,
      });
      setContact(prev => prev ? {
        ...prev,
        name: editName.trim() || prev.name,
        email: editEmail.trim(),
        phone: editPhone.trim(),
        notes: editNotes,
      } : prev);
      setNote(editNotes);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save contact:', err);
    } finally {
      setSavingEdit(false);
    }
  }

  async function loadContactData(contactId: string) {
    setLoading(true);
    try {
      const contactRow = await contactsApi.get(contactId) as any;

      if (!contactRow) {
        setLoading(false);
        return;
      }

      // Build empty timeline (30 days)
      const dayMap: Record<string, { messages: number; events: number }> = {};
      for (let i = 0; i < 30; i++) {
        const day = format(subDays(new Date(), 29 - i), 'MMM d');
        dayMap[day] = { messages: 0, events: 0 };
      }
      const timeline = Object.entries(dayMap).map(([date, data]) => ({
        date,
        messages: data.messages,
        events: data.events,
      }));

      const contactData: ContactData = {
        id: contactRow.id,
        name: contactRow.display_name || contactRow.name || 'Unknown',
        email: contactRow.email || '',
        phone: contactRow.phone || '',
        tier: contactRow.loyalty_tier || 'NEWBIE',
        score: contactRow.loyalty_score || 0,
        location: (contactRow.custom_fields as any)?.location || '',
        language: (contactRow.custom_fields as any)?.language || '',
        platforms: [],
        tags: contactRow.tags || [],
        sentiment: contactRow.sentiment_score || 0,
        lastInteraction: new Date(contactRow.updated_at || contactRow.created_at || new Date()),
        conversations: 0,
        revenue: 0,
        optedIn: (contactRow.custom_fields as any)?.optedIn ?? true,
        notes: contactRow.notes || '',
        flows: [],
        timeline,
        attributionEvents: [],
        recentMessages: [],
      };

      setContact(contactData);
      setNote(contactData.notes);
      setOptedIn(contactData.optedIn);
      setTags(contactData.tags);
    } catch (err) {
      console.error('Failed to load contact data:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !contact) {
    return (
      <div className="p-4 md:p-6 max-w-[1400px]">
        <p className="text-xs text-[#8B90A7]">Loading contact...</p>
      </div>
    );
  }

  const sentimentLabel = contact.sentiment > 0.3 ? 'Positive' : contact.sentiment > -0.3 ? 'Neutral' : 'Negative';
  const sentimentColor = contact.sentiment > 0.3 ? 'text-green-400' : contact.sentiment > -0.3 ? 'text-amber-400' : 'text-red-400';
  const sentimentBg = contact.sentiment > 0.3 ? 'bg-green-400/10 border-green-400/20' : contact.sentiment > -0.3 ? 'bg-amber-400/10 border-amber-400/20' : 'bg-red-400/10 border-red-400/20';

  async function removeTag(t: string) {
    const updated = tags.filter(x => x !== t);
    setTags(updated);
    await contactsApi.update(contact!.id, { tags: updated });
  }

  async function addTag() {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      const updated = [...tags, newTag.trim().toLowerCase()];
      setTags(updated);
      await contactsApi.update(contact!.id, { tags: updated });
    }
    setNewTag('');
    setAddingTag(false);
  }

  async function handleSaveNote() {
    setEditingNote(false);
    await contactsApi.update(contact!.id, { notes: note });
  }

  async function handleOptInToggle(val: boolean) {
    setOptedIn(val);
    if (tenant && brand) {
      try {
        await gdprApi.logConsent(tenant.id, brand.id, val ? 'OPT_IN' : 'OPT_OUT', undefined, undefined, contact!.id, contact!.name);
      } catch (err) {
        console.error('Failed to log consent:', err);
      }
    }
    await contactsApi.update(contact!.id, { opted_in: val });
  }

  async function handleGdprExport() {
    if (!tenant || !brand) return;
    setGdprLoading(true);
    try {
      const data = await gdprApi.exportContact(contact!.id, tenant.id, brand.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${contact!.name.replace(/\s+/g, '_')}_export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('GDPR export failed:', err);
    } finally {
      setGdprLoading(false);
      setGdprModal(null);
    }
  }

  async function handleGdprErase() {
    if (!tenant || !brand) return;
    setGdprLoading(true);
    try {
      await gdprApi.eraseContact(contact!.id, tenant.id, brand.id);
      setGdprModal(null);
      navigate('/contacts');
    } catch (err) {
      console.error('GDPR erase failed:', err);
      setGdprLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px]">
      {/* Breadcrumb + back */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate('/contacts')} className="flex items-center gap-1.5 text-xs text-[#8B90A7] hover:text-[#F0F2FF] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Contacts
        </button>
        <ChevronRight className="w-3 h-3 text-[#4B5068]" />
        <span className="text-xs text-[#F0F2FF]">{contact.name}</span>
      </div>

      {/* Responsive grid: stacked on mobile, side-by-side on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6">
        {/* Left panel — profile card */}
        <div className="space-y-4">
          {/* Identity */}
          <Card>
            <div className="flex flex-col items-center text-center pb-4 border-b border-[#1E2130] mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-2xl font-bold text-white mb-3">
                {(isEditing ? editName : contact.name).charAt(0)}
              </div>

              {isEditing ? (
                /* Inline edit fields */
                <div className="w-full space-y-2 text-left">
                  <div>
                    <label className="text-[10px] text-[#4B5068] uppercase tracking-wider mb-1 block">Display Name</label>
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg bg-[#1A1C24] border border-blue-500 text-sm text-[#F0F2FF] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4B5068] uppercase tracking-wider mb-1 block">Email</label>
                    <input
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                      type="email"
                      placeholder="email@example.com"
                      className="w-full h-8 px-2.5 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] focus:outline-none focus:border-blue-500 placeholder:text-[#4B5068]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4B5068] uppercase tracking-wider mb-1 block">Phone</label>
                    <input
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      type="tel"
                      placeholder="+1 234 567 8900"
                      className="w-full h-8 px-2.5 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] focus:outline-none focus:border-blue-500 placeholder:text-[#4B5068]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4B5068] uppercase tracking-wider mb-1 block">Notes</label>
                    <textarea
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      rows={3}
                      placeholder="Internal notes..."
                      className="w-full px-2.5 py-2 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] focus:outline-none focus:border-blue-500 placeholder:text-[#4B5068] resize-none"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={saveEdit}
                      disabled={savingEdit}
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-blue-500 hover:bg-blue-600 text-xs font-medium text-white transition-colors disabled:opacity-50"
                    >
                      {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#8B90A7] hover:text-[#F0F2FF] transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-base font-bold text-[#F0F2FF]">{contact.name}</h2>
                  <LoyaltyBadge tier={contact.tier} />
                  <div className={`mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${sentimentBg} ${sentimentColor}`}>
                    <Activity className="w-3 h-3" />
                    {sentimentLabel} sentiment
                  </div>
                </>
              )}
            </div>

            {!isEditing && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center">
                    <p className="text-base font-bold text-[#F0F2FF]">{contact.score}</p>
                    <p className="text-[10px] text-[#4B5068]">Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-[#F0F2FF]">{contact.conversations}</p>
                    <p className="text-[10px] text-[#4B5068]">Convos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-green-400">${contact.revenue}</p>
                    <p className="text-[10px] text-[#4B5068]">Revenue</p>
                  </div>
                </div>

                {/* Loyalty score bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#4B5068]">Loyalty Score</span>
                    <span className="text-[10px] font-bold text-[#F0F2FF]">{contact.score}/100</span>
                  </div>
                  <Progress
                    value={contact.score}
                    max={100}
                    color={contact.score >= 70 ? 'bg-green-400' : contact.score >= 40 ? 'bg-amber-400' : 'bg-[#4B5068]'}
                  />
                </div>

                {/* Contact info */}
                <div className="space-y-2">
                  {contact.email && (
                    <div className="flex items-center gap-2 text-xs text-[#8B90A7]">
                      <Mail className="w-3.5 h-3.5 text-[#4B5068] flex-shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-xs text-[#8B90A7]">
                      <Phone className="w-3.5 h-3.5 text-[#4B5068] flex-shrink-0" />
                      <span>{contact.phone}</span>
                    </div>
                  )}
                  {contact.location && (
                    <div className="flex items-center gap-2 text-xs text-[#8B90A7]">
                      <MapPin className="w-3.5 h-3.5 text-[#4B5068] flex-shrink-0" />
                      <span>{contact.location}</span>
                    </div>
                  )}
                  {contact.language && (
                    <div className="flex items-center gap-2 text-xs text-[#8B90A7]">
                      <Globe className="w-3.5 h-3.5 text-[#4B5068] flex-shrink-0" />
                      <span>{contact.language}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-[#8B90A7]">
                    <Clock className="w-3.5 h-3.5 text-[#4B5068] flex-shrink-0" />
                    <span>Last seen {formatDistanceToNow(contact.lastInteraction, { addSuffix: true })}</span>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* Current Segments */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[#4B5068] uppercase tracking-wider">Segments</h3>
              <div className="relative" ref={segmentDropdownRef}>
                <button
                  onClick={() => { setShowSegmentDropdown(p => !p); loadSegments(); }}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
                {showSegmentDropdown && (
                  <div className="absolute top-full right-0 mt-1 w-48 bg-[#1A1C24] border border-[#2A2E42] rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-[#2A2E42]">
                      <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">Add to Segment</p>
                    </div>
                    {segmentsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 text-[#4B5068] animate-spin" />
                      </div>
                    ) : segments.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-[#4B5068]">No segments found</div>
                    ) : (
                      segments.map(seg => {
                        const alreadyIn = contactSegments.some(cs => cs.segment_id === seg.id);
                        return (
                          <button
                            key={seg.id}
                            onClick={() => addToSegment(seg.id)}
                            disabled={alreadyIn || addingToSegment === seg.id}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-xs transition-colors ${alreadyIn ? 'text-[#4B5068] cursor-default' : 'text-[#F0F2FF] hover:bg-[#222530]'}`}
                          >
                            <span className="truncate">{seg.name}</span>
                            {alreadyIn && <Check className="w-3 h-3 text-green-400 flex-shrink-0" />}
                            {addingToSegment === seg.id && <Loader2 className="w-3 h-3 text-[#4B5068] animate-spin flex-shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
            {contactSegmentsLoading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="w-4 h-4 text-[#4B5068] animate-spin" />
              </div>
            ) : contactSegments.length === 0 ? (
              <p className="text-xs text-[#4B5068]">Not in any segments yet</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {contactSegments.map(cs => (
                  <span
                    key={cs.id}
                    className="group flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#111318] border border-[#2A2E42] text-[11px] text-[#8B90A7]"
                  >
                    <Layers className="w-2.5 h-2.5 text-blue-400" />
                    {cs.segments?.name || 'Segment'}
                    <button
                      onClick={() => removeFromSegment(cs.id)}
                      disabled={removingSegment === cs.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[#4B5068] hover:text-red-400 ml-0.5"
                    >
                      {removingSegment === cs.id
                        ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        : <X className="w-2.5 h-2.5" />}
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Platforms */}
          <Card>
            <h3 className="text-xs font-semibold text-[#4B5068] uppercase tracking-wider mb-3">Connected Platforms</h3>
            <div className="space-y-3">
              {contact.platforms.map((p: any) => (
                <div key={p.platform} className="flex items-center gap-3">
                  <PlatformIcon platform={p.platform} size={28} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#F0F2FF]">{p.username}</p>
                    <p className="text-[10px] text-[#4B5068]">{p.followers.toLocaleString()} followers · joined {format(p.joined, 'MMM yyyy')}</p>
                  </div>
                  <a href="#" className="text-[#4B5068] hover:text-[#F0F2FF]"><ExternalLink className="w-3.5 h-3.5" /></a>
                </div>
              ))}
            </div>
          </Card>

          {/* Tags */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[#4B5068] uppercase tracking-wider">Tags</h3>
              <button onClick={() => setAddingTag(true)} className="text-[#4B5068] hover:text-blue-400 transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <span key={tag} className="group flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#111318] border border-[#2A2E42] text-[11px] text-[#8B90A7]">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#4B5068] hover:text-red-400">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              {addingTag && (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') setAddingTag(false); }}
                    placeholder="new tag..."
                    className="h-5 w-20 px-1.5 rounded text-[11px] bg-[#111318] border border-blue-500 text-[#F0F2FF] outline-none"
                  />
                  <button onClick={addTag} className="text-green-400"><Check className="w-3 h-3" /></button>
                  <button onClick={() => setAddingTag(false)} className="text-[#4B5068]"><X className="w-3 h-3" /></button>
                </div>
              )}
              {tags.length === 0 && !addingTag && (
                <p className="text-[11px] text-[#4B5068]">No tags yet</p>
              )}
            </div>
          </Card>

          {/* Messaging opt-in */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#F0F2FF]">Messaging opt-in</p>
                <p className="text-[10px] text-[#4B5068] mt-0.5">Allow automated messages via flows</p>
              </div>
              <Toggle checked={optedIn} onChange={handleOptInToggle} size="sm" />
            </div>
          </Card>

          {/* GDPR actions */}
          <Card>
            <h3 className="text-xs font-semibold text-[#4B5068] uppercase tracking-wider mb-3">Data & Privacy</h3>
            <div className="space-y-2">
              <Button variant="secondary" size="sm" className="w-full justify-start" onClick={() => setGdprModal('export')}>
                <Download className="w-3.5 h-3.5 text-[#4B5068]" /> Export contact data
              </Button>
              <Button variant="danger" size="sm" className="w-full justify-start" onClick={() => setGdprModal('delete')}>
                <Trash2 className="w-3.5 h-3.5" /> Erase contact data
              </Button>
            </div>
          </Card>
        </div>

        {/* Right panel — detail content */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <Link to="/inbox">
              <Button variant="primary">
                <MessageSquare className="w-4 h-4" /> Open Conversation
              </Button>
            </Link>

            {/* Trigger Flow dropdown */}
            <div className="relative" ref={flowDropdownRef}>
              <Button
                variant="secondary"
                onClick={() => { setShowFlowDropdown(p => !p); loadFlows(); }}
              >
                <Zap className="w-4 h-4" />
                Trigger Flow
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              </Button>
              {showFlowDropdown && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-[#1A1C24] border border-[#2A2E42] rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-[#2A2E42]">
                    <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">Active Flows</p>
                  </div>
                  {flowsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 text-[#4B5068] animate-spin" />
                    </div>
                  ) : flows.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-[#4B5068]">No active flows found</div>
                  ) : (
                    flows.map(flow => (
                      <button
                        key={flow.id}
                        onClick={() => triggerFlow(flow.id)}
                        disabled={triggeringFlow === flow.id}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-[#F0F2FF] hover:bg-[#222530] transition-colors"
                      >
                        {triggeringFlow === flow.id ? (
                          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin flex-shrink-0" />
                        ) : flowTriggered === flow.id ? (
                          <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        )}
                        <span className="truncate">{flow.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Add to Segment button (mobile-friendly duplicate) */}
            <Button
              variant="secondary"
              onClick={() => { setShowSegmentDropdown(p => !p); loadSegments(); }}
            >
              <Tag className="w-4 h-4" /> Add to Segment
            </Button>

            <div className="ml-auto">
              {isEditing ? (
                <Button variant="primary" size="sm" onClick={saveEdit} disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={startEdit}>
                  <Edit2 className="w-3.5 h-3.5" /> Edit Contact
                </Button>
              )}
            </div>
          </div>

          {/* Flow triggered toast */}
          {flowTriggered && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
              <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
              <p className="text-xs text-green-300 font-medium">Flow triggered successfully!</p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-[#111318] rounded-xl border border-[#1E2130] w-fit overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'conversations', label: 'Messages' },
              { id: 'flows', label: 'Flows' },
              { id: 'attribution', label: 'Attribution' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#1A1C24] text-[#F0F2FF] shadow-sm' : 'text-[#8B90A7] hover:text-[#F0F2FF]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <>
              {/* Activity chart */}
              <Card>
                <h3 className="text-xs font-semibold text-[#4B5068] uppercase tracking-wider mb-3">Activity (Last 30 Days)</h3>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={contact.timeline}>
                      <defs>
                        <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <RechartTooltip
                        contentStyle={{ background: '#1A1C24', border: '1px solid #2A2E42', borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: '#8B90A7' }}
                        itemStyle={{ color: '#F0F2FF' }}
                      />
                      <Area type="monotone" dataKey="messages" stroke="#3B82F6" fill="url(#msgGrad)" strokeWidth={1.5} dot={false} name="Messages" />
                      <Area type="monotone" dataKey="events" stroke="#22C55E" fill="none" strokeWidth={1} dot={false} strokeDasharray="3 3" name="Events" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Notes */}
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-[#4B5068] uppercase tracking-wider">Internal Notes</h3>
                  <button onClick={() => { if (editingNote) { handleSaveNote(); } else { setEditingNote(true); } }} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <Edit2 className="w-3 h-3" />
                    {editingNote ? 'Save' : 'Edit'}
                  </button>
                </div>
                {editingNote ? (
                  <textarea
                    autoFocus
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    onBlur={() => handleSaveNote()}
                    className="w-full h-20 p-2 rounded-lg bg-[#111318] border border-blue-500 text-xs text-[#F0F2FF] placeholder:text-[#4B5068] resize-none outline-none"
                  />
                ) : (
                  <p className="text-xs text-[#8B90A7] leading-relaxed">{note || <span className="text-[#4B5068]">No notes yet. Click Edit to add a note.</span>}</p>
                )}
              </Card>

              {/* Recent messages preview */}
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-[#4B5068] uppercase tracking-wider">Recent Messages</h3>
                  <Link to="/inbox" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
                </div>
                <div className="space-y-2">
                  {contact.recentMessages.map((msg: any, i: number) => (
                    <div key={i} className={`flex gap-2 ${msg.role === 'contact' ? '' : 'flex-row-reverse'}`}>
                      <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                        style={{
                          background: msg.role === 'contact' ? '#1A1C24' : msg.role === 'ai' ? 'linear-gradient(135deg, #3B82F6, #06B6D4)' : '#22C55E22',
                          color: msg.role === 'contact' ? '#8B90A7' : '#fff'
                        }}>
                        {msg.role === 'contact' ? contact.name.charAt(0) : msg.role === 'ai' ? 'A' : 'H'}
                      </div>
                      <div className={`max-w-[80%] px-3 py-1.5 rounded-xl text-xs ${msg.role === 'contact' ? 'bg-[#1A1C24] text-[#F0F2FF]' : 'bg-blue-500/10 border border-blue-500/20 text-[#F0F2FF]'}`}>
                        {msg.text}
                        <div className="text-[9px] text-[#4B5068] mt-0.5">{formatDistanceToNow(msg.time, { addSuffix: true })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {activeTab === 'flows' && (
            <Card>
              <h3 className="text-xs font-semibold text-[#4B5068] uppercase tracking-wider mb-3">Flow History</h3>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="border-b border-[#1E2130]">
                    {['Flow', 'Ran', 'Status', 'Converted'].map(h => (
                      <th key={h} className="pb-2 text-left text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contact.flows.map((flow: any, i: number) => (
                    <tr key={i} className="border-b border-[#1E2130] last:border-0 hover:bg-[#0A0B0F] transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span className="text-xs font-medium text-[#F0F2FF]">{flow.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-xs text-[#8B90A7]">{format(flow.ran, 'MMM d, yyyy')}</td>
                      <td className="py-3">
                        <Badge variant={flow.status === 'completed' ? 'success' : 'warning'}>{flow.status}</Badge>
                      </td>
                      <td className="py-3">
                        {flow.converted
                          ? <span className="flex items-center gap-1 text-xs text-green-400"><Check className="w-3 h-3" /> Yes</span>
                          : <span className="text-xs text-[#4B5068]">No</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </Card>
          )}

          {activeTab === 'attribution' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <p className="text-[10px] text-[#8B90A7] uppercase tracking-wider mb-1">Total Revenue</p>
                  <p className="text-xl font-bold text-green-400">${contact.revenue}</p>
                </Card>
                <Card>
                  <p className="text-[10px] text-[#8B90A7] uppercase tracking-wider mb-1">Purchases</p>
                  <p className="text-xl font-bold text-[#F0F2FF]">{contact.attributionEvents.filter((e: any) => e.type === 'PURCHASE').length}</p>
                </Card>
                <Card>
                  <p className="text-[10px] text-[#8B90A7] uppercase tracking-wider mb-1">Link Clicks</p>
                  <p className="text-xl font-bold text-[#F0F2FF]">{contact.attributionEvents.filter((e: any) => e.type === 'CLICK').length}</p>
                </Card>
              </div>

              <Card>
                <h3 className="text-xs font-semibold text-[#4B5068] uppercase tracking-wider mb-3">Attribution Events</h3>
                <div className="space-y-2">
                  {contact.attributionEvents.map((ev: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130]">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${ev.type === 'PURCHASE' ? 'bg-green-500/15' : 'bg-blue-500/15'}`}>
                        {ev.type === 'PURCHASE'
                          ? <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                          : <Activity className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#F0F2FF]">
                          {ev.type === 'PURCHASE' ? `Purchased ${ev.product}` : 'Link click'}
                        </p>
                        <p className="text-[11px] text-[#4B5068]">{ev.source} · {format(ev.date, 'MMM d, yyyy')}</p>
                      </div>
                      {ev.amount && (
                        <span className="text-sm font-bold text-green-400 flex-shrink-0">${ev.amount}</span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'conversations' && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-[#4B5068] uppercase tracking-wider">All Conversations ({contact.conversations})</h3>
                <Link to="/inbox">
                  <Button variant="primary" size="sm">
                    <MessageSquare className="w-3.5 h-3.5" /> Open in Inbox
                  </Button>
                </Link>
              </div>
              <div className="space-y-2">
                {Array.from({ length: Math.min(contact.conversations, 5) }, (_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130] hover:border-blue-500/20 transition-colors cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-[#F0F2FF]">
                          {['Story reply about hoodie', 'Price inquiry', 'Shipping question', 'Product feedback', 'New DM from flow'][i]}
                        </p>
                        {i === 0 && <Badge variant="danger">Priority Red</Badge>}
                      </div>
                      <p className="text-[11px] text-[#4B5068]">{formatDistanceToNow(subDays(new Date(), i * 3), { addSuffix: true })}</p>
                    </div>
                    <PlatformIcon platform={contact.platforms[i % contact.platforms.length]?.platform} size={16} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* GDPR Modals */}
      <Modal
        open={gdprModal === 'export'}
        onClose={() => setGdprModal(null)}
        title="Export Contact Data"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGdprModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleGdprExport} disabled={gdprLoading}>
              <Download className="w-3.5 h-3.5" /> Generate Export
            </Button>
          </>
        }
      >
        <p className="text-xs text-[#8B90A7] mb-3">Export all data held for <strong className="text-[#F0F2FF]">{contact.name}</strong> as a JSON file, compliant with GDPR Art. 15.</p>
        <div className="space-y-1.5">
          {['Profile & platform IDs', 'Conversation history', 'Tags, segments, loyalty score', 'Attribution events', 'Consent log entries'].map(item => (
            <div key={item} className="flex items-center gap-2 text-xs text-[#8B90A7]">
              <Check className="w-3.5 h-3.5 text-green-400" />{item}
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={gdprModal === 'delete'}
        onClose={() => setGdprModal(null)}
        title="Erase Contact Data"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGdprModal(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleGdprErase} disabled={gdprLoading}>
              <Trash2 className="w-3.5 h-3.5" /> Confirm Erasure
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/20 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">This will permanently anonymize all personal data for <strong>{contact.name}</strong>. This cannot be undone.</p>
        </div>
        <p className="text-xs text-[#8B90A7]">Aggregated analytics data (counts, conversions) will be preserved with PII removed.</p>
      </Modal>
    </div>
  );
}
