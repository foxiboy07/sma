import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Filter, Send, Smile, Image, Link2, FileText,
  MoreVertical, ChevronRight, Brain, User, X,
  AlertTriangle, ExternalLink, Tag,
  BarChart3, Trash2, Loader2, ShoppingBag, CheckCheck, Check,
  MessageSquare, ChevronDown, UserCheck
} from 'lucide-react';
import { Badge, Toggle, LoyaltyBadge, PlatformIcon } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { aiApi, gdprApi, inboxApi } from '../lib/api';

interface ConvRow {
  id: string;
  platform: string;
  status: string;
  last_message_at: string;
  sentiment_score: number;
  priority_red: boolean;
  unread_count: number;
  unified_contacts: {
    display_name: string;
    loyalty_tier: string;
  };
  unified_contact_id: string;
  brand_id: string;
  tenant_id: string;
}

interface MessageRow {
  id: string;
  direction: string;
  content: string | null;
  message_type: string;
  is_ai_generated: boolean;
  delivery_status: string;
  created_at: string;
}

interface ContactData {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  loyalty_score: number;
  loyalty_tier: string;
  tags: string[];
  sentiment_score: number;
  notes: string | null;
  platforms: { platform: string; username: string | null }[];
  revenue: number;
  purchases: number;
  flow: string | null;
  currentNode: string | null;
}

interface TeamMember {
  id: string;
  display_name: string;
  email: string;
}

type StatusFilter = 'all' | 'BOT' | 'HUMAN' | 'Priority Red' | 'CLOSED';

