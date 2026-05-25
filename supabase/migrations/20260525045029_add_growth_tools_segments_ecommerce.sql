/*
  # Add Growth Tools, Segments, and E-commerce Tables

  ## New Tables
  - `growth_tools` - QR codes, website widgets, click-to-message links, referral links
  - `segments` - Contact segments with filter rules for targeting
  - `ecommerce_products` - Product catalog synced from Shopify/WooCommerce
  - `ecommerce_orders` - Order tracking for abandoned cart recovery
  - `contact_segments` - Junction table linking contacts to segments

  ## Security
  - RLS enabled on all new tables with tenant isolation via owner_user_id
*/

-- Growth Tools
CREATE TABLE IF NOT EXISTS growth_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('qr_code', 'website_widget', 'click_to_message', 'referral_link')),
  name TEXT NOT NULL,
  platform platform_type,
  flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
  config JSONB NOT NULL DEFAULT '{}',
  qr_code_url TEXT,
  widget_snippet TEXT,
  referral_code TEXT UNIQUE,
  click_count INT NOT NULL DEFAULT 0,
  conversion_count INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE growth_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view growth tools"
  ON growth_tools FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tenants WHERE tenants.id = growth_tools.tenant_id AND tenants.owner_user_id = auth.uid()));

CREATE POLICY "Owners can insert growth tools"
  ON growth_tools FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tenants WHERE tenants.id = growth_tools.tenant_id AND tenants.owner_user_id = auth.uid()));

CREATE POLICY "Owners can update growth tools"
  ON growth_tools FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tenants WHERE tenants.id = growth_tools.tenant_id AND tenants.owner_user_id = auth.uid()));

CREATE POLICY "Owners can delete growth tools"
  ON growth_tools FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM tenants WHERE tenants.id = growth_tools.tenant_id AND tenants.owner_user_id = auth.uid()));

-- Segments
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  filter_rules JSONB NOT NULL DEFAULT '[]',
  is_static BOOLEAN NOT NULL DEFAULT false,
  member_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view segments"
  ON segments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tenants WHERE tenants.id = segments.tenant_id AND tenants.owner_user_id = auth.uid()));

CREATE POLICY "Owners can insert segments"
  ON segments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tenants WHERE tenants.id = segments.tenant_id AND tenants.owner_user_id = auth.uid()));

CREATE POLICY "Owners can update segments"
  ON segments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tenants WHERE tenants.id = segments.tenant_id AND tenants.owner_user_id = auth.uid()));

CREATE POLICY "Owners can delete segments"
  ON segments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM tenants WHERE tenants.id = segments.tenant_id AND tenants.owner_user_id = auth.uid()));

-- Contact Segments Junction
CREATE TABLE IF NOT EXISTS contact_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES unified_contacts(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contact_id, segment_id)
);

ALTER TABLE contact_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view contact segments"
  ON contact_segments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM segments s JOIN tenants t ON t.id = s.tenant_id WHERE s.id = contact_segments.segment_id AND t.owner_user_id = auth.uid()));

CREATE POLICY "Owners can insert contact segments"
  ON contact_segments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM segments s JOIN tenants t ON t.id = s.tenant_id WHERE s.id = contact_segments.segment_id AND t.owner_user_id = auth.uid()));

CREATE POLICY "Owners can delete contact segments"
  ON contact_segments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM segments s JOIN tenants t ON t.id = s.tenant_id WHERE s.id = contact_segments.segment_id AND t.owner_user_id = auth.uid()));

-- E-commerce Products
CREATE TABLE IF NOT EXISTS ecommerce_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  external_id TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('shopify', 'woocommerce', 'manual')),
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  compare_at_price NUMERIC(10,2),
  image_url TEXT,
  product_url TEXT,
  variants JSONB DEFAULT '[]',
  is_available BOOLEAN NOT NULL DEFAULT true,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ecommerce_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view products"
  ON ecommerce_products FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tenants WHERE tenants.id = ecommerce_products.tenant_id AND tenants.owner_user_id = auth.uid()));

CREATE POLICY "Owners can insert products"
  ON ecommerce_products FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tenants WHERE tenants.id = ecommerce_products.tenant_id AND tenants.owner_user_id = auth.uid()));

CREATE POLICY "Owners can update products"
  ON ecommerce_products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tenants WHERE tenants.id = ecommerce_products.tenant_id AND tenants.owner_user_id = auth.uid()));

CREATE POLICY "Owners can delete products"
  ON ecommerce_products FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM tenants WHERE tenants.id = ecommerce_products.tenant_id AND tenants.owner_user_id = auth.uid()));

-- E-commerce Orders
CREATE TABLE IF NOT EXISTS ecommerce_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES unified_contacts(id) ON DELETE SET NULL,
  external_order_id TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('shopify', 'woocommerce', 'manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'abandoned', 'processing', 'completed', 'cancelled', 'refunded')),
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  items JSONB NOT NULL DEFAULT '[]',
  checkout_url TEXT,
  recovery_flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
  recovered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ecommerce_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view orders"
  ON ecommerce_orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tenants WHERE tenants.id = ecommerce_orders.tenant_id AND tenants.owner_user_id = auth.uid()));

