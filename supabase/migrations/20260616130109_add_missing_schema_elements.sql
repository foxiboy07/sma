-- Add missing tables and columns from the FlowPulse Backend Master Prompt

-- =============================================
-- TOKEN REFRESH LOGS
-- =============================================
CREATE TABLE IF NOT EXISTS token_refresh_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  connected_account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (result IN ('SUCCESS', 'FAIL')),
  trigger TEXT NOT NULL CHECK (trigger IN ('AUTO', 'MANUAL', 'FORCE')),
  duration_ms INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_token_refresh_logs_account ON token_refresh_logs(connected_account_id);
CREATE INDEX idx_token_refresh_logs_created ON token_refresh_logs(created_at DESC);

-- =============================================
-- MISSING COLUMNS ON CONNECTED_ACCOUNTS
-- =============================================
ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS encrypted_refresh_token TEXT;
ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS encrypted_data_key TEXT;
ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ;
ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS granted_scopes TEXT[] DEFAULT '{}';
ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ;
ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS failure_rate_60s FLOAT DEFAULT 0;
ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS circuit_tripped_at TIMESTAMPTZ;

-- =============================================
-- MISSING COLUMNS ON FLOWS
-- =============================================
ALTER TABLE flows ADD COLUMN IF NOT EXISTS yjs_state BYTEA;
ALTER TABLE flows ADD COLUMN IF NOT EXISTS ghost_variant_id UUID REFERENCES flows(id);
ALTER TABLE flows ADD COLUMN IF NOT EXISTS ghost_traffic_pct INT DEFAULT 0;

-- =============================================
-- MISSING COLUMNS ON UNIFIED_CONTACTS
-- =============================================
ALTER TABLE unified_contacts ADD COLUMN IF NOT EXISTS zero_party_signals JSONB DEFAULT '{}';
ALTER TABLE unified_contacts ADD COLUMN IF NOT EXISTS notes TEXT;

-- =============================================
-- MISSING COLUMNS ON MESSAGES
-- =============================================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS platform_message_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_tier_used TEXT CHECK (ai_tier_used IS NULL OR ai_tier_used IN ('TIER_1', 'TIER_2'));
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_token_cost INT DEFAULT 0;

-- =============================================
-- MISSING COLUMNS ON BROADCASTS
-- =============================================
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS eligible_reach INT DEFAULT 0;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS replied_count INT DEFAULT 0;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS revenue_attributed DECIMAL(10,2) DEFAULT 0;

-- =============================================
-- MISSING COLUMNS ON KB_DOCUMENTS
-- =============================================
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS s3_key TEXT;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS token_count INT DEFAULT 0;

-- =============================================
-- MISSING COLUMNS ON DLQ_MESSAGES
-- =============================================
ALTER TABLE dlq_messages ADD COLUMN IF NOT EXISTS error_stack TEXT;
ALTER TABLE dlq_messages ADD COLUMN IF NOT EXISTS replayed_at TIMESTAMPTZ;
ALTER TABLE dlq_messages ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

-- =============================================
-- REFRESH TOKENS TABLE (JWT rotation)
-- =============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_fingerprint TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- =============================================
-- API KEY SCOPES
-- =============================================
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT '{}';

-- =============================================
-- CONVERSATION MISSING COLUMNS
-- =============================================
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS platform_conversation_id TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS priority_red BOOLEAN DEFAULT false;

-- =============================================
-- SHORT LINK MISSING COLUMNS
-- =============================================
ALTER TABLE short_links ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE short_links ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_flows_updated_at BEFORE UPDATE ON flows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- HELPER FUNCTIONS
-- =============================================
CREATE OR REPLACE FUNCTION get_tenant_id_for_user(p_user_id UUID)
RETURNS UUID AS $$
  SELECT t.id FROM tenants t
  INNER JOIN team_members tm ON tm.tenant_id = t.id
  WHERE tm.user_id = p_user_id
  LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_user_role_for_tenant(p_user_id UUID, p_tenant_id UUID)
RETURNS TEXT AS $$
  SELECT tm.role FROM team_members tm
  WHERE tm.user_id = p_user_id AND tm.tenant_id = p_tenant_id
  LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_brands_for_user(p_user_id UUID)
RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(DISTINCT b.id)
  FROM brands b
  INNER JOIN tenants t ON t.id = b.tenant_id
  INNER JOIN team_members tm ON tm.tenant_id = t.id
  WHERE tm.user_id = p_user_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_flow_metrics(p_flow_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_triggered INT;
  v_converted INT;
  v_revenue DECIMAL(10,2);
BEGIN
  SELECT triggered_count, conversion_count, revenue_attributed
    INTO v_triggered, v_converted, v_revenue
  FROM flows WHERE id = p_flow_id;

  RETURN jsonb_build_object(
    'triggeredCount', COALESCE(v_triggered, 0),
    'conversionPct', CASE WHEN v_triggered > 0 THEN ROUND((v_converted::FLOAT / v_triggered * 100)::numeric, 1) ELSE 0 END,
    'revenueAttributed', COALESCE(v_revenue, 0)
  );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_contact_attribution(p_contact_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_revenue DECIMAL(10,2);
  v_purchases INT;
  v_flows JSONB;
BEGIN
  SELECT COALESCE(SUM(revenue), 0) INTO v_revenue
  FROM attribution_events
  WHERE unified_contact_id = p_contact_id AND event_type = 'PURCHASE_ATTRIBUTED';

  SELECT COUNT(*) INTO v_purchases
  FROM attribution_events
  WHERE unified_contact_id = p_contact_id AND event_type = 'PURCHASE_ATTRIBUTED';

  SELECT jsonb_agg(DISTINCT jsonb_build_object('id', f.id, 'name', f.name)) INTO v_flows
  FROM flows f
  WHERE f.id IN (
    SELECT DISTINCT ae.flow_id FROM attribution_events ae
    WHERE ae.unified_contact_id = p_contact_id AND ae.flow_id IS NOT NULL
  );

  RETURN jsonb_build_object(
    'revenueAttributed', v_revenue,
    'purchasesCount', v_purchases,
    'contributingFlows', COALESCE(v_flows, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql STABLE;
