export type PlanType = 'FREE' | 'PRO' | 'LEGEND';
export type PlatformType = 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK';
export type TokenHealthStatus = 'HEALTHY' | 'EXPIRING' | 'BROKEN';
export type CircuitStateType = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export type LoyaltyTier = 'NEWBIE' | 'FAN' | 'ADVOCATE';
export type FlowStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type TriggerType = 'COMMENT_TO_DM' | 'STORY_MENTION' | 'STORY_REPLY' | 'FOLLOW_TO_DM' | 'SHARE_TO_DM' | 'TIKTOK_COMMENT_TO_DM' | 'TIKTOK_SHOP_COMMENT' | 'DEEPLINK_BIO_CLICK' | 'MANUAL';
export type NodeType = 'TRIGGER' | 'SEND_MESSAGE' | 'SEND_DM_CARD' | 'AI_STEP' | 'ACTION_BLOCK' | 'CUSTOM_CODE' | 'CONDITION' | 'SUPER_RANDOMIZER' | 'SMART_DELAY' | 'FRICTION_RECOVERY' | 'TIKTOK_SHOP_PRODUCT' | 'OUTBOUND_WEBHOOK';
export type ConversationStatus = 'BOT' | 'HUMAN' | 'CLOSED';
export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageType = 'TEXT' | 'DM_CARD' | 'PRODUCT_CARD' | 'SYSTEM';
export type DeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
export type AITier = 'TIER_1' | 'TIER_2';
export type KBSourceType = 'PDF' | 'URL';
export type KBIndexStatus = 'PENDING' | 'INDEXED' | 'FAILED';
export type KBStrictness = 'STRICT' | 'BALANCED' | 'CREATIVE';

export interface Tenant {
  id: string;
  name: string;
  plan: PlanType;
  stripe_customer_id?: string;
  owner_user_id?: string;
  created_at: string;
}

export interface Brand {
  id: string;
  tenant_id: string;
  name: string;
  logo_url?: string;
  timezone: string;
  persona_name: string;
  persona_tone: string;
  persona_language: string;
  created_at: string;
}

export interface ConnectedAccount {
  id: string;
  tenant_id: string;
  brand_id: string;
  platform: PlatformType;
  platform_account_id: string;
  platform_username?: string;
  token_expires_at?: string;
  last_refresh_at?: string;
  health_status: TokenHealthStatus;
  granted_scopes: string[];
  last_webhook_at?: string;
  circuit_state: CircuitStateType;
  circuit_tripped_at?: string;
  failure_count: number;
  created_at: string;
}

export interface UnifiedContact {
  id: string;
  tenant_id: string;
  brand_id: string;
  display_name?: string;
  email?: string;
  phone?: string;
  loyalty_score: number;
  loyalty_tier: LoyaltyTier;
  tags: string[];
  custom_fields: Record<string, unknown>;
  zero_party_signals: Record<string, unknown>;
  sentiment_score: number;
  notes?: string;
  gdpr_deleted_at?: string;
  created_at: string;
}

export interface PlatformProfile {
  id: string;
  unified_contact_id: string;
  tenant_id: string;
  brand_id: string;
  platform: PlatformType;
  platform_user_id: string;
  platform_username?: string;
  last_interaction_at?: string;
}

export interface Flow {
  id: string;
  tenant_id: string;
  brand_id: string;
  name: string;
  status: FlowStatus;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  ghost_variant_id?: string;
  ghost_traffic_pct: number;
  triggered_count: number;
  conversion_count: number;
  revenue_attributed: number;
  created_at: string;
  updated_at: string;
}

export interface FlowNode {
  id: string;
  flow_id: string;
  tenant_id: string;
  node_type: NodeType;
  config: Record<string, unknown>;
  position_x: number;
  position_y: number;
  label?: string;
  is_disabled: boolean;
}

export interface FlowEdge {
  id: string;
  flow_id: string;
  tenant_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_label?: string;
  condition_config: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  tenant_id: string;
  brand_id: string;
  unified_contact_id: string;
  platform: PlatformType;
  platform_conversation_id?: string;
  status: ConversationStatus;
  assigned_agent_id?: string;
  last_message_at?: string;
  sentiment_score: number;
  priority_red: boolean;
  unread_count: number;
  created_at: string;
  unified_contacts?: UnifiedContact;
  messages?: Message[];
}

export interface Message {
  id: string;
  conversation_id: string;
  tenant_id: string;
  direction: MessageDirection;
  content?: string;
  message_type: MessageType;
  platform_message_id?: string;
  delivery_status: DeliveryStatus;
  is_ai_generated: boolean;
  ai_tier_used?: AITier;
  ai_token_cost: number;
  sent_at?: string;
  created_at: string;
}

export interface KBDocument {
  id: string;
  tenant_id: string;
  brand_id: string;
  name: string;
  source_type: KBSourceType;
  source_url?: string;
  index_status: KBIndexStatus;
  chunk_count: number;
  strictness: KBStrictness;
  error_message?: string;
  created_at: string;
}

export interface AttributionEvent {
  id: string;
  tenant_id: string;
  brand_id: string;
  unified_contact_id?: string;
  flow_id?: string;
  event_type: string;
  platform?: string;
  revenue_attributed: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ShortLink {
  id: string;
  tenant_id: string;
  brand_id: string;
  slug: string;
  destination_url: string;
  identity_token: string;
  contact_id?: string;
  flow_id?: string;
  click_count: number;
  custom_domain?: string;
  expires_at?: string;
  created_at: string;
}

export interface DLQMessage {
  id: string;
  tenant_id?: string;
  brand_id?: string;
  platform?: PlatformType;
  contact_name?: string;
  flow_id?: string;
  flow_name?: string;
  node_id?: string;
  error_code: string;
  error_detail?: string;
  original_payload: Record<string, unknown>;
  retry_count: number;
  retry_history: Record<string, unknown>[];
  status: string;
  is_replay: boolean;
  created_at: string;
  last_attempted_at?: string;
}

export interface AIAuditLog {
  id: string;
  tenant_id: string;
  conversation_id?: string;
  contact_id?: string;
  flow_id?: string;
  model_tier: AITier;
  prompt_text: string;
  kb_chunks_retrieved: Record<string, unknown>[];
  function_calls: Record<string, unknown>[];
  response_text: string;
  token_count: number;
  estimated_cost_usd: number;
  similarity_scores: Record<string, unknown>[];
  intent_classified?: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  tenant_id: string;
  user_id?: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  role: 'admin' | 'manager' | 'agent' | 'readonly';
  status: 'active' | 'invited' | 'inactive';
  skills: string[];
  last_active_at?: string;
  created_at: string;
}

export interface Broadcast {
  id: string;
  tenant_id: string;
  brand_id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  platform?: PlatformType;
  message_content?: string;
  message_tag?: string;
  segment_filters: Record<string, unknown>;
  estimated_reach: number;
  window_eligible_count: number;
  scheduled_at?: string;
  sent_at?: string;
  sent_count: number;
  delivered_count: number;
  replied_count: number;
  revenue_attributed: number;
  created_at: string;
}

export interface IdentityMatchQueue {
  id: string;
  tenant_id: string;
  brand_id: string;
  contact_a_id?: string;
  contact_b_id?: string;
  match_score: number;
  match_method: 'EXACT_EMAIL' | 'EXACT_PHONE' | 'FUZZY_NAME';
  status: 'PENDING' | 'MERGED' | 'DISMISSED';
  created_at: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
}