CREATE POLICY "Owners can insert orders"
  ON ecommerce_orders FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tenants WHERE tenants.id = ecommerce_orders.tenant_id AND tenants.owner_user_id = auth.uid()));

CREATE POLICY "Owners can update orders"
  ON ecommerce_orders FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tenants WHERE tenants.id = ecommerce_orders.tenant_id AND tenants.owner_user_id = auth.uid()));

-- Add abandoned cart flow to brands
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'abandoned_cart_flow_id') THEN
    ALTER TABLE brands ADD COLUMN abandoned_cart_flow_id UUID REFERENCES flows(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Seed demo products
INSERT INTO ecommerce_products (id, tenant_id, brand_id, title, description, price, image_url, source) VALUES
  ('550e8400-e29b-41d4-a716-446655440A01', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Ocean Blue Hoodie', 'Premium cotton hoodie in ocean blue. True to size.', 48.00, 'https://images.pexels.com/photos/102129/pexels-photo-102129.jpeg?auto=compress&w=400', 'manual'),
  ('550e8400-e29b-41d4-a716-446655440A02', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Midnight Joggers', 'Tech-fabric joggers with zip pockets.', 62.00, 'https://images.pexels.com/photos/1095814/pexels-photo-1095814.jpeg?auto=compress&w=400', 'manual'),
  ('550e8400-e29b-41d4-a716-446655440A03', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Classic White Tee', '100% organic cotton crew neck.', 28.00, 'https://images.pexels.com/photos/569885/pexels-photo-569885.jpeg?auto=compress&w=400', 'manual'),
  ('550e8400-e29b-41d4-a716-446655440A04', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Sunset Crop Top', 'Cropped tank with gradient sunset dye.', 35.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&w=400', 'manual'),
  ('550e8400-e29b-41d4-a716-446655440A05', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Street Cap', 'Adjustable snapback with embroidered logo.', 24.00, 'https://images.pexels.com/photos/984107/pexels-photo-984107.jpeg?auto=compress&w=400', 'manual')
ON CONFLICT DO NOTHING;

-- Seed demo segments
INSERT INTO segments (id, tenant_id, brand_id, name, description, filter_rules, member_count) VALUES
  ('550e8400-e29b-41d4-a716-446655440B01', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'VIP Customers', 'High-value repeat buyers', '[{"field":"loyalty_tier","operator":"eq","value":"ADVOCATE"}]', 5),
  ('550e8400-e29b-41d4-a716-446655440B02', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'New Followers', 'Contacted in last 14 days, no purchase', '[{"field":"loyalty_tier","operator":"eq","value":"NEWBIE"}]', 6),
  ('550e8400-e29b-41d4-a716-446655440B03', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Cart Abandoners', 'Added to cart but didn''t complete', '[{"field":"tags","operator":"contains","value":"cart-abandoner"}]', 1),
  ('550e8400-e29b-41d4-a716-446655440B04', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Instagram Engaged', 'High engagement on Instagram', '[{"field":"tags","operator":"contains","value":"instagram"}]', 7)
ON CONFLICT DO NOTHING;

-- Seed demo growth tools
INSERT INTO growth_tools (id, tenant_id, brand_id, type, name, platform, flow_id, config, qr_code_url, referral_code, click_count, conversion_count) VALUES
  ('550e8400-e29b-41d4-a716-446655440C01', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'qr_code', 'In-Store QR', 'INSTAGRAM', '550e8400-e29b-41d4-a716-446655440302', '{"foreground":"#3B82F6","size":400}', 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=ig.me/demobrand_official', NULL, 234, 45),
  ('550e8400-e29b-41d4-a716-446655440C02', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'click_to_message', 'Ad Click-to-DM', 'INSTAGRAM', '550e8400-e29b-41d4-a716-446655440300', '{"ad_id":"ig_ad_001"}', NULL, NULL, 1890, 312),
  ('550e8400-e29b-41d4-a716-446655440C03', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'website_widget', 'Homepage Chat', NULL, '550e8400-e29b-41d4-a716-446655440302', '{"position":"bottom-right","color":"#3B82F6","greeting":"Hey! How can we help?"}', NULL, NULL, 567, 89),
  ('550e8400-e29b-41d4-a716-446655440C04', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'referral_link', 'Ambassador Link', 'INSTAGRAM', '550e8400-e29b-41d4-a716-446655440302', '{"reward":"10% discount"}', NULL, 'DEMOBRAND10', 156, 34)
ON CONFLICT DO NOTHING;

-- Seed abandoned cart orders
INSERT INTO ecommerce_orders (id, tenant_id, brand_id, contact_id, source, status, total_price, items, checkout_url) VALUES
  ('550e8400-e29b-41d4-a716-446655440D01', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440108', 'manual', 'abandoned', 48.00, '[{"product":"Ocean Blue Hoodie","qty":1,"price":48.00}]', '/checkout/abc123'),
  ('550e8400-e29b-41d4-a716-446655440D02', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440117', 'manual', 'abandoned', 90.00, '[{"product":"Midnight Joggers","qty":1,"price":62.00},{"product":"Classic White Tee","qty":1,"price":28.00}]', '/checkout/def456')
ON CONFLICT DO NOTHING;