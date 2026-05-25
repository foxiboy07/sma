/*
  # Enhance KB Documents table and seed demo data
  
  ## New columns on kb_documents
  - content_preview: show a snippet of the document content
  - auto_reindex: auto-retrain flag (like Chatbase)
  - last_indexed_at: when content was last crawled/indexed
  - qa_question / qa_answer: structured Q&A pairs
  - crawl_depth: how deep to crawl URLs
  
  ## Demo data seeded
  - 7 documents: 2 URLs, 1 TEXT, 2 QA pairs, 1 pending, 1 failed
  - 5 chunks for indexed documents
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_documents' AND column_name = 'content_preview') THEN
    ALTER TABLE kb_documents ADD COLUMN content_preview TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_documents' AND column_name = 'auto_reindex') THEN
    ALTER TABLE kb_documents ADD COLUMN auto_reindex BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_documents' AND column_name = 'last_indexed_at') THEN
    ALTER TABLE kb_documents ADD COLUMN last_indexed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_documents' AND column_name = 'qa_question') THEN
    ALTER TABLE kb_documents ADD COLUMN qa_question TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_documents' AND column_name = 'qa_answer') THEN
    ALTER TABLE kb_documents ADD COLUMN qa_answer TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_documents' AND column_name = 'crawl_depth') THEN
    ALTER TABLE kb_documents ADD COLUMN crawl_depth INT DEFAULT 1;
  END IF;
END $$;

-- Seed demo KB documents
INSERT INTO kb_documents (id, tenant_id, brand_id, name, source_type, source_url, index_status, chunk_count, strictness, content_preview, auto_reindex, last_indexed_at, qa_question, qa_answer, crawl_depth)
VALUES
  ('550e8400-e29b-41d4-a716-446655440E01', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Shipping & Returns Policy', 'URL', 'https://demobrand.com/shipping', 'INDEXED', 8, 'BALANCED', 'Free standard shipping on orders over $50. Express shipping available for $9.99. Returns accepted within 30 days of purchase.', true, now() - interval '2 hours', NULL, NULL, 2),
  ('550e8400-e29b-41d4-a716-446655440E02', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Product Size Guide', 'URL', 'https://demobrand.com/size-guide', 'INDEXED', 5, 'STRICT', 'Our sizing runs true to standard US sizes. Hoodies and joggers have a relaxed fit.', false, now() - interval '1 day', NULL, NULL, 1),
  ('550e8400-e29b-41d4-a716-446655440E03', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Brand Story & Materials', 'TEXT', NULL, 'INDEXED', 6, 'BALANCED', 'Founded in 2023 with a mission to make sustainable streetwear accessible. 100% organic cotton, recycled polyester, water-based inks.', false, now() - interval '3 days', NULL, NULL, NULL),
  ('550e8400-e29b-41d4-a716-446655440E04', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'What is the return policy?', 'QA', NULL, 'INDEXED', 1, 'STRICT', NULL, false, now() - interval '5 days', 'What is the return policy?', 'We accept returns within 30 days of purchase. Items must be unworn with original tags. Send us a message for a prepaid label. Refunds processed in 5-7 days.', NULL),
  ('550e8400-e29b-41d4-a716-446655440E05', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Do you ship internationally?', 'QA', NULL, 'INDEXED', 1, 'BALANCED', NULL, false, now() - interval '5 days', 'Do you ship internationally?', 'Yes, we ship to over 40 countries. Standard international is $14.99 (7-14 days). Express is $24.99 (3-5 days).', NULL),
  ('550e8400-e29b-41d4-a716-446655440E06', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'FAQ Page', 'URL', 'https://demobrand.com/faq', 'PENDING', 0, 'BALANCED', 'Frequently asked questions about orders, shipping, materials, and sustainability.', true, NULL, NULL, NULL, 2),
  ('550e8400-e29b-41d4-a716-446655440E07', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Product Catalog 2024', 'PDF', NULL, 'FAILED', 0, 'BALANCED', NULL, false, now() - interval '7 days', NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Seed demo chunks
INSERT INTO kb_chunks (id, tenant_id, brand_id, document_id, chunk_index, content, token_count)
VALUES
  ('550e8400-e29b-41d4-a716-446655440F01', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440E01', 0, 'Free standard shipping on all orders over $50. Orders under $50 have a flat $4.99 shipping fee. Express shipping is available for $9.99 and delivers within 2-3 business days.', 42),
  ('550e8400-e29b-41d4-a716-446655440F02', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440E01', 1, 'Returns are accepted within 30 days of purchase. Items must be unworn with all original tags attached. To initiate a return, contact our support team via DM or email support@demobrand.com.', 38),
  ('550e8400-e29b-41d4-a716-446655440F03', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440E01', 2, 'Refunds are processed within 5-7 business days after we receive the returned item. The refund will be issued to the original payment method. Sale items are eligible for store credit only.', 40),
  ('550e8400-e29b-41d4-a716-446655440F04', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440E02', 0, 'Our sizing runs true to standard US sizes. Hoodies and joggers have a relaxed fit. We recommend sizing down if you prefer a slimmer look. Crop tops run slightly small — consider sizing up.', 36),
  ('550e8400-e29b-41d4-a716-446655440F05', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440E03', 0, 'FlowPulse Demo Brand was founded in 2023 with a mission to make sustainable streetwear accessible. We use 100% organic cotton certified by GOTS, recycled polyester from post-consumer plastic bottles, and water-based inks.', 38)
ON CONFLICT DO NOTHING;