const QUICK_REPLIES = [
  { label: 'Thanks for reaching out!', text: 'Thanks for reaching out! How can I help you today?' },
  { label: 'Order status', text: 'I can help you check your order status. Could you please provide your order number?' },
  { label: 'Shipping info', text: 'We typically ship within 1-3 business days. You\'ll receive a tracking number via email once your order ships.' },
  { label: 'Return policy', text: 'We offer hassle-free returns within 30 days of purchase. Just initiate the return from your account page.' },
  { label: 'Discount code', text: 'I\'d be happy to help with that! Let me check what offers are currently available for you.' },
  { label: 'Talk to human', text: 'I\'ll connect you with one of our team members right away. Please hold on for a moment.' },
];

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function formatMessageTime(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function InboxPage() {
  const { tenant, brand } = useAuth();
  const tenantId = tenant?.id;
  const brandId = brand?.id;

  const [conversations, setConversations] = useState<ConvRow[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [activeConv, setActiveConv] = useState<ConvRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [humanMode, setHumanMode] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [showContactPanel, setShowContactPanel] = useState(true);
  const [showAISuggest, setShowAISuggest] = useState(false);
  const [aiSuggest, setAiSuggest] = useState('');
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [typing, setTyping] = useState(false);

  // Messages state
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Message search state
  const [messageSearch, setMessageSearch] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);

  // Contact panel state
  const [contact, setContact] = useState<ContactData | null>(null);
  const [contactLoading, setContactLoading] = useState(false);

  // GDPR state
  const [gdprExporting, setGdprExporting] = useState(false);
  const [gdprDeleting, setGdprDeleting] = useState(false);

  // Sending state
  const [sending, setSending] = useState(false);

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Quick replies state
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const quickRepliesRef = useRef<HTMLDivElement>(null);

  // Assign to agent state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assignedAgent, setAssignedAgent] = useState<string | null>(null);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const assignDropdownRef = useRef<HTMLDivElement>(null);

  // Mark as read loading
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  // Product card modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [products, setProducts] = useState<{ id: string; title: string; price: number; image_url: string | null }[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [sendingProduct, setSendingProduct] = useState(false);

  const COMMON_EMOJIS = [
    '😀','😂','😍','🥰','😎','🤩','😊','🙏','❤️','🔥',
    '👍','👏','🎉','✨','💯','🚀','💪','🌟','😜','🤔',
    '😅','🥳','😭','😤','🤗','💀','👀','😱','🤝','💬',
    '🛍️','💸','🎁','🏆','⚡','🌈','🍕','☕','🎵','🎶',
    '💡','✅','❌','⭐','🔑','📦','📱','💎','🎯','🙌',
  ];

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!showEmojiPicker) return;
    function handleClick(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmojiPicker]);

  // Close quick replies when clicking outside
  useEffect(() => {
    if (!showQuickReplies) return;
    function handleClick(e: MouseEvent) {
      if (quickRepliesRef.current && !quickRepliesRef.current.contains(e.target as Node)) {
        setShowQuickReplies(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showQuickReplies]);

  // Close assign dropdown when clicking outside
  useEffect(() => {
    if (!showAssignDropdown) return;
    function handleClick(e: MouseEvent) {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(e.target as Node)) {
        setShowAssignDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAssignDropdown]);

  // Fetch team members (agents) when assign dropdown opens
  async function fetchTeamMembers() {
    if (!tenantId || teamMembers.length > 0) return;
    setTeamMembersLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, display_name, email')
        .eq('tenant_id', tenantId)
        .eq('role', 'agent');
      if (!error) setTeamMembers((data || []) as TeamMember[]);
    } catch {
      // ignore
    } finally {
      setTeamMembersLoading(false);
    }
  }

  async function assignToAgent(agentId: string | null) {
    if (!activeConv) return;
    try {
      await inboxApi.updateConversation(activeConv.id, { assignedAgentId: agentId });
      setAssignedAgent(agentId);
    } catch (err) {
      console.error('Failed to assign agent:', err);
    }
    setShowAssignDropdown(false);
  }

  async function markAsRead(convId: string) {
    setMarkingRead(convId);
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', convId);
      if (!error) {
        setConversations(prev =>
          prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c)
        );
        if (activeConv?.id === convId) {
          setActiveConv(prev => prev ? { ...prev, unread_count: 0 } : prev);
        }
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    } finally {
      setMarkingRead(null);
    }
  }

  async function fetchProducts() {
    if (!tenantId) return;
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ecommerce_products')
        .select('id, title, price, image_url')
        .eq('tenant_id', tenantId)
        .limit(50);
      if (!error) setProducts((data || []) as { id: string; title: string; price: number; image_url: string | null }[]);
    } catch {
      // ignore
    } finally {
      setProductsLoading(false);
    }
  }

  async function sendProductCard(product: { id: string; title: string; price: number; image_url: string | null }) {
    if (!activeConv || !tenantId || !brandId || sendingProduct) return;
    setSendingProduct(true);
    try {
      const productContent = JSON.stringify({ product_id: product.id, title: product.title, price: product.price, image_url: product.image_url });
      await inboxApi.sendMessage(activeConv.id, productContent, 'PRODUCT_CARD');
      setShowProductModal(false);
    } catch (err) {
      console.error('Failed to send product card:', err);
    } finally {
      setSendingProduct(false);
    }
  }

  // ---- Fetch conversations ----
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;

    async function fetchConversations() {
      setConversationsLoading(true);
      try {
        const data = await inboxApi.conversations(tenantId, { limit: 100 });
        if (!cancelled) {
          const rows = (data || []) as unknown as ConvRow[];
          setConversations(rows);
          // Auto-select first conversation if none active
          if (rows.length > 0 && !activeConv) {
            setActiveConv(rows[0]);
          }
          setConversationsLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch conversations:', error);
          setConversationsLoading(false);
        }
      }
    }

    fetchConversations();

    // Subscribe to real-time inserts/updates on conversations
    const channel = supabase
      .channel('inbox-conversations')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `tenant_id=eq.${tenantId}` },
        () => { fetchConversations(); }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // ---- Fetch messages when activeConv changes ----
  useEffect(() => {
    if (!activeConv) {
      setMessages([]);
      return;
    }
    let cancelled = false;

    async function fetchMessages() {
      setMessagesLoading(true);
      try {
        const data = await inboxApi.messages(activeConv!.id, undefined, 100);
        if (!cancelled) {
          setMessages((data || []) as MessageRow[]);
          setMessagesLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch messages:', error);
          setMessagesLoading(false);
        }
      }
    }

    fetchMessages();

    // Subscribe to new messages in this conversation
    const channel = supabase
      .channel(`inbox-messages-${activeConv.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConv.id}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as MessageRow]);
        }
      )
      .subscribe();

    // Reset message search when changing conversation
    setMessageSearch('');
    setShowMessageSearch(false);
    setAssignedAgent(null);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeConv]);

  // ---- Fetch contact data when activeConv changes ----
  useEffect(() => {
    if (!activeConv) {
      setContact(null);
      return;
    }
    let cancelled = false;

    async function fetchContact() {
      setContactLoading(true);
      const contactId = activeConv!.unified_contact_id;

      try {
        // Fetch the contact
        const { data: contactData, error: contactError } = await supabase
          .from('unified_contacts')
          .select('id, display_name, email, phone, loyalty_score, loyalty_tier, tags, sentiment_score, notes')
          .eq('id', contactId)
          .maybeSingle();

        if (contactError) throw contactError;
        if (!contactData || cancelled) {
          if (!cancelled) setContactLoading(false);
          return;
        }

        // Fetch platform profiles
        const { data: profiles } = await supabase
          .from('platform_profiles')
          .select('platform, platform_username')
          .eq('unified_contact_id', contactId);

        // Fetch attribution events (revenue & purchase count)
        const { data: attribution } = await supabase
          .from('attribution_events')
          .select('event_type, revenue_attributed')
          .eq('unified_contact_id', contactId);

        const totalRevenue = (attribution || []).reduce((sum, e) => sum + Number(e.revenue_attributed || 0), 0);
        const purchaseCount = (attribution || []).filter(e => e.event_type === 'PURCHASE_ATTRIBUTED').length;

        // Fetch active flow session
        const { data: flowSessions } = await supabase
          .from('flow_sessions')
          .select('flow_id, current_node_id, is_active')
          .eq('unified_contact_id', contactId)
          .eq('is_active', true)
          .limit(1);

        let flowName: string | null = null;
        let currentNodeLabel: string | null = null;

        if (flowSessions && flowSessions.length > 0) {
          const session = flowSessions[0];
          // Fetch flow name
          const { data: flowData } = await supabase
            .from('flows')
            .select('name')
            .eq('id', session.flow_id)
            .maybeSingle();
          flowName = flowData?.name ?? null;

          // Fetch current node label
          if (session.current_node_id) {
            const { data: nodeData } = await supabase
              .from('flow_nodes')
              .select('label')
              .eq('id', session.current_node_id)
              .maybeSingle();
            currentNodeLabel = nodeData?.label ?? null;
          }
        }

        if (!cancelled) {
          setContact({
            id: contactData.id,
            display_name: contactData.display_name || 'Unknown',
            email: contactData.email,
            phone: contactData.phone,
            loyalty_score: contactData.loyalty_score ?? 0,
            loyalty_tier: contactData.loyalty_tier ?? 'NEWBIE',
            tags: contactData.tags || [],
            sentiment_score: Number(contactData.sentiment_score ?? 0),
            notes: contactData.notes,
            platforms: (profiles || []).map(p => ({
              platform: p.platform,
              username: p.platform_username ?? null,
            })),
            revenue: totalRevenue,
            purchases: purchaseCount,
            flow: flowName,
            currentNode: currentNodeLabel,
          });
        }
      } catch (err) {
        console.error('Failed to fetch contact:', err);
      }

      if (!cancelled) setContactLoading(false);
    }

    fetchContact();

    return () => { cancelled = true; };
  }, [activeConv]);

  // ---- Sync humanMode with active conversation status ----
  useEffect(() => {
    if (activeConv) {
      setHumanMode(activeConv.status === 'HUMAN');
    }
  }, [activeConv]);

  // ---- Filtered conversations ----
  const filtered = conversations.filter(c => {
    if (statusFilter === 'Priority Red') return c.priority_red;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (platformFilter.length > 0 && !platformFilter.includes(c.platform)) return false;
    return true;
  });

  // ---- Filtered messages by search ----
  const displayedMessages = messageSearch.trim()
    ? messages.filter(m => m.content?.toLowerCase().includes(messageSearch.toLowerCase()))
    : messages;

  // ---- Send message ----
  async function sendMessage() {
    if (!messageInput.trim() || !activeConv || !tenantId || !brandId) return;
    const content = messageInput.trim();
    setMessageInput('');
    setSending(true);

    try {
      await inboxApi.sendMessage(activeConv.id, content, 'TEXT');
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessageInput(content); // Restore on failure
    } finally {
      setSending(false);
    }
  }

  // ---- AI Suggest ----
  async function getSuggest() {
    if (!activeConv || !tenantId || !brandId) return;
    setShowAISuggest(true);
    setAiSuggestLoading(true);
    setAiSuggest('');
    setTyping(true); // Show typing indicator while AI generates

    try {
      // Get the last inbound message for context
      const lastInbound = [...messages].reverse().find(m => m.direction === 'INBOUND');
      const messageText = lastInbound?.content || '';

      const result = await aiApi.generate(
        messageText,
        activeConv.id,
        activeConv.unified_contact_id,
        tenantId,
        brandId,
        undefined,
        activeConv.unified_contacts?.loyalty_tier
      );

      setAiSuggest(result?.response_text || result?.text || result?.message || 'No suggestion available.');
    } catch (err) {
      console.error('AI Suggest failed:', err);
      setAiSuggest('Failed to generate suggestion. Please try again.');
    } finally {
      setAiSuggestLoading(false);
      setTyping(false); // Hide typing indicator
    }
  }

  // ---- GDPR Export ----
  async function handleGdprExport() {
    if (!contact || !tenantId || !brandId) return;
    setGdprExporting(true);
    try {
      const result = await gdprApi.exportContact(contact.id, tenantId, brandId);
      // Download the exported data as JSON
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contact-export-${contact.display_name.replace(/\s+/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('GDPR export failed:', err);
    } finally {
      setGdprExporting(false);
    }
  }

  // ---- GDPR Delete ----
  async function handleGdprDelete() {
    if (!contact || !tenantId || !brandId) return;
    if (!window.confirm(`This will permanently delete all data for ${contact.display_name}. This action cannot be undone.`)) return;
    setGdprDeleting(true);
    try {
      await gdprApi.eraseContact(contact.id, tenantId, brandId);
      setContact(null);
      setActiveConv(null);
    } catch (err) {
      console.error('GDPR delete failed:', err);
    } finally {
      setGdprDeleting(false);
    }
  }

  // ---- Human mode toggle ----
  async function handleHumanModeToggle(checked: boolean) {
    setHumanMode(checked);
    if (!activeConv) return;

    const newStatus = checked ? 'HUMAN' : 'BOT';
    try {
      await inboxApi.updateConversation(activeConv.id, { status: newStatus });

      // Update local state
      setActiveConv(prev => prev ? { ...prev, status: newStatus } : prev);
      setConversations(prev =>
        prev.map(c => c.id === activeConv.id ? { ...c, status: newStatus } : c)
      );
    } catch (err) {
      console.error('Failed to update conversation status:', err);
      setHumanMode(!checked); // Revert on failure
    }
  }

  // Derive display name for the active conversation
  const activeConvName = activeConv?.unified_contacts?.display_name || 'Unknown';
  const activeConvTier = activeConv?.unified_contacts?.loyalty_tier || 'NEWBIE';

  const assignedMember = teamMembers.find(m => m.id === assignedAgent);

  return (
    <div className="flex h-full bg-[#0A0B0F]">
      {/* Left: Conversation List — hidden on mobile when a conv is active */}
      <div className={`w-full md:w-72 flex flex-col border-r border-[#1E2130] bg-[#111318] flex-shrink-0 ${activeConv ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-3 border-b border-[#1E2130]">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-base md:text-sm font-semibold text-[#F0F2FF]">Inbox</h1>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 md:w-7 md:h-7 flex items-center justify-center rounded-lg text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#1A1C24] active:bg-[#222530]"><Filter className="w-4 h-4 md:w-3.5 md:h-3.5" /></button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 md:w-3.5 md:h-3.5 text-[#4B5068]" />
            <input placeholder="Search conversations..." className="w-full h-9 md:h-8 pl-9 md:pl-8 pr-3 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-sm md:text-xs text-[#F0F2FF] placeholder:text-[#4B5068] focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1 p-2 border-b border-[#1E2130] overflow-x-auto">
          {(['all', 'BOT', 'HUMAN', 'Priority Red', 'CLOSED'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${statusFilter === s ? 'bg-[#1A1C24] text-[#F0F2FF]' : 'text-[#8B90A7] hover:text-[#F0F2FF]'} ${s === 'Priority Red' ? 'text-red-400' : ''}`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        {/* Platform filter */}
        <div className="flex gap-1 px-2 py-1.5 border-b border-[#1E2130] overflow-x-auto">
          {['INSTAGRAM', 'FACEBOOK', 'TIKTOK'].map(p => (
            <button
              key={p}
              onClick={() => setPlatformFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
              className={`flex items-center gap-1 px-2 py-1.5 md:px-1.5 md:py-1 rounded text-xs md:text-[10px] transition-colors active:scale-95 ${platformFilter.includes(p) ? 'bg-blue-500/20 text-blue-400' : 'text-[#4B5068] hover:text-[#F0F2FF]'}`}
            >
              <PlatformIcon platform={p} size={14} className="md:!w-3 md:!h-3" />
            </button>
          ))}
        </div>

        {/* Priority Red sticky section */}
        {conversations.filter(c => c.priority_red).length > 0 && statusFilter === 'all' && (
          <div className="border-b border-red-500/20 bg-red-500/5 p-2">
            <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider mb-1.5">Priority Red ({conversations.filter(c => c.priority_red).length})</p>
            {conversations.filter(c => c.priority_red).map(c => (
              <ConvItem
                key={c.id}
                conv={c}
                active={activeConv?.id === c.id}
                onClick={() => setActiveConv(c)}
                onMarkRead={markAsRead}
                markingRead={markingRead === c.id}
              />
            ))}
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversationsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-[#4B5068] animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#4B5068]">No conversations</div>
          ) : (
            filtered.filter(c => statusFilter === 'all' ? !c.priority_red : true).map(c => (
              <ConvItem
                key={c.id}
                conv={c}
                active={activeConv?.id === c.id}
                onClick={() => setActiveConv(c)}
                onMarkRead={markAsRead}
                markingRead={markingRead === c.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Center: Thread — on mobile, full screen when conv is active */}
      <div className={`flex-1 flex flex-col min-w-0 ${!activeConv ? 'hidden md:flex' : 'flex'}`}>
        {activeConv ? (
          <>
            {/* Thread Header */}
            <div className="h-14 md:h-12 flex items-center justify-between px-3 md:px-4 border-b border-[#1E2130] bg-[#111318] flex-shrink-0 safe-area-inset-top">
              <div className="flex items-center gap-2 md:gap-3">
                {/* Back button on mobile */}
                <button
                  onClick={() => setActiveConv(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#1A1C24] md:hidden"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={activeConv.platform} size={18} className="md:!w-4 md:!h-4" />
                  <span className="text-base md:text-sm font-semibold text-[#F0F2FF]">{activeConvName}</span>
                  <Badge variant={activeConv.status === 'BOT' ? 'info' : activeConv.status === 'HUMAN' ? 'success' : 'default'} className="text-[10px] hidden sm:inline-flex">
                    {activeConv.status}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2">
                {/* Message search toggle */}
                <button
                  onClick={() => setShowMessageSearch(p => !p)}
                  className={`w-8 h-8 md:w-7 md:h-7 flex items-center justify-center rounded-lg transition-colors ${showMessageSearch ? 'text-blue-400 bg-blue-500/10' : 'text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#1A1C24]'}`}
                  title="Search messages"
                >
                  <Search className="w-4 h-4 md:w-3.5 md:h-3.5" />
                </button>

                {/* Assign to Agent dropdown */}
                <div className="relative" ref={assignDropdownRef}>
                  <button
                    onClick={() => { setShowAssignDropdown(p => !p); fetchTeamMembers(); }}
                    className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${assignedAgent ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'text-[#8B90A7] hover:text-[#F0F2FF] hover:bg-[#1A1C24] border border-[#2A2E42]'}`}
                    title="Assign to agent"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">{assignedMember ? assignedMember.display_name : 'Assign'}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showAssignDropdown && (
                    <div className="absolute top-full right-0 mt-1 w-52 bg-[#1A1C24] border border-[#2A2E42] rounded-xl shadow-2xl z-50 overflow-hidden">
                      <div className="px-3 py-2 border-b border-[#2A2E42]">
                        <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">Assign to Agent</p>
                      </div>
                      {teamMembersLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-4 h-4 text-[#4B5068] animate-spin" />
                        </div>
                      ) : teamMembers.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-[#4B5068]">No agents found</div>
                      ) : (
                        <>
                          {assignedAgent && (
                            <button
                              onClick={() => assignToAgent(null)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" /> Unassign
                            </button>
                          )}
                          {teamMembers.map(member => (
                            <button
                              key={member.id}
                              onClick={() => assignToAgent(member.id)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-[#222530] transition-colors ${assignedAgent === member.id ? 'text-green-400' : 'text-[#F0F2FF]'}`}
                            >
                              <div className="w-6 h-6 rounded-full bg-[#222530] flex items-center justify-center text-[10px] font-bold text-[#8B90A7] flex-shrink-0">
                                {member.display_name.charAt(0)}
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <p className="truncate font-medium">{member.display_name}</p>
                                <p className="text-[10px] text-[#4B5068] truncate">{member.email}</p>
                              </div>
                              {assignedAgent === member.id && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="hidden md:flex items-center gap-2">
                  <span className="text-xs text-[#8B90A7]">{humanMode ? 'Human mode — bot paused' : 'Bot active'}</span>
                  <Toggle checked={humanMode} onChange={handleHumanModeToggle} size="sm" />
                </div>
                <button onClick={() => setShowContactPanel(p => !p)} className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-lg text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#1A1C24] active:bg-[#222530]">
                  <User className="w-5 h-5 md:w-3.5 md:h-3.5" />
                </button>
                <button className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-lg text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#1A1C24] active:bg-[#222530]">
                  <MoreVertical className="w-5 h-5 md:w-3.5 md:h-3.5" />
                </button>
              </div>
            </div>

            {/* Message search bar */}
            {showMessageSearch && (
              <div className="px-3 md:px-4 py-2 border-b border-[#1E2130] bg-[#111318]">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4B5068]" />
                  <input
                    autoFocus
                    value={messageSearch}
                    onChange={e => setMessageSearch(e.target.value)}
                    placeholder="Search messages in this conversation..."
                    className="w-full h-8 pl-8 pr-8 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] placeholder:text-[#4B5068] focus:outline-none focus:border-blue-500"
                  />
                  {messageSearch && (
                    <button onClick={() => setMessageSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <X className="w-3.5 h-3.5 text-[#4B5068] hover:text-[#F0F2FF]" />
                    </button>
                  )}
                </div>
                {messageSearch && (
                  <p className="text-[10px] text-[#4B5068] mt-1">{displayedMessages.length} result{displayedMessages.length !== 1 ? 's' : ''}</p>
                )}
              </div>
            )}

            {/* Priority Red Banner */}
            {activeConv.priority_red && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-red-500/10 border-b border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-300 font-medium">Priority Red — This contact is frustrated and needs immediate human attention</p>
                <button className="ml-auto text-xs text-red-400 hover:text-red-300 font-medium">Take over</button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
              <div className="flex justify-center mb-2">
                <span className="text-[10px] text-[#4B5068] bg-[#111318] px-3 py-1 rounded-full border border-[#1E2130]">Today</span>
              </div>

              {messagesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-[#4B5068] animate-spin" />
                </div>
              ) : displayedMessages.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#4B5068]">
                  {messageSearch ? 'No messages match your search' : 'No messages yet'}
                </div>
              ) : (
                displayedMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'} gap-2`}>
                    {msg.direction === 'INBOUND' && (
                      <div className="w-7 h-7 rounded-full bg-[#222530] flex items-center justify-center text-xs font-bold text-[#8B90A7] flex-shrink-0">
                        {activeConvName.charAt(0)}
                      </div>
                    )}
                    <div className={`max-w-[60%] ${msg.direction === 'OUTBOUND' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {msg.message_type === 'PRODUCT_CARD' ? (
                        <div className="rounded-2xl rounded-tr-sm bg-[#1A1C24] border border-[#2A2E42] p-3 w-56 max-w-[85vw]">
                          <img src="https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=200" className="w-full h-32 rounded-lg object-cover mb-3" alt="product" />
                          <p className="text-xs font-semibold text-[#F0F2FF]">Blue Hoodie</p>
                          <p className="text-sm font-bold text-green-400 mt-0.5">$48.00</p>
                          <p className="text-[10px] text-green-400 mt-0.5">In Stock</p>
                          <button className="w-full mt-2 py-1.5 rounded-lg bg-blue-500 text-xs text-white font-medium active:bg-blue-600">Buy Now</button>
                        </div>
                      ) : (
                        <div className={`px-3 py-2 rounded-2xl text-sm ${msg.direction === 'OUTBOUND' ? 'bg-blue-500/20 border border-blue-500/30 rounded-tr-sm' : 'bg-[#1A1C24] border border-[#2A2E42] rounded-tl-sm'} text-[#F0F2FF] max-w-[85vw] md:max-w-[60%]`}>
                          {/* Highlight search match */}
                          {messageSearch && msg.content ? (
                            <HighlightedText text={msg.content} query={messageSearch} />
                          ) : msg.content}
                        </div>
                      )}
                      <div className={`flex items-center gap-1.5 ${msg.direction === 'OUTBOUND' ? 'flex-row-reverse' : ''}`}>
                        <span className="text-[10px] text-[#4B5068]">{formatMessageTime(msg.created_at)}</span>
                        {msg.is_ai_generated && <span className="text-[10px] px-1 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/20">AI</span>}
                        {/* Read receipt indicators for outbound messages */}
                        {msg.direction === 'OUTBOUND' && (
                          <span className={`flex items-center ${msg.delivery_status === 'DELIVERED' ? 'text-blue-400' : msg.delivery_status === 'SENT' ? 'text-[#8B90A7]' : 'text-[#4B5068]'}`} title={msg.delivery_status}>
                            {msg.delivery_status === 'DELIVERED' ? (
                              <CheckCheck className="w-3 h-3" />
                            ) : msg.delivery_status === 'SENT' ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Check className="w-3 h-3 opacity-40" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Typing indicator — shown while AI is generating */}
              {(typing || aiSuggestLoading) && (
                <div className="flex justify-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#222530] flex items-center justify-center text-xs font-bold text-[#8B90A7] flex-shrink-0">
                    <Brain className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="px-3 py-2.5 rounded-2xl rounded-tl-sm bg-[#1A1C24] border border-[#2A2E42] flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>

            {/* AI Suggest */}
            {showAISuggest && (
              <div className="mx-3 md:mx-4 mb-2 p-3 rounded-xl bg-[#1A1C24] border border-blue-500/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-blue-400 flex items-center gap-1"><Brain className="w-3.5 h-3.5" /> AI Suggestion</p>
                  <button onClick={() => setShowAISuggest(false)} className="active:bg-[#222530] p-1 rounded"><X className="w-3.5 h-3.5 text-[#4B5068]" /></button>
                </div>
                {aiSuggestLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    <span className="text-xs text-[#8B90A7]">Generating suggestion...</span>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-[#F0F2FF] mb-2">{aiSuggest}</p>
                    <div className="flex gap-2">
                      <button onClick={() => { setMessageInput(aiSuggest); setShowAISuggest(false); }} className="text-xs text-blue-400 hover:text-blue-300 font-medium">Use</button>
                      <button className="text-xs text-[#8B90A7] hover:text-[#F0F2FF]">Edit</button>
                      <button onClick={getSuggest} className="text-xs text-[#8B90A7] hover:text-[#F0F2FF]">Regenerate</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Input Area */}
            <div className="border-t border-[#1E2130] bg-[#111318] p-3 safe-area-inset-bottom">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {/* Emoji Picker */}
                <div className="relative" ref={emojiPickerRef}>
                  <button
                    onClick={() => setShowEmojiPicker(p => !p)}
                    className={`w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#1A1C24] active:bg-[#222530] ${showEmojiPicker ? 'text-[#F0F2FF] bg-[#1A1C24]' : ''}`}
                  >
                    <Smile className="w-4 h-4 md:w-3.5 md:h-3.5" />
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 mb-2 p-1.5 rounded-xl bg-[#1A1C24] border border-[#2A2E42] shadow-2xl z-50 w-48 md:w-44">
                      <div className="grid grid-cols-8 gap-0.5">
                        {COMMON_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => { setMessageInput(prev => prev + emoji); setShowEmojiPicker(false); }}
                            className="w-5 h-5 flex items-center justify-center text-sm md:text-xs hover:bg-[#222530] rounded transition-colors"
                            title={emoji}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button className="w-7 h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#1A1C24]"><Image className="w-3.5 h-3.5" /></button>
                <button className="w-7 h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#1A1C24]"><Link2 className="w-3.5 h-3.5" /></button>
                <button className="w-7 h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#1A1C24]"><FileText className="w-3.5 h-3.5" /></button>
                {/* Product Card Button */}
                <button
                  onClick={() => { setShowProductModal(true); fetchProducts(); }}
                  className="w-7 h-7 flex items-center justify-center rounded text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#1A1C24]"
                  title="Send product card"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                </button>

                {/* Quick Reply Templates */}
                <div className="relative" ref={quickRepliesRef}>
                  <button
                    onClick={() => setShowQuickReplies(p => !p)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${showQuickReplies ? 'text-blue-400 bg-blue-500/10' : 'text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#1A1C24]'}`}
                    title="Quick replies"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Quick</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showQuickReplies && (
                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#1A1C24] border border-[#2A2E42] rounded-xl shadow-2xl z-50 overflow-hidden">
                      <div className="px-3 py-2 border-b border-[#2A2E42]">
                        <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider">Quick Replies</p>
                      </div>
                      {QUICK_REPLIES.map((qr, i) => (
                        <button
                          key={i}
                          onClick={() => { setMessageInput(qr.text); setShowQuickReplies(false); }}
                          className="w-full flex flex-col items-start px-3 py-2.5 hover:bg-[#222530] transition-colors border-b border-[#1E2130] last:border-0"
                        >
                          <span className="text-xs font-medium text-[#F0F2FF]">{qr.label}</span>
                          <span className="text-[10px] text-[#4B5068] truncate w-full mt-0.5">{qr.text}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={getSuggest} disabled={aiSuggestLoading} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-blue-400 hover:bg-blue-500/10 font-medium disabled:opacity-50">
                  <Brain className="w-3.5 h-3.5" /> AI
                </button>
                <span className="ml-auto text-[10px] text-[#4B5068] hidden sm:inline">via {activeConv.platform.charAt(0) + activeConv.platform.slice(1).toLowerCase()}</span>
              </div>
              <div className="flex gap-2">
                <textarea
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendMessage(); }}
                  placeholder={`Type a message... (\u2318\u21B5 to send)`}
                  rows={2}
                  className="flex-1 rounded-xl bg-[#1A1C24] border border-[#2A2E42] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] px-3 py-2 focus:outline-none focus:border-blue-500 resize-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!messageInput.trim() || sending}
                  className="w-9 h-9 self-end flex items-center justify-center rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="h-0.5 flex-1 bg-[#1E2130] rounded-full mr-3">
                  <div className="h-full bg-[#2A2E42] rounded-full" style={{ width: `${(messageInput.length / 1000) * 100}%` }} />
                </div>
                <span className="text-[10px] text-[#4B5068]">{messageInput.length}/1000</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-[#4B5068]">
            Select a conversation to get started
          </div>
        )}
      </div>

      {/* Product Card Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowProductModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-[#1A1C24] border border-[#2A2E42] rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2130]">
              <h2 className="text-base font-semibold text-[#F0F2FF] flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Product Catalog</h2>
              <button onClick={() => setShowProductModal(false)} className="p-1 rounded-lg text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#222530] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4">
              {productsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-[#4B5068] animate-spin" />
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-10 text-sm text-[#4B5068]">No products found</div>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                  {products.map(product => (
                    <button
                      key={product.id}
                      onClick={() => sendProductCard(product)}
                      disabled={sendingProduct}
                      className="flex flex-col rounded-xl border border-[#2A2E42] bg-[#111318] hover:border-blue-500/40 hover:bg-[#1A1C24] transition-colors overflow-hidden text-left disabled:opacity-50"
                    >
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.title} className="w-full h-28 object-cover" />
                      ) : (
                        <div className="w-full h-28 bg-[#222530] flex items-center justify-center">
                          <ShoppingBag className="w-8 h-8 text-[#4B5068]" />
                        </div>
                      )}
                      <div className="p-2.5">
                        <p className="text-xs font-medium text-[#F0F2FF] truncate">{product.title}</p>
                        <p className="text-sm font-bold text-green-400 mt-0.5">${Number(product.price).toFixed(2)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Right: Contact Card */}
      {showContactPanel && (
        <div className="hidden md:block w-72 flex-shrink-0 border-l border-[#1E2130] bg-[#111318] overflow-y-auto">
          {contactLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-[#4B5068] animate-spin" />
            </div>
          ) : contact ? (
            <>
              <div className="p-4 border-b border-[#1E2130]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-[#8B90A7] uppercase tracking-wider">Contact Info</p>
                  <button onClick={() => setShowContactPanel(false)}><ChevronRight className="w-4 h-4 text-[#4B5068]" /></button>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-xl font-bold text-white mb-2">
                    {contact.display_name.charAt(0)}
                  </div>
                  <p className="text-sm font-semibold text-[#F0F2FF]">{contact.display_name}</p>
                  <LoyaltyBadge tier={contact.loyalty_tier} />
                  <div className="mt-2 w-full">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#4B5068]">Loyalty score</span>
                      <span className="text-[#F0F2FF] font-medium">{contact.loyalty_score}/100</span>
                    </div>
                    <div className="h-1.5 bg-[#222530] rounded-full">
                      <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${contact.loyalty_score}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Platforms */}
              <div className="p-4 border-b border-[#1E2130]">
                <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider mb-2">Platforms</p>
                {contact.platforms.length === 0 ? (
                  <p className="text-xs text-[#4B5068]">No linked platforms</p>
                ) : (
                  contact.platforms.map(p => (
                    <div key={p.platform} className="flex items-center gap-2 py-1.5">
                      <PlatformIcon platform={p.platform} size={16} />
                      <span className="text-xs text-[#F0F2FF]">{p.username || 'Connected'}</span>
                      <button className="ml-auto"><ExternalLink className="w-3 h-3 text-[#4B5068]" /></button>
                    </div>
                  ))
                )}
              </div>

              {/* Tags */}
              <div className="p-4 border-b border-[#1E2130]">
                <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider mb-2">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map(t => (
                    <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#8B90A7]">
                      <Tag className="w-2.5 h-2.5" />{t}
                    </span>
                  ))}
                  <button className="px-2 py-0.5 rounded-full border border-dashed border-[#2A2E42] text-xs text-[#4B5068] hover:text-[#F0F2FF]">+</button>
                </div>
              </div>

              {/* Sentiment */}
              <div className="p-4 border-b border-[#1E2130]">
                <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider mb-2">Sentiment</p>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${contact.sentiment_score > 0.3 ? 'bg-green-400' : contact.sentiment_score > -0.3 ? 'bg-amber-400' : 'bg-red-400'}`} />
                  <span className={`text-xs font-medium ${contact.sentiment_score > 0.3 ? 'text-green-400' : contact.sentiment_score > -0.3 ? 'text-amber-400' : 'text-red-400'}`}>
                    {contact.sentiment_score > 0.3 ? 'Positive' : contact.sentiment_score > -0.3 ? 'Neutral' : 'Negative'}
                  </span>
                  <span className="text-xs text-[#4B5068] ml-auto">{contact.sentiment_score.toFixed(2)}</span>
                </div>
                <div className="h-1.5 bg-[#222530] rounded-full">
                  <div className={`h-full rounded-full ${contact.sentiment_score > 0.3 ? 'bg-green-400' : contact.sentiment_score > -0.3 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${((contact.sentiment_score + 1) / 2) * 100}%` }} />
                </div>
              </div>

              {/* Attribution */}
              <div className="p-4 border-b border-[#1E2130]">
                <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider mb-2">Attribution</p>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-[#8B90A7]">Revenue attributed</span>
                  <span className="text-xs font-semibold text-green-400">${contact.revenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[#8B90A7]">Purchases</span>
                  <span className="text-xs font-semibold text-[#F0F2FF]">{contact.purchases}</span>
                </div>
              </div>

              {/* Active Flow */}
              <div className="p-4 border-b border-[#1E2130]">
                <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider mb-2">Active Flow</p>
                {contact.flow ? (
                  <>
                    <p className="text-xs font-medium text-[#F0F2FF]">{contact.flow}</p>
                    {contact.currentNode && <p className="text-[10px] text-[#8B90A7] mt-0.5">Current: {contact.currentNode}</p>}
                  </>
                ) : (
                  <p className="text-xs text-[#4B5068]">No active flow</p>
                )}
              </div>

              {/* GDPR */}
              <div className="p-4">
                <p className="text-[10px] font-semibold text-[#4B5068] uppercase tracking-wider mb-2">GDPR Tools</p>
                <div className="space-y-1">
                  <button
                    onClick={handleGdprExport}
                    disabled={gdprExporting}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#8B90A7] hover:bg-[#1A1C24] hover:text-[#F0F2FF] transition-colors disabled:opacity-50"
                  >
                    {gdprExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />} Export contact data
                  </button>
                  <button
                    onClick={handleGdprDelete}
                    disabled={gdprDeleting}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    {gdprDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete contact data
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-4 text-center text-xs text-[#4B5068]">
              {activeConv ? 'No contact data' : 'Select a conversation'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Highlights search term inside a message
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-400/30 text-yellow-300 rounded px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}

function ConvItem({
  conv,
  active,
  onClick,
  onMarkRead,
  markingRead,
}: {
  conv: ConvRow;
  active: boolean;
  onClick: () => void;
  onMarkRead: (id: string) => void;
  markingRead: boolean;
}) {
  const name = conv.unified_contacts?.display_name || 'Unknown';
  const tier = conv.unified_contacts?.loyalty_tier || 'NEWBIE';
  const [showActions, setShowActions] = React.useState(false);

  return (
    <div
      className={`relative flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors border-b border-[#1E2130] group ${active ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : 'hover:bg-[#1A1C24]'}`}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="relative flex-shrink-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br from-[#2A2E42] to-[#1A1C24] ${conv.priority_red ? 'ring-2 ring-red-400 priority-red-pulse' : ''}`}>
          {name.charAt(0)}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5">
          <PlatformIcon platform={conv.platform} size={12} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[#F0F2FF] truncate">{name}</p>
          <span className="text-[10px] text-[#4B5068] flex-shrink-0 ml-1">{formatTimeAgo(conv.last_message_at)}</span>
        </div>
        <p className="text-[10px] text-[#8B90A7] truncate mt-0.5">{conv.status}</p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <LoyaltyBadge tier={tier} />
        {conv.unread_count > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 flex items-center justify-center bg-blue-500 text-white text-[9px] font-bold rounded-full">{conv.unread_count}</span>
            {/* Mark as read button appears on hover */}
            {showActions && (
              <button
                onClick={e => { e.stopPropagation(); onMarkRead(conv.id); }}
                disabled={markingRead}
                title="Mark as read"
                className="w-4 h-4 flex items-center justify-center rounded-full bg-[#2A2E42] hover:bg-blue-500/20 transition-colors"
              >
                {markingRead ? (
                  <Loader2 className="w-2.5 h-2.5 text-[#4B5068] animate-spin" />
                ) : (
                  <CheckCheck className="w-2.5 h-2.5 text-[#4B5068] hover:text-blue-400" />
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
