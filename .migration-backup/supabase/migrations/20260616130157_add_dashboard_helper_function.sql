-- Dashboard helper function (split from previous migration due to subquery limit issue)

CREATE OR REPLACE FUNCTION get_dashboard_data(p_brand_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_dms_sent_today INT;
  v_active_flows INT;
  v_paused_flows INT;
  v_conversations_24h JSONB;
  v_ai_saved DECIMAL(10,2);
  v_cache_hit_rate FLOAT;
  v_priority_red JSONB;
  v_top_flows JSONB;
BEGIN
  -- DMs sent today
  SELECT COUNT(*) INTO v_dms_sent_today
  FROM messages m
  INNER JOIN conversations c ON c.id = m.conversation_id
  WHERE c.brand_id = p_brand_id
    AND m.direction = 'OUTBOUND'
    AND m.sent_at >= CURRENT_DATE;

  -- Active/Paused flows
  SELECT
    COUNT(*) FILTER (WHERE status = 'ACTIVE'),
    COUNT(*) FILTER (WHERE status = 'PAUSED')
  INTO v_active_flows, v_paused_flows
  FROM flows WHERE brand_id = p_brand_id;

  -- Conversations 24h
  SELECT jsonb_build_object(
    'bot', COUNT(*) FILTER (WHERE status = 'BOT'),
    'human', COUNT(*) FILTER (WHERE status = 'HUMAN'),
    'priorityRed', COUNT(*) FILTER (WHERE priority_red = true)
  ) INTO v_conversations_24h
  FROM conversations
  WHERE brand_id = p_brand_id
    AND last_message_at > now() - INTERVAL '24 hours';

  -- AI credits saved (approximate cache hit rate from audit logs)
  SELECT COALESCE(SUM(estimated_cost_usd), 0) INTO v_ai_saved
  FROM ai_audit_logs
  WHERE brand_id = p_brand_id
    AND created_at >= date_trunc('month', now());

  v_cache_hit_rate := 0.0;

  -- Priority red queue (top 10)
  SELECT COALESCE(jsonb_agg(sub_q), '[]'::jsonb) INTO v_priority_red
  FROM (
    SELECT jsonb_build_object(
      'conversationId', c.id,
      'contactName', uc.display_name,
      'platform', c.platform,
      'waitingMinutes', ROUND(EXTRACT(EPOCH FROM (now() - c.last_message_at)) / 60)
    ) AS obj
    FROM conversations c
    INNER JOIN unified_contacts uc ON uc.id = c.unified_contact_id
    WHERE c.brand_id = p_brand_id AND c.priority_red = true
    ORDER BY c.last_message_at ASC
    LIMIT 10
  ) sub_q;

  -- Top 5 flows by conversion
  SELECT COALESCE(jsonb_agg(sub_q2), '[]'::jsonb) INTO v_top_flows
  FROM (
    SELECT jsonb_build_object(
      'id', f.id, 'name', f.name, 'status', f.status,
      'triggerType', f.trigger_type,
      'metrics', get_flow_metrics(f.id)
    ) AS obj
    FROM flows f
    WHERE f.brand_id = p_brand_id AND f.status = 'ACTIVE'
    ORDER BY f.conversion_count DESC NULLS LAST
    LIMIT 5
  ) sub_q2;

  RETURN jsonb_build_object(
    'metrics', jsonb_build_object(
      'dmsSentToday', jsonb_build_object('count', v_dms_sent_today),
      'activeFlows', jsonb_build_object('count', v_active_flows, 'pausedCount', v_paused_flows),
      'conversations24h', v_conversations_24h,
      'aiCreditsSaved', jsonb_build_object('amountUsd', v_ai_saved, 'cacheHitRate', v_cache_hit_rate)
    ),
    'priorityRedQueue', v_priority_red,
    'topFlows', v_top_flows
  );
END;
$$ LANGUAGE plpgsql STABLE;
