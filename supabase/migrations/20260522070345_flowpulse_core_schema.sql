/*
  # FlowPulse Core Schema

  ## Overview
  Complete database schema for the FlowPulse multi-channel DM automation and CRM platform.

  ## New Tables
  - `tenants` - Multi-tenant organizations with plan tiers
  - `brands` - Brand accounts per tenant
  - `connected_accounts` - Platform OAuth connections (IG/FB/TikTok) with encrypted tokens
  - `unified_contacts` - Cross-platform contact deduplication
  - `platform_profiles` - Per-platform contact identities
  - `identity_match_queue` - Fuzzy duplicate detection queue
  - `flows` - Automation flow definitions with A/B ghost variants
  - `flow_nodes` - Individual nodes within flows
  - `flow_edges` - Connections between nodes
  - `conversations` - Unified inbox conversations
  - `messages` - Individual messages in conversations
  - `kb_documents` - AI knowledge base documents
  - `attribution_events` - Revenue attribution and analytics events
  - `short_links` - Tracked short links with identity tokens
  - `webhook_raw_vault` - Raw webhook storage reference
  - `flow_audit_logs` - Flow change audit trail
  - `ai_audit_logs` - AI decision audit trail
  - `token_decryption_audit` - Security audit for token access

  ## Security
  - RLS enabled on all tenant tables
  - Tenant isolation policies on every table
*/

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom ENUM types
DO $$ BEGIN
  CREATE TYPE plan_type AS ENUM ('FREE', 'PRO', 'LEGEND');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE platform_type AS ENUM ('INSTAGRAM', 'FACEBOOK', 'TIKTOK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE token_health_status AS ENUM ('HEALTHY', 'EXPIRING', 'BROKEN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE circuit_state_type AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE loyalty_tier_type AS ENUM ('NEWBIE', 'FAN', 'ADVOCATE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE flow_status_type AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE trigger_type AS ENUM (
    'COMMENT_TO_DM', 'STORY_MENTION', 'STORY_REPLY',
    'FOLLOW_TO_DM', 'SHARE_TO_DM', 'TIKTOK_COMMENT_TO_DM',
    'TIKTOK_SHOP_COMMENT', 'DEEPLINK_BIO_CLICK', 'MANUAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE node_type AS ENUM (
    'TRIGGER', 'SEND_MESSAGE', 'SEND_DM_CARD', 'AI_STEP',
    'ACTION_BLOCK', 'CUSTOM_CODE', 'CONDITION', 'SUPER_RANDOMIZER',
    'SMART_DELAY', 'FRICTION_RECOVERY', 'TIKTOK_SHOP_PRODUCT',
    'OUTBOUND_WEBHOOK'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE conversation_status_type AS ENUM ('BOT', 'HUMAN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE message_direction AS ENUM ('INBOUND', 'OUTBOUND');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('TEXT', 'DM_CARD', 'PRODUCT_CARD', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE delivery_status_type AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_tier_type AS ENUM ('TIER_1', 'TIER_2');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE kb_source_type AS ENUM ('PDF', 'URL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE kb_index_status AS ENUM ('PENDING', 'INDEXED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE kb_strictness AS ENUM ('STRICT', 'BALANCED', 'CREATIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE attribution_event_type AS ENUM (
    'FLOW_TRIGGERED', 'MESSAGE_SENT', 'LINK_CLICKED',
    'PURCHASE_ATTRIBUTED', 'INTENT_CLASSIFIED', 'AI_RESPONSE_SENT',
    'HUMAN_HANDOFF', 'BIO_CLICK', 'CAPI_FIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE match_method_type AS ENUM ('EXACT_EMAIL', 'EXACT_PHONE', 'FUZZY_NAME');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE match_status_type AS ENUM ('PENDING', 'MERGED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- TENANTS
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan plan_type NOT NULL DEFAULT 'FREE',
  stripe_customer_id TEXT,
  owner_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BRANDS
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  persona_name TEXT DEFAULT 'Assistant',
  persona_tone TEXT DEFAULT 'friendly',
  persona_language TEXT DEFAULT 'en',
  persona_forbidden_topics TEXT[] DEFAULT '{}',
  persona_unsure_behavior TEXT DEFAULT 'handoff',
  ai_monthly_budget_usd DECIMAL(8,2) DEFAULT 100.00,
  ai_budget_alert_pct INT DEFAULT 80,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONNECTED ACCOUNTS
CREATE TABLE IF NOT EXISTS connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  platform_account_id TEXT NOT NULL,
  platform_username TEXT,
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  encrypted_data_key TEXT,
  token_expires_at TIMESTAMPTZ,
  last_refresh_at TIMESTAMPTZ DEFAULT NOW(),
  health_status token_health_status DEFAULT 'HEALTHY',
  granted_scopes TEXT[] DEFAULT '{}',
  last_webhook_at TIMESTAMPTZ,
  circuit_state circuit_state_type DEFAULT 'CLOSED',
  circuit_tripped_at TIMESTAMPTZ,
  failure_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- UNIFIED CONTACTS
CREATE TABLE IF NOT EXISTS unified_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  loyalty_score INT DEFAULT 0 CHECK (loyalty_score BETWEEN 0 AND 100),
  loyalty_tier loyalty_tier_type DEFAULT 'NEWBIE',
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  zero_party_signals JSONB DEFAULT '{}',
  sentiment_score DECIMAL(4,3) DEFAULT 0,
  notes TEXT DEFAULT '',
  gdpr_deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PLATFORM PROFILES
CREATE TABLE IF NOT EXISTS platform_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_contact_id UUID NOT NULL REFERENCES unified_contacts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  platform_user_id TEXT NOT NULL,
  platform_username TEXT,
  last_interaction_at TIMESTAMPTZ,
  UNIQUE(platform, platform_user_id, brand_id)
);

-- IDENTITY MATCH QUEUE
CREATE TABLE IF NOT EXISTS identity_match_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  contact_a_id UUID REFERENCES unified_contacts(id),
  contact_b_id UUID REFERENCES unified_contacts(id),
  match_score DECIMAL(4,3) NOT NULL,
  match_method match_method_type NOT NULL,
  status match_status_type DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FLOWS
CREATE TABLE IF NOT EXISTS flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status flow_status_type DEFAULT 'DRAFT',
  trigger_type trigger_type NOT NULL DEFAULT 'MANUAL',
  trigger_config JSONB DEFAULT '{}',
  yjs_state BYTEA,
  ghost_variant_id UUID REFERENCES flows(id),
  ghost_traffic_pct INT DEFAULT 0 CHECK (ghost_traffic_pct BETWEEN 0 AND 100),
  triggered_count INT DEFAULT 0,
  conversion_count INT DEFAULT 0,
  revenue_attributed DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FLOW NODES
CREATE TABLE IF NOT EXISTS flow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  node_type node_type NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  position_x DECIMAL NOT NULL DEFAULT 0,
  position_y DECIMAL NOT NULL DEFAULT 0,
  label TEXT,
  is_disabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FLOW EDGES
CREATE TABLE IF NOT EXISTS flow_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  edge_label TEXT,
  condition_config JSONB DEFAULT '{}'
);

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  unified_contact_id UUID NOT NULL REFERENCES unified_contacts(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  platform_conversation_id TEXT,
  status conversation_status_type DEFAULT 'BOT',
  assigned_agent_id UUID REFERENCES auth.users(id),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  sentiment_score DECIMAL(4,3) DEFAULT 0,
  priority_red BOOLEAN DEFAULT FALSE,
  unread_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  direction message_direction NOT NULL,
  content TEXT,
  message_type message_type DEFAULT 'TEXT',
  platform_message_id TEXT,
  delivery_status delivery_status_type DEFAULT 'QUEUED',
  is_ai_generated BOOLEAN DEFAULT FALSE,
  ai_tier_used ai_tier_type,
  ai_token_cost INT DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- KB DOCUMENTS
CREATE TABLE IF NOT EXISTS kb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type kb_source_type NOT NULL,
  source_url TEXT,
  index_status kb_index_status DEFAULT 'PENDING',
  chunk_count INT DEFAULT 0,
  strictness kb_strictness DEFAULT 'BALANCED',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ATTRIBUTION EVENTS
CREATE TABLE IF NOT EXISTS attribution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  unified_contact_id UUID REFERENCES unified_contacts(id),
  flow_id UUID REFERENCES flows(id),
  node_id UUID REFERENCES flow_nodes(id),
  event_type attribution_event_type NOT NULL,
  platform TEXT,
  revenue_attributed DECIMAL(10,2) DEFAULT 0,
  identity_token TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SHORT LINKS
CREATE TABLE IF NOT EXISTS short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  destination_url TEXT NOT NULL,
  identity_token TEXT NOT NULL,
  contact_id UUID REFERENCES unified_contacts(id),
  flow_id UUID REFERENCES flows(id),
  click_count INT DEFAULT 0,
  custom_domain TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WEBHOOK RAW VAULT
CREATE TABLE IF NOT EXISTS webhook_raw_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform platform_type NOT NULL,
  delivery_id TEXT UNIQUE NOT NULL,
  s3_path TEXT NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  is_processed BOOLEAN DEFAULT FALSE,
  is_replay BOOLEAN DEFAULT FALSE
);

-- FLOW AUDIT LOGS
CREATE TABLE IF NOT EXISTS flow_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  operation_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI AUDIT LOGS
CREATE TABLE IF NOT EXISTS ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id),
  contact_id UUID REFERENCES unified_contacts(id),
  flow_id UUID REFERENCES flows(id),
  model_tier ai_tier_type NOT NULL,
  prompt_text TEXT NOT NULL DEFAULT '',
  kb_chunks_retrieved JSONB DEFAULT '[]',
  function_calls JSONB DEFAULT '[]',
  response_text TEXT NOT NULL DEFAULT '',
  token_count INT DEFAULT 0,
  estimated_cost_usd DECIMAL(8,6) DEFAULT 0,
  similarity_scores JSONB DEFAULT '[]',
  intent_classified TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TOKEN DECRYPTION AUDIT
CREATE TABLE IF NOT EXISTS token_decryption_audit (
  id BIGSERIAL PRIMARY KEY,
  connected_account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
  calling_service TEXT NOT NULL,
  decrypted_at TIMESTAMPTZ DEFAULT NOW()
);

-- DLQ MESSAGES TABLE
CREATE TABLE IF NOT EXISTS dlq_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  platform platform_type,
  contact_name TEXT,
  flow_id UUID REFERENCES flows(id),
  flow_name TEXT,
  node_id TEXT,
  error_code TEXT NOT NULL,
  error_detail TEXT,
  original_payload JSONB DEFAULT '{}',
  retry_count INT DEFAULT 0,
  retry_history JSONB DEFAULT '[]',
  status TEXT DEFAULT 'PENDING',
  is_replay BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_attempted_at TIMESTAMPTZ
);

-- TEAM MEMBERS
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'agent', 'readonly')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'inactive')),
  skills TEXT[] DEFAULT '{}',
  last_active_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BROADCASTS
CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  platform platform_type,
  message_content TEXT,
  message_tag TEXT,
  segment_filters JSONB DEFAULT '{}',
  estimated_reach INT DEFAULT 0,
  window_eligible_count INT DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  replied_count INT DEFAULT 0,
  revenue_attributed DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_brands_tenant_id ON brands(tenant_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_tenant_id ON connected_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_brand_id ON connected_accounts(brand_id);
CREATE INDEX IF NOT EXISTS idx_unified_contacts_tenant_id ON unified_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_unified_contacts_brand_id ON unified_contacts(brand_id);
CREATE INDEX IF NOT EXISTS idx_platform_profiles_contact_id ON platform_profiles(unified_contact_id);
CREATE INDEX IF NOT EXISTS idx_flows_tenant_id ON flows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_flows_brand_id ON flows(brand_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(unified_contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_attribution_events_tenant_id ON attribution_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attribution_events_created_at ON attribution_events(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_tenant_id ON ai_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dlq_messages_tenant_id ON dlq_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dlq_messages_status ON dlq_messages(status);

-- ROW LEVEL SECURITY
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE unified_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_match_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE dlq_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES: Users can only see tenants they own or belong to
CREATE POLICY "Users can view own tenants"
  ON tenants FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid() OR id IN (
    SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own tenants"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users can update own tenants"
  ON tenants FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Brands: accessible if user belongs to that tenant
CREATE POLICY "Tenant members can view brands"
  ON brands FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant admins can insert brands"
  ON brands FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

CREATE POLICY "Tenant admins can update brands"
  ON brands FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

-- Connected accounts: tenant members can view
CREATE POLICY "Tenant members can view connected accounts"
  ON connected_accounts FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant admins can manage connected accounts"
  ON connected_accounts FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

CREATE POLICY "Tenant admins can update connected accounts"
  ON connected_accounts FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

-- Contacts: tenant members can view and manage
CREATE POLICY "Tenant members can view contacts"
  ON unified_contacts FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can insert contacts"
  ON unified_contacts FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can update contacts"
  ON unified_contacts FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

-- Platform profiles
CREATE POLICY "Tenant members can view platform profiles"
  ON platform_profiles FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can insert platform profiles"
  ON platform_profiles FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

-- Identity match queue
CREATE POLICY "Tenant members can view identity match queue"
  ON identity_match_queue FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can update identity match queue"
  ON identity_match_queue FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

-- Flows
CREATE POLICY "Tenant members can view flows"
  ON flows FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can insert flows"
  ON flows FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can update flows"
  ON flows FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

-- Flow nodes
CREATE POLICY "Tenant members can view flow nodes"
  ON flow_nodes FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can manage flow nodes"
  ON flow_nodes FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can update flow nodes"
  ON flow_nodes FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can delete flow nodes"
  ON flow_nodes FOR DELETE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

-- Flow edges
CREATE POLICY "Tenant members can view flow edges"
  ON flow_edges FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can manage flow edges"
  ON flow_edges FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can update flow edges"
  ON flow_edges FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can delete flow edges"
  ON flow_edges FOR DELETE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

-- Conversations
CREATE POLICY "Tenant members can view conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can insert conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can update conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

-- Messages
CREATE POLICY "Tenant members can view messages"
  ON messages FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can insert messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

-- KB Documents
CREATE POLICY "Tenant members can view kb documents"
  ON kb_documents FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant admins can manage kb documents"
  ON kb_documents FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

CREATE POLICY "Tenant admins can update kb documents"
  ON kb_documents FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

CREATE POLICY "Tenant admins can delete kb documents"
  ON kb_documents FOR DELETE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

-- Attribution events
CREATE POLICY "Tenant members can view attribution events"
  ON attribution_events FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can insert attribution events"
  ON attribution_events FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

-- Short links
CREATE POLICY "Tenant members can view short links"
  ON short_links FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can manage short links"
  ON short_links FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

-- AI audit logs
CREATE POLICY "Tenant members can view ai audit logs"
  ON ai_audit_logs FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can insert ai audit logs"
  ON ai_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

-- Flow audit logs
CREATE POLICY "Tenant members can view flow audit logs"
  ON flow_audit_logs FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

-- Team members
CREATE POLICY "Tenant members can view team"
  ON team_members FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant admins can manage team"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

CREATE POLICY "Tenant admins can update team"
  ON team_members FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

-- DLQ messages
CREATE POLICY "Tenant admins can view dlq messages"
  ON dlq_messages FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

CREATE POLICY "Tenant admins can update dlq messages"
  ON dlq_messages FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

-- Broadcasts
CREATE POLICY "Tenant members can view broadcasts"
  ON broadcasts FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant admins can manage broadcasts"
  ON broadcasts FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

CREATE POLICY "Tenant admins can update broadcasts"
  ON broadcasts FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));
