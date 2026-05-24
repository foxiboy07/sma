/*
  # Seed Demo Data

  Populate the database with realistic demo data for showcasing the FlowPulse platform.
*/

-- Create Tenant
INSERT INTO tenants (id, name, plan, owner_user_id, created_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'FlowPulse Demo',
  'PRO',
  '93ecf7e5-946f-42ad-a184-ab3b425572bb',
  NOW() - INTERVAL '30 days'
) ON CONFLICT (id) DO NOTHING;

-- Create Brand
INSERT INTO brands (id, tenant_id, name, timezone, persona_name, persona_tone, created_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440001',
  'Demo Brand',
  'America/New_York',
  'Alex',
  'friendly and helpful',
  NOW() - INTERVAL '30 days'
) ON CONFLICT (id) DO NOTHING;

-- Connected Accounts
INSERT INTO connected_accounts (id, tenant_id, brand_id, platform, platform_account_id, platform_username, encrypted_access_token, token_expires_at, health_status, last_webhook_at, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'INSTAGRAM', 'ig_17841400008460001', '@demobrand_official', 'encrypted_token_ig', NOW() + INTERVAL '60 days', 'HEALTHY', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '28 days'),
  ('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'FACEBOOK', 'fb_123456789012345', 'Demo Brand FB', 'encrypted_token_fb', NOW() + INTERVAL '45 days', 'HEALTHY', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '25 days'),
  ('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'TIKTOK', 'tt_683920481023948201', '@demobrand_tiktok', 'encrypted_token_tt', NOW() + INTERVAL '30 days', 'EXPIRING', NOW() - INTERVAL '1 day', NOW() - INTERVAL '15 days')
ON CONFLICT DO NOTHING;

-- Unified Contacts
INSERT INTO unified_contacts (id, tenant_id, brand_id, display_name, email, phone, loyalty_score, loyalty_tier, tags, notes, sentiment_score, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440100', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Sarah Johnson', 'sarah.j@email.com', '+1-555-0101', 92, 'ADVOCATE', ARRAY['vip', 'repeat-buyer'], 'Loves our spring collection.', 0.89, NOW() - INTERVAL '90 days'),
  ('550e8400-e29b-41d4-a716-446655440101', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Mike Chen', 'mike.chen@email.com', '+1-555-0102', 78, 'FAN', ARRAY['instagram', 'engaged'], 'High engagement on stories.', 0.72, NOW() - INTERVAL '60 days'),
  ('550e8400-e29b-41d4-a716-446655440102', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Emma Wilson', 'emma.wilson@email.com', '+1-555-0103', 65, 'FAN', ARRAY['tiktok', 'young-demo'], 'Asked about sizing.', 0.65, NOW() - INTERVAL '45 days'),
  ('550e8400-e29b-41d4-a716-446655440103', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'David Park', 'd.park@email.com', '+1-555-0104', 55, 'FAN', ARRAY['facebook'], 'Bought kids collection.', 0.61, NOW() - INTERVAL '30 days'),
  ('550e8400-e29b-41d4-a716-446655440104', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Lisa Thompson', 'lisa.t@email.com', '+1-555-0105', 88, 'ADVOCATE', ARRAY['vip', 'referral'], 'Referred 3 friends.', 0.91, NOW() - INTERVAL '120 days'),
  ('550e8400-e29b-41d4-a716-446655440105', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'James Rodriguez', NULL, '+1-555-0106', 35, 'NEWBIE', ARRAY['tiktok', 'new'], 'Just followed.', 0.55, NOW() - INTERVAL '10 days'),
  ('550e8400-e29b-41d4-a716-446655440106', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Amanda Lee', 'amanda.lee@email.com', NULL, 72, 'FAN', ARRAY['instagram'], 'Reply rate: 85%.', 0.78, NOW() - INTERVAL '75 days'),
  ('550e8400-e29b-41d4-a716-446655440107', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Chris Martin', 'chris.m@email.com', '+1-555-0108', 95, 'ADVOCATE', ARRAY['superfan', 'ugc'], 'Brand ambassador tier.', 0.96, NOW() - INTERVAL '180 days'),
  ('550e8400-e29b-41d4-a716-446655440108', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Jennifer Wu', 'j.wu@email.com', '+1-555-0109', 42, 'NEWBIE', ARRAY['facebook'], 'Cart abandoner.', 0.45, NOW() - INTERVAL '20 days'),
  ('550e8400-e29b-41d4-a716-446655440109', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Ryan Foster', 'ryan.f@email.com', '+1-555-0110', 68, 'FAN', ARRAY['tiktok'], 'Left 12 comments.', 0.68, NOW() - INTERVAL '50 days'),
  ('550e8400-e29b-41d4-a716-446655440110', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Nicole Adams', 'n.adams@email.com', '+1-555-0111', 31, 'NEWBIE', ARRAY['instagram'], 'First DM yesterday.', 0.52, NOW() - INTERVAL '3 days'),
  ('550e8400-e29b-41d4-a716-446655440111', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Thomas Kim', NULL, '+1-555-0112', 58, 'FAN', ARRAY['tiktok'], 'Shared our video.', 0.62, NOW() - INTERVAL '35 days'),
  ('550e8400-e29b-41d4-a716-446655440112', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Stephanie Brown', 'steph.b@email.com', '+1-555-0113', 85, 'ADVOCATE', ARRAY['vip', 'reviewer'], 'Left 5-star review.', 0.88, NOW() - INTERVAL '95 days'),
  ('550e8400-e29b-41d4-a716-446655440113', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Kevin Zhang', 'k.zhang@email.com', '+1-555-0114', 48, 'NEWBIE', ARRAY['facebook'], 'Asked about wholesale.', 0.58, NOW() - INTERVAL '25 days'),
  ('550e8400-e29b-41d4-a716-446655440114', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Maria Garcia', 'm.garcia@email.com', '+1-555-0115', 75, 'FAN', ARRAY['instagram'], 'Loves story polls.', 0.76, NOW() - INTERVAL '65 days'),
  ('550e8400-e29b-41d4-a716-446655440115', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Alex Turner', 'alex.t@email.com', '+1-555-0116', 62, 'FAN', ARRAY['tiktok'], 'Made 3 duets.', 0.64, NOW() - INTERVAL '40 days'),
  ('550e8400-e29b-41d4-a716-446655440116', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Rachel Green', 'r.green@email.com', '+1-555-0117', 91, 'ADVOCATE', ARRAY['vip'], 'Been with us 2 years.', 0.93, NOW() - INTERVAL '2 years'),
  ('550e8400-e29b-41d4-a716-446655440117', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Brandon Lee', 'b.lee@email.com', '+1-555-0118', 38, 'NEWBIE', ARRAY['facebook'], 'Browses often.', 0.48, NOW() - INTERVAL '15 days'),
  ('550e8400-e29b-41d4-a716-446655440118', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Sophia Martinez', 'sophia.m@email.com', '+1-555-0119', 82, 'ADVOCATE', ARRAY['instagram', 'influencer'], 'Micro-influencer 50k.', 0.84, NOW() - INTERVAL '85 days'),
  ('550e8400-e29b-41d4-a716-446655440119', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Daniel White', NULL, '+1-555-0120', 45, 'NEWBIE', ARRAY['tiktok'], 'Watches all our lives.', 0.55, NOW() - INTERVAL '12 days')
ON CONFLICT DO NOTHING;

-- Flows
INSERT INTO flows (id, tenant_id, brand_id, name, status, trigger_type, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440300', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Price Inquiry DM', 'ACTIVE', 'COMMENT_TO_DM', NOW() - INTERVAL '45 days', NOW() - INTERVAL '10 days'),
  ('550e8400-e29b-41d4-a716-446655440301', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Story Reply Lead', 'ACTIVE', 'STORY_REPLY', NOW() - INTERVAL '30 days', NOW() - INTERVAL '5 days'),
  ('550e8400-e29b-41d4-a716-446655440302', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Welcome New Followers', 'ACTIVE', 'FOLLOW_TO_DM', NOW() - INTERVAL '60 days', NOW() - INTERVAL '15 days'),
  ('550e8400-e29b-41d4-a716-446655440303', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'TikTok Comment to DM', 'ACTIVE', 'TIKTOK_COMMENT_TO_DM', NOW() - INTERVAL '20 days', NOW() - INTERVAL '2 days'),
  ('550e8400-e29b-41d4-a716-446655440304', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Bio Click Capture', 'ACTIVE', 'DEEPLINK_BIO_CLICK', NOW() - INTERVAL '15 days', NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- Conversations
INSERT INTO conversations (id, tenant_id, brand_id, unified_contact_id, platform, status, priority_red, sentiment_score, unread_count, last_message_at, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440400', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440100', 'INSTAGRAM', 'BOT', false, 0.89, 0, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '5 days'),
  ('550e8400-e29b-41d4-a716-446655440401', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440101', 'INSTAGRAM', 'BOT', false, 0.72, 2, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '3 days'),
  ('550e8400-e29b-41d4-a716-446655440402', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440102', 'TIKTOK', 'HUMAN', false, 0.65, 0, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 days'),
  ('550e8400-e29b-41d4-a716-446655440403', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440103', 'FACEBOOK', 'BOT', false, 0.61, 1, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '7 days'),
  ('550e8400-e29b-41d4-a716-446655440404', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440104', 'INSTAGRAM', 'BOT', false, 0.91, 0, NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '10 days'),
  ('550e8400-e29b-41d4-a716-446655440405', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440105', 'TIKTOK', 'BOT', false, 0.55, 0, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '1 day'),
  ('550e8400-e29b-41d4-a716-446655440406', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440106', 'INSTAGRAM', 'BOT', false, 0.78, 3, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '4 hours'),
  ('550e8400-e29b-41d4-a716-446655440407', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440107', 'INSTAGRAM', 'BOT', false, 0.96, 0, NOW() - INTERVAL '8 hours', NOW() - INTERVAL '15 days'),
  ('550e8400-e29b-41d4-a716-446655440408', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440108', 'FACEBOOK', 'HUMAN', true, 0.35, 0, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '8 hours'),
  ('550e8400-e29b-41d4-a716-446655440409', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440109', 'TIKTOK', 'BOT', false, 0.68, 1, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '6 days'),
  ('550e8400-e29b-41d4-a716-446655440410', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440110', 'INSTAGRAM', 'BOT', false, 0.52, 5, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '2 hours'),
  ('550e8400-e29b-41d4-a716-446655440412', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440112', 'INSTAGRAM', 'BOT', false, 0.88, 0, NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 days'),
  ('550e8400-e29b-41d4-a716-446655440413', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440113', 'FACEBOOK', 'HUMAN', true, 0.42, 0, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '5 hours'),
  ('550e8400-e29b-41d4-a716-446655440414', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440114', 'INSTAGRAM', 'BOT', false, 0.76, 2, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '4 days')
ON CONFLICT DO NOTHING;

-- Messages
INSERT INTO messages (id, conversation_id, tenant_id, direction, content, message_type, is_ai_generated, delivery_status, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440500', '550e8400-e29b-41d4-a716-446655440400', '550e8400-e29b-41d4-a716-446655440001', 'INBOUND', 'Hey! Do you have the blue hoodie in medium?', 'TEXT', false, 'DELIVERED', NOW() - INTERVAL '2 hours'),
  ('550e8400-e29b-41d4-a716-446655440501', '550e8400-e29b-41d4-a716-446655440400', '550e8400-e29b-41d4-a716-446655440001', 'OUTBOUND', 'Hi Sarah! Yes, we have the Ocean Blue Hoodie in Medium!', 'TEXT', true, 'DELIVERED', NOW() - INTERVAL '1 hour 55 minutes'),
  ('550e8400-e29b-41d4-a716-446655440502', '550e8400-e29b-41d4-a716-446655440400', '550e8400-e29b-41d4-a716-446655440001', 'INBOUND', 'Perfect! What''s the price?', 'TEXT', false, 'DELIVERED', NOW() - INTERVAL '1 hour 30 minutes'),
  ('550e8400-e29b-41d4-a716-446655440503', '550e8400-e29b-41d4-a716-446655440400', '550e8400-e29b-41d4-a716-446655440001', 'OUTBOUND', '$48 with free shipping! Use code SARAH10 for 10% off!', 'TEXT', true, 'DELIVERED', NOW() - INTERVAL '1 hour 28 minutes'),
  ('550e8400-e29b-41d4-a716-446655440504', '550e8400-e29b-41d4-a716-446655440400', '550e8400-e29b-41d4-a716-446655440001', 'INBOUND', 'Amazing! I''ll order now!', 'TEXT', false, 'DELIVERED', NOW() - INTERVAL '1 hour'),
  ('550e8400-e29b-41d4-a716-446655440505', '550e8400-e29b-41d4-a716-446655440400', '550e8400-e29b-41d4-a716-446655440001', 'OUTBOUND', 'You''re welcome! Let us know if you need anything else!', 'TEXT', true, 'DELIVERED', NOW() - INTERVAL '55 minutes'),
  ('550e8400-e29b-41d4-a716-446655440510', '550e8400-e29b-41d4-a716-446655440401', '550e8400-e29b-41d4-a716-446655440001', 'INBOUND', 'Love your content! Do you ship to Canada?', 'TEXT', false, 'DELIVERED', NOW() - INTERVAL '4 hours'),
  ('550e8400-e29b-41d4-a716-446655440511', '550e8400-e29b-41d4-a716-446655440401', '550e8400-e29b-41d4-a716-446655440001', 'OUTBOUND', 'Hey Mike! Yes! $12 shipping, 5-7 days.', 'TEXT', true, 'DELIVERED', NOW() - INTERVAL '3 hours 55 minutes'),
  ('550e8400-e29b-41d4-a716-446655440520', '550e8400-e29b-41d4-a716-446655440408', '550e8400-e29b-41d4-a716-446655440001', 'INBOUND', 'I ordered a week ago and still nothing. This is ridiculous.', 'TEXT', false, 'DELIVERED', NOW() - INTERVAL '5 hours'),
  ('550e8400-e29b-41d4-a716-446655440521', '550e8400-e29b-41d4-a716-446655440408', '550e8400-e29b-41d4-a716-446655440001', 'OUTBOUND', 'Hi Jennifer, I apologize for the delay. Let me check right away.', 'TEXT', true, 'DELIVERED', NOW() - INTERVAL '4 hours 58 minutes'),
  ('550e8400-e29b-41d4-a716-446655440522', '550e8400-e29b-41d4-a716-446655440408', '550e8400-e29b-41d4-a716-446655440001', 'INBOUND', 'I just want my money back at this point.', 'TEXT', false, 'DELIVERED', NOW() - INTERVAL '4 hours 30 minutes'),
  ('550e8400-e29b-41d4-a716-446655440523', '550e8400-e29b-41d4-a716-446655440408', '550e8400-e29b-41d4-a716-446655440001', 'OUTBOUND', 'I completely understand. I''m escalating this now. We''ll resolve this today.', 'TEXT', false, 'DELIVERED', NOW() - INTERVAL '4 hours 28 minutes'),
  ('550e8400-e29b-41d4-a716-446655440524', '550e8400-e29b-41d4-a716-446655440408', '550e8400-e29b-41d4-a716-446655440001', 'INBOUND', 'I''ve been waiting for 4 hours now. Is anyone actually going to help me?', 'TEXT', false, 'DELIVERED', NOW() - INTERVAL '20 minutes'),
  ('550e8400-e29b-41d4-a716-446655440530', '550e8400-e29b-41d4-a716-446655440413', '550e8400-e29b-41d4-a716-446655440001', 'INBOUND', 'I asked about wholesale pricing 3 days ago. Still no answer.', 'TEXT', false, 'DELIVERED', NOW() - INTERVAL '3 days'),
  ('550e8400-e29b-41d4-a716-446655440531', '550e8400-e29b-41d4-a716-446655440413', '550e8400-e29b-41d4-a716-446655440001', 'OUTBOUND', 'Hi Kevin, let me connect you with our wholesale team.', 'TEXT', true, 'DELIVERED', NOW() - INTERVAL '2 days 23 hours'),
  ('550e8400-e29b-41d4-a716-446655440532', '550e8400-e29b-41d4-a716-446655440413', '550e8400-e29b-41d4-a716-446655440001', 'INBOUND', 'Nobody contacted me. This is unprofessional.', 'TEXT', false, 'DELIVERED', NOW() - INTERVAL '4 hours'),
  ('550e8400-e29b-41d4-a716-446655440533', '550e8400-e29b-41d4-a716-446655440413', '550e8400-e29b-41d4-a716-446655440001', 'OUTBOUND', 'I sincerely apologize, Kevin. I''m personally handling this now.', 'TEXT', false, 'DELIVERED', NOW() - INTERVAL '3 hours 58 minutes'),
  ('550e8400-e29b-41d4-a716-446655440534', '550e8400-e29b-41d4-a716-446655440413', '550e8400-e29b-41d4-a716-446655440001', 'INBOUND', 'Waiting...', 'TEXT', false, 'DELIVERED', NOW() - INTERVAL '25 minutes'),
  ('550e8400-e29b-41d4-a716-446655440540', '550e8400-e29b-41d4-a716-446655440410', '550e8400-e29b-41d4-a716-446655440001', 'OUTBOUND', 'Hi there! Welcome to our community!', 'TEXT', true, 'DELIVERED', NOW() - INTERVAL '2 hours'),
  ('550e8400-e29b-41d4-a716-446655440541', '550e8400-e29b-41d4-a716-446655440410', '550e8400-e29b-41d4-a716-446655440001', 'INBOUND', 'Saw your TikTok! Love your style', 'TEXT', false, 'DELIVERED', NOW() - INTERVAL '1 hour 30 minutes'),
  ('550e8400-e29b-41d4-a716-446655440542', '550e8400-e29b-41d4-a716-446655440410', '550e8400-e29b-41d4-a716-446655440001', 'OUTBOUND', 'That makes us so happy! Which video did you see?', 'TEXT', true, 'DELIVERED', NOW() - INTERVAL '1 hour 28 minutes'),
  ('550e8400-e29b-41d4-a716-446655440543', '550e8400-e29b-41d4-a716-446655440410', '550e8400-e29b-41d4-a716-446655440001', 'INBOUND', 'The hoodie unboxing! So satisfying', 'TEXT', false, 'DELIVERED', NOW() - INTERVAL '1 hour'),
  ('550e8400-e29b-41d4-a716-446655440544', '550e8400-e29b-41d4-a716-446655440410', '550e8400-e29b-41d4-a716-446655440001', 'OUTBOUND', 'Glad you liked it! Available in 5 colors. Which do you like?', 'TEXT', true, 'DELIVERED', NOW() - INTERVAL '58 minutes'),
  ('550e8400-e29b-41d4-a716-446655440545', '550e8400-e29b-41d4-a716-446655440410', '550e8400-e29b-41d4-a716-446655440001', 'INBOUND', 'Ocean blue! What sizes?', 'TEXT', false, 'DELIVERED', NOW() - INTERVAL '10 minutes'),
  ('550e8400-e29b-41d4-a716-446655440546', '550e8400-e29b-41d4-a716-446655440410', '550e8400-e29b-41d4-a716-446655440001', 'OUTBOUND', 'XS through 2XL! It runs true to size.', 'TEXT', true, 'DELIVERED', NOW() - INTERVAL '8 minutes')
ON CONFLICT DO NOTHING;

-- Notifications
INSERT INTO notifications (id, tenant_id, user_id, type, title, description, is_read, action_url, created_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440800', '550e8400-e29b-41d4-a716-446655440001', '93ecf7e5-946f-42ad-a184-ab3b425572bb', 'inbox.new_message', 'New message from Sarah', 'Sarah sent you a message on Instagram', false, '/inbox', NOW() - INTERVAL '30 minutes'),
  ('550e8400-e29b-41d4-a716-446655440801', '550e8400-e29b-41d4-a716-446655440001', '93ecf7e5-946f-42ad-a184-ab3b425572bb', 'inbox.sentiment_alert', 'Priority Red: Frustrated customer', 'Jennifer Wu is showing negative sentiment', false, '/inbox', NOW() - INTERVAL '5 hours'),
  ('550e8400-e29b-41d4-a716-446655440802', '550e8400-e29b-41d4-a716-446655440001', '93ecf7e5-946f-42ad-a184-ab3b425572bb', 'account.token_broken', 'TikTok token expiring', 'Token expires in 30 days', true, '/health', NOW() - INTERVAL '2 days'),
  ('550e8400-e29b-41d4-a716-446655440803', '550e8400-e29b-41d4-a716-446655440001', '93ecf7e5-946f-42ad-a184-ab3b425572bb', 'inbox.new_message', 'New message from Mike', 'Mike sent you a message', true, '/inbox', NOW() - INTERVAL '5 hours')
ON CONFLICT DO NOTHING;