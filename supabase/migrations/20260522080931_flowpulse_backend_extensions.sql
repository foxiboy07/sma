/*
  # FlowPuse Backend Extensions

  ## Overview
  Adds missing tables and database functions needed by the edge function backend.

  ## New Tables
  - `consent_logs` - Immutable audit trail of all consent events
  - `kb_chunks` - Individual text chunks from knowledge base documents with embedding vectors
  - `notifications` - In-app and push notification records
  - `flow_sessions` - Active flow execution sessions per contact
  - `api_keys` - Generated API keys for programmatic access

  ## New Functions
  - `check_24h_window()` - Validates messaging window compliance
  - `update_loyalty_tier()` - Auto-updates tier based on score
  - `increment_flow_stats()` - Atomic flow counter updates
  - `log_attribution_event()` - Convenience function for attribution logging
  - `match_kb_chunks()` - Vector similarity search for knowledge base

  ## Security
  - RLS enabled on all new tables
  - Tenant isolation policies applied
*/

-- Enable pgvector extension FIRST
CREATE EXTENSION IF NOT EXISTS vector;

-- CONSENT LOGS (immutable append-only)
CREATE TABLE IF NOT EXISTS consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  unified_contact_id UUID REFERENCES unified_contacts(id),
  contact_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('OPT_IN', 'OPT_OUT', 'DATA_EXPORT', 'SOFT_DELETE', 'CONSENT_UPDATE')),
  platform TEXT,
  channel TEXT,
  ip_address TEXT,
  method TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- KB CHUNKS with pgvector embeddings
CREATE TABLE IF NOT EXISTS kb_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  token_count INT DEFAULT 0,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FLOW SESSIONS (active execution state per contact)
CREATE TABLE IF NOT EXISTS flow_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  unified_contact_id UUID NOT NULL REFERENCES unified_contacts(id),
  flow_id UUID NOT NULL REFERENCES flows(id),
  current_node_id UUID REFERENCES flow_nodes(id),
  platform platform_type NOT NULL,
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  next_action_at TIMESTAMPTZ,
  loyalty_score_at_entry INT DEFAULT 0,
  flow_vars JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API KEYS
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  permissions TEXT[] DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  request_count INT DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_consent_logs_tenant_id ON consent_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consent_logs_contact_id ON consent_logs(unified_contact_id);
CREATE INDEX IF NOT EXISTS idx_consent_logs_created_at ON consent_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_document_id ON kb_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_tenant_id ON kb_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user ON notifications(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_contact ON flow_sessions(unified_contact_id);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_active ON flow_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);

-- Enable RLS on new tables
ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES for consent_logs
CREATE POLICY "Tenant members can view consent logs"
  ON consent_logs FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service can insert consent logs"
  ON consent_logs FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

-- RLS POLICIES for kb_chunks
CREATE POLICY "Tenant members can view kb chunks"
  ON kb_chunks FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant admins can manage kb chunks"
  ON kb_chunks FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

CREATE POLICY "Tenant admins can delete kb chunks"
  ON kb_chunks FOR DELETE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

-- RLS POLICIES for notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

-- RLS POLICIES for flow_sessions
CREATE POLICY "Tenant members can view flow sessions"
  ON flow_sessions FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service can manage flow sessions"
  ON flow_sessions FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service can update flow sessions"
  ON flow_sessions FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

-- RLS POLICIES for api_keys
CREATE POLICY "Tenant members can view api keys"
  ON api_keys FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant admins can manage api keys"
  ON api_keys FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

CREATE POLICY "Tenant admins can update api keys"
  ON api_keys FOR UPDATE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ))
  WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

CREATE POLICY "Tenant admins can delete api keys"
  ON api_keys FOR DELETE
  TO authenticated
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE owner_user_id = auth.uid()
    UNION SELECT tenant_id FROM team_members WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));

-- DATABASE FUNCTIONS

-- 24-Hour Window Validator
CREATE OR REPLACE FUNCTION check_24h_window(
  p_contact_id UUID,
  p_platform platform_type,
  p_brand_id UUID,
  p_has_message_tag BOOLEAN DEFAULT FALSE
)
RETURNS TEXT AS $$
DECLARE
  v_last_interaction TIMESTAMPTZ;
  v_delta_hrs DECIMAL;
BEGIN
  SELECT last_interaction_at INTO v_last_interaction
  FROM platform_profiles
  WHERE unified_contact_id = p_contact_id
    AND platform = p_platform
    AND brand_id = p_brand_id
  LIMIT 1;

  IF v_last_interaction IS NULL THEN
    RETURN 'ALLOW';
  END IF;

  v_delta_hrs := EXTRACT(EPOCH FROM (NOW() - v_last_interaction)) / 3600.0;

  IF v_delta_hrs < 23.5 THEN
    RETURN 'ALLOW';
  ELSIF v_delta_hrs <= 24.0 THEN
    RETURN 'NEAR_EXPIRY';
  ELSIF p_has_message_tag THEN
    RETURN 'EXPIRED_WITH_TAG';
  ELSE
    RETURN 'EXPIRED_BLOCKED';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update loyalty tier based on score
CREATE OR REPLACE FUNCTION update_loyalty_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.loyalty_score >= 67 THEN
    NEW.loyalty_tier := 'ADVOCATE'::loyalty_tier_type;
  ELSIF NEW.loyalty_score >= 34 THEN
    NEW.loyalty_tier := 'FAN'::loyalty_tier_type;
  ELSE
    NEW.loyalty_tier := 'NEWBIE'::loyalty_tier_type;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_loyalty_tier ON unified_contacts;
CREATE TRIGGER trg_update_loyalty_tier
  BEFORE INSERT OR UPDATE OF loyalty_score ON unified_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_loyalty_tier();

-- Atomic flow stats increment
CREATE OR REPLACE FUNCTION increment_flow_stats(
  p_flow_id UUID,
  p_triggered BOOLEAN DEFAULT FALSE,
  p_converted BOOLEAN DEFAULT FALSE,
  p_revenue DECIMAL DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  UPDATE flows SET
    triggered_count = triggered_count + CASE WHEN p_triggered THEN 1 ELSE 0 END,
    conversion_count = conversion_count + CASE WHEN p_converted THEN 1 ELSE 0 END,
    revenue_attributed = revenue_attributed + p_revenue,
    updated_at = NOW()
  WHERE id = p_flow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Convenience attribution event logger
CREATE OR REPLACE FUNCTION log_attribution_event(
  p_tenant_id UUID,
  p_brand_id UUID,
  p_contact_id UUID,
  p_flow_id UUID,
  p_event_type TEXT,
  p_platform TEXT DEFAULT NULL,
  p_revenue DECIMAL DEFAULT 0,
  p_identity_token TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO attribution_events (
    tenant_id, brand_id, unified_contact_id, flow_id,
    event_type, platform, revenue_attributed, identity_token, metadata
  ) VALUES (
    p_tenant_id, p_brand_id, p_contact_id, p_flow_id,
    p_event_type::attribution_event_type, p_platform, p_revenue, p_identity_token, p_metadata
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vector similarity search function for KB
CREATE OR REPLACE FUNCTION match_kb_chunks(
  query_embedding vector(1536),
  p_brand_id UUID,
  p_match_threshold DECIMAL DEFAULT 0.5,
  p_match_count INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_index INT,
  content TEXT,
  token_count INT,
  similarity DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_id,
    kc.chunk_index,
    kc.content,
    kc.token_count,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM kb_chunks kc
  WHERE kc.brand_id = p_brand_id
    AND 1 - (kc.embedding <=> query_embedding) >= p_match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
