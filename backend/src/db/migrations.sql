-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS citus;
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS vector;

-- SECTION 1: CORE TABLES

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan VARCHAR(20) NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE', 'PRO', 'LEGEND')),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('INSTAGRAM', 'FACEBOOK', 'TIKTOK')),
  platform_account_id TEXT NOT NULL,
  platform_username TEXT,
  encrypted_access_token BYTEA NOT NULL,
  encrypted_refresh_token BYTEA,
  encrypted_data_key BYTEA NOT NULL,
  token_expires_at TIMESTAMPTZ,
  last_refresh_at TIMESTAMPTZ,
  health_status VARCHAR(20) DEFAULT 'HEALTHY' CHECK (health_status IN ('HEALTHY', 'EXPIRING', 'BROKEN')),
  granted_scopes TEXT[] DEFAULT '{}',
  last_webhook_at TIMESTAMPTZ,
  circuit_state VARCHAR(20) DEFAULT 'CLOSED' CHECK (circuit_state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
  circuit_tripped_at TIMESTAMPTZ,
  failure_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, platform_account_id, brand_id)
);

CREATE TABLE IF NOT EXISTS unified_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  loyalty_score INT DEFAULT 0 CHECK (loyalty_score BETWEEN 0 AND 100),
  loyalty_tier VARCHAR(20) DEFAULT 'NEWBIE' CHECK (loyalty_tier IN ('NEWBIE', 'FAN', 'ADVOCATE')),
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  zero_party_signals JSONB DEFAULT '{}',
  sentiment_score DECIMAL(4,3) DEFAULT 0,
  gdpr_deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_contact_id UUID NOT NULL REFERENCES unified_contacts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('INSTAGRAM', 'FACEBOOK', 'TIKTOK')),
  platform_user_id TEXT NOT NULL,
  platform_username TEXT,
  last_interaction_at TIMESTAMPTZ,
  UNIQUE(platform, platform_user_id, brand_id)
);

CREATE TABLE IF NOT EXISTS flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  name TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED')),
  trigger_type VARCHAR(50) NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  yjs_state BYTEA,
  ghost_variant_id UUID REFERENCES flows(id) ON DELETE SET NULL,
  ghost_traffic_pct INT DEFAULT 0 CHECK (ghost_traffic_pct BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  node_type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  position_x DECIMAL NOT NULL DEFAULT 0,
  position_y DECIMAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  source_node_id UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  edge_label TEXT,
  condition_config JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  unified_contact_id UUID NOT NULL REFERENCES unified_contacts(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL,
  platform_conversation_id TEXT,
  status VARCHAR(20) DEFAULT 'BOT' CHECK (status IN ('BOT', 'HUMAN', 'CLOSED')),
  assigned_agent_id UUID,
  last_message_at TIMESTAMPTZ,
  sentiment_score DECIMAL(4,3) DEFAULT 0,
  priority_red BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  content TEXT,
  message_type VARCHAR(20) DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'DM_CARD', 'PRODUCT_CARD', 'SYSTEM')),
  platform_message_id TEXT,
  delivery_status VARCHAR(20) DEFAULT 'QUEUED' CHECK (delivery_status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED')),
  is_ai_generated BOOLEAN DEFAULT FALSE,
  ai_tier_used VARCHAR(20) CHECK (ai_tier_used IN ('TIER_1', 'TIER_2')),
  ai_token_cost INT DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  name TEXT NOT NULL,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('PDF', 'URL')),
  source_url TEXT,
  index_status VARCHAR(20) DEFAULT 'PENDING' CHECK (index_status IN ('PENDING', 'INDEXED', 'FAILED')),
  chunk_count INT DEFAULT 0,
  strictness VARCHAR(20) DEFAULT 'BALANCED' CHECK (strictness IN ('STRICT', 'BALANCED', 'CREATIVE')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attribution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  unified_contact_id UUID,
  flow_id UUID,
  node_id UUID,
  event_type VARCHAR(50) NOT NULL,
  platform TEXT,
  revenue_attributed DECIMAL(10,2) DEFAULT 0,
  identity_token TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable('attribution_events', 'created_at', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  destination_url TEXT NOT NULL,
  identity_token TEXT NOT NULL,
  contact_id UUID REFERENCES unified_contacts(id) ON DELETE SET NULL,
  flow_id UUID,
  click_count INT DEFAULT 0,
  custom_domain TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_raw_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(20) NOT NULL,
  delivery_id TEXT UNIQUE NOT NULL,
  s3_path TEXT NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  is_processed BOOLEAN DEFAULT FALSE,
  is_replay BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS flow_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  flow_id UUID NOT NULL,
  user_id UUID NOT NULL,
  operation_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  conversation_id UUID,
  contact_id UUID,
  flow_id UUID,
  model_tier VARCHAR(20) NOT NULL,
  prompt_text TEXT NOT NULL,
  kb_chunks_retrieved JSONB DEFAULT '[]',
  function_calls JSONB DEFAULT '[]',
  response_text TEXT NOT NULL,
  token_count INT DEFAULT 0,
  estimated_cost_usd DECIMAL(8,6) DEFAULT 0,
  similarity_scores JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_decryption_audit (
  id BIGSERIAL PRIMARY KEY,
  connected_account_id UUID NOT NULL,
  calling_service TEXT NOT NULL,
  decrypted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS identity_match_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  contact_a_id UUID REFERENCES unified_contacts(id) ON DELETE CASCADE,
  contact_b_id UUID REFERENCES unified_contacts(id) ON DELETE CASCADE,
  match_score DECIMAL(4,3) NOT NULL,
  match_method VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'MERGED', 'DISMISSED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_brands_tenant_id ON brands(tenant_id);
CREATE INDEX idx_connected_accounts_tenant_brand ON connected_accounts(tenant_id, brand_id);
CREATE INDEX idx_unified_contacts_tenant_brand ON unified_contacts(tenant_id, brand_id);
CREATE INDEX idx_platform_profiles_unified_contact ON platform_profiles(unified_contact_id);
CREATE INDEX idx_flows_tenant_brand ON flows(tenant_id, brand_id);
CREATE INDEX idx_conversations_tenant_brand ON conversations(tenant_id, brand_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_attribution_events_tenant ON attribution_events(tenant_id, brand_id);
CREATE INDEX idx_attribution_events_created_at ON attribution_events(created_at DESC);
CREATE INDEX idx_short_links_slug ON short_links(slug);
CREATE INDEX idx_webhook_raw_vault_delivery_id ON webhook_raw_vault(delivery_id);
CREATE INDEX idx_ai_audit_logs_tenant ON ai_audit_logs(tenant_id);

-- ROW-LEVEL SECURITY
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE unified_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
CREATE POLICY tenant_isolation_brands ON brands
  USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY tenant_isolation_connected_accounts ON connected_accounts
  USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY tenant_isolation_unified_contacts ON unified_contacts
  USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY tenant_isolation_platform_profiles ON platform_profiles
  USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY tenant_isolation_flows ON flows
  USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY tenant_isolation_flow_nodes ON flow_nodes
  USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY tenant_isolation_flow_edges ON flow_edges
  USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY tenant_isolation_conversations ON conversations
  USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY tenant_isolation_messages ON messages
  USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY tenant_isolation_kb_documents ON kb_documents
  USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY tenant_isolation_attribution_events ON attribution_events
  USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY tenant_isolation_short_links ON short_links
  USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);

CREATE POLICY tenant_isolation_ai_audit_logs ON ai_audit_logs
  USING (tenant_id = (current_setting('app.current_tenant_id'))::uuid);
