// Core Domain Types
export type UUID = string & { readonly __brand: 'UUID' };
export type Platform = 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK';
export type PlanType = 'FREE' | 'PRO' | 'LEGEND';
export type ConversationStatus = 'BOT' | 'HUMAN' | 'CLOSED';
export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type DeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
export type FlowStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type TokenHealth = 'HEALTHY' | 'EXPIRING' | 'BROKEN';
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export type LoyaltyTier = 'NEWBIE' | 'FAN' | 'ADVOCATE';
export type AITier = 'TIER_1' | 'TIER_2';
export type IntentBucket =
  | 'BUY_INTENT'
  | 'REFUND_REQUEST'
  | 'PRICE_CHECK'
  | 'GENERAL_QUESTION'
  | 'COMPLAINT'
  | 'GREETING'
  | 'UNSUBSCRIBE'
  | 'LINK_REQUEST'
  | 'OTHER';

// Database Models
export interface Tenant {
  id: UUID;
  name: string;
  plan: PlanType;
  stripe_customer_id: string | null;
  created_at: Date;
}

export interface Brand {
  id: UUID;
  tenant_id: UUID;
  name: string;
  logo_url: string | null;
  timezone: string;
  created_at: Date;
}

export interface ConnectedAccount {
  id: UUID;
  tenant_id: UUID;
  brand_id: UUID;
  platform: Platform;
  platform_account_id: string;
  platform_username: string | null;
  encrypted_access_token: Buffer;
  encrypted_refresh_token: Buffer | null;
  encrypted_data_key: Buffer;
  token_expires_at: Date | null;
  last_refresh_at: Date | null;
  health_status: TokenHealth;
  granted_scopes: string[];
  last_webhook_at: Date | null;
  circuit_state: CircuitState;
  circuit_tripped_at: Date | null;
  failure_count: number;
  created_at: Date;
}

export interface UnifiedContact {
  id: UUID;
  tenant_id: UUID;
  brand_id: UUID;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  loyalty_score: number;
  loyalty_tier: LoyaltyTier;
  tags: string[];
  custom_fields: Record<string, any>;
  zero_party_signals: Record<string, any>;
  sentiment_score: number;
  gdpr_deleted_at: Date | null;
  created_at: Date;
}

export interface PlatformProfile {
  id: UUID;
  unified_contact_id: UUID;
  tenant_id: UUID;
  brand_id: UUID;
  platform: Platform;
  platform_user_id: string;
  platform_username: string | null;
  last_interaction_at: Date | null;
}

export interface Flow {
  id: UUID;
  tenant_id: UUID;
  brand_id: UUID;
  name: string;
  status: FlowStatus;
  trigger_type: string;
  trigger_config: Record<string, any>;
  yjs_state: Buffer | null;
  ghost_variant_id: UUID | null;
  ghost_traffic_pct: number;
  created_at: Date;
  updated_at: Date;
}

export interface Conversation {
  id: UUID;
  tenant_id: UUID;
  brand_id: UUID;
  unified_contact_id: UUID;
  platform: Platform;
  platform_conversation_id: string | null;
  status: ConversationStatus;
  assigned_agent_id: UUID | null;
  last_message_at: Date | null;
  sentiment_score: number;
  priority_red: boolean;
  created_at: Date;
}

export interface Message {
  id: UUID;
  conversation_id: UUID;
  tenant_id: UUID;
  direction: MessageDirection;
  content: string | null;
  message_type: 'TEXT' | 'DM_CARD' | 'PRODUCT_CARD' | 'SYSTEM';
  platform_message_id: string | null;
  delivery_status: DeliveryStatus;
  is_ai_generated: boolean;
  ai_tier_used: AITier | null;
  ai_token_cost: number;
  sent_at: Date | null;
  created_at: Date;
}

// API Request/Response Types
export interface AuthPayload {
  tenant_id: UUID;
  brand_id?: UUID;
  user_id: UUID;
  roles: string[];
}

export interface WebhookPayload {
  delivery_id: string;
  platform: Platform;
  timestamp: number;
  entry: any[];
}

export interface MessageQueuePayload {
  id: string;
  tenant_id: UUID;
  brand_id: UUID;
  contact_id: UUID;
  flow_id: UUID;
  node_id: UUID;
  platform: Platform;
  platform_conversation_id: string;
  message_content: string;
  message_type: string;
  timestamp: number;
  retries: number;
  is_replay: boolean;
}

// Circuit Breaker Types
export interface CircuitBreakerState {
  state: CircuitState;
  tripped_at: number | null;
  failure_count: number;
  probe_at: number | null;
  last_error: string | null;
}

// Rate Limiter Types
export interface TokenBucketState {
  tokens: number;
  last_refill: number;
}

// Session Types
export interface ActiveSession {
  contact_id: UUID;
  platform: Platform;
  flow_id: UUID;
  node_id: UUID;
  entered_at: number;
  next_action_at: number;
  loyalty_score: number;
}

// Attribution Types
export interface AttributionEvent {
  id: UUID;
  tenant_id: UUID;
  brand_id: UUID;
  unified_contact_id: UUID | null;
  flow_id: UUID | null;
  node_id: UUID | null;
  event_type: string;
  platform: string | null;
  revenue_attributed: number;
  identity_token: string | null;
  metadata: Record<string, any>;
  created_at: Date;
}
