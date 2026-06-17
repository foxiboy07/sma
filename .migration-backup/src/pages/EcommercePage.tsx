import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag,
  ShoppingCart,
  Link2,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  Tag,
  DollarSign,
  Clock,
  Send,
  Package,
  Zap,
  ImageOff,
  Store,
  TrendingUp,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  Button,
  Card,
  Modal,
  Badge,
  Tabs,
  Input,
  Select,
  EmptyState,
  MetricCard,
} from '../components/ui';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EcommerceProduct {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  product_url: string | null;
  source: 'shopify' | 'woocommerce' | 'manual';
  available: boolean;
  external_id: string | null;
  created_at: string;
}

interface AbandonedCart {
  id: string;
  tenant_id: string;
  contact_name: string;
  contact_id: string | null;
  items: CartItem[];
  total_price: number;
  currency: string;
  abandoned_at: string;
  status: 'abandoned' | 'recovered' | 'in_recovery';
  recovery_flow_id: string | null;
  checkout_url: string | null;
}

interface CartItem {
  title: string;
  quantity: number;
  price: number;
}

interface StoreConnection {
  platform: 'shopify' | 'woocommerce';
  connected: boolean;
  shop_url: string | null;
  last_synced_at: string | null;
  syncing: boolean;
}

interface ProductFormData {
  title: string;
  description: string;
  price: string;
  compare_at_price: string;
  image_url: string;
  product_url: string;
}

const EMPTY_PRODUCT_FORM: ProductFormData = {
  title: '',
  description: '',
  price: '',
  compare_at_price: '',
  image_url: '',
  product_url: '',
};

// ─── Demo / seed data helpers ─────────────────────────────────────────────────

const DEMO_PRODUCTS: EcommerceProduct[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440A01',
    tenant_id: '',
    title: 'Premium Wireless Headphones',
    description: 'Studio-quality sound with active noise cancellation.',
    price: 149.99,
    compare_at_price: 199.99,
    image_url: null,
    product_url: 'https://example.myshopify.com/products/headphones',
    source: 'shopify',
    available: true,
    external_id: 'shopify-7291',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440A02',
    tenant_id: '',
    title: 'Ergonomic Office Chair',
    description: 'All-day comfort with lumbar support and adjustable arms.',
    price: 349.0,
    compare_at_price: 499.0,
    image_url: null,
    product_url: 'https://example.myshopify.com/products/chair',
    source: 'shopify',
    available: true,
    external_id: 'shopify-7292',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440A03',
    tenant_id: '',
    title: 'Organic Green Tea Bundle',
    description: 'Hand-picked ceremonial grade matcha from Japan.',
    price: 39.99,
    compare_at_price: null,
    image_url: null,
    product_url: null,
    source: 'woocommerce',
    available: true,
    external_id: 'wc-1011',
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440A04',
    tenant_id: '',
    title: 'Custom Branded Tote Bag',
    description: 'Eco-friendly canvas tote with your logo.',
    price: 24.99,
    compare_at_price: null,
    image_url: null,
    product_url: null,
    source: 'manual',
    available: false,
    external_id: null,
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440A05',
    tenant_id: '',
    title: 'Smart Home Starter Kit',
    description: 'Everything you need to automate your home.',
    price: 199.99,
    compare_at_price: 249.99,
    image_url: null,
    product_url: 'https://example.myshopify.com/products/smarthome',
    source: 'shopify',
    available: true,
    external_id: 'shopify-7295',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

const DEMO_CARTS: AbandonedCart[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440D01',
    tenant_id: '',
    contact_name: 'Sophia Martinez',
    contact_id: 'contact-001',
    items: [
      { title: 'Premium Wireless Headphones', quantity: 1, price: 149.99 },
      { title: 'Smart Home Starter Kit', quantity: 1, price: 199.99 },
    ],
    total_price: 349.98,
    currency: 'USD',
    abandoned_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: 'abandoned',
    recovery_flow_id: null,
    checkout_url: 'https://example.myshopify.com/cart/recover?token=abc123',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440D02',
    tenant_id: '',
    contact_name: 'James Thornton',
    contact_id: 'contact-002',
    items: [{ title: 'Ergonomic Office Chair', quantity: 1, price: 349.0 }],
    total_price: 349.0,
    currency: 'USD',
    abandoned_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    status: 'recovered',
    recovery_flow_id: 'flow-recovery-001',
    checkout_url: null,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440D03',
    tenant_id: '',
    contact_name: 'Aisha Patel',
    contact_id: 'contact-003',
    items: [
      { title: 'Organic Green Tea Bundle', quantity: 2, price: 39.99 },
      { title: 'Custom Branded Tote Bag', quantity: 1, price: 24.99 },
    ],
    total_price: 104.97,
    currency: 'USD',
    abandoned_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    status: 'in_recovery',
    recovery_flow_id: 'flow-recovery-001',
    checkout_url: 'https://example.myshopify.com/cart/recover?token=def456',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440D04',
    tenant_id: '',
    contact_name: 'Marcus Webb',
    contact_id: 'contact-004',
    items: [{ title: 'Smart Home Starter Kit', quantity: 1, price: 199.99 }],
    total_price: 199.99,
    currency: 'USD',
    abandoned_at: new Date(Date.now() - 3600000 * 30).toISOString(),
    status: 'abandoned',
    recovery_flow_id: null,
    checkout_url: 'https://example.myshopify.com/cart/recover?token=ghi789',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function formatRelativeTime(isoString: string) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function sourceBadge(source: EcommerceProduct['source']) {
  if (source === 'shopify')
    return <Badge variant="success"><Store className="w-3 h-3" />Shopify</Badge>;
  if (source === 'woocommerce')
    return <Badge variant="info"><Store className="w-3 h-3" />WooCommerce</Badge>;
  return <Badge variant="default"><Tag className="w-3 h-3" />Manual</Badge>;
}

function cartStatusBadge(status: AbandonedCart['status']) {
  if (status === 'recovered')
    return <Badge variant="success"><CheckCircle2 className="w-3 h-3" />Recovered</Badge>;
  if (status === 'in_recovery')
    return <Badge variant="warning"><Loader2 className="w-3 h-3 animate-spin" />In Recovery</Badge>;
  return <Badge variant="danger"><XCircle className="w-3 h-3" />Abandoned</Badge>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProductImagePlaceholder({ title }: { title: string }) {
  const initials = title
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#111318] text-[#4B5068]">
      <ImageOff className="w-6 h-6" />
      <span className="text-xs font-medium">{initials}</span>
    </div>
  );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────

interface ProductsTabProps {
  tenantId: string | null;
}

function ProductsTab({ tenantId }: ProductsTabProps) {
  const [products, setProducts] = useState<EcommerceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<EcommerceProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EcommerceProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<ProductFormData>(EMPTY_PRODUCT_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    if (!tenantId) {
      setProducts(DEMO_PRODUCTS);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('ecommerce_products')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProducts((data as EcommerceProduct[]) ?? DEMO_PRODUCTS);
    } catch {
      setProducts(DEMO_PRODUCTS);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  function openAdd() {
    setForm(EMPTY_PRODUCT_FORM);
    setFormError(null);
    setEditTarget(null);
    setShowAddModal(true);
  }

  function openEdit(p: EcommerceProduct) {
    setForm({
      title: p.title,
      description: p.description ?? '',
      price: String(p.price),
      compare_at_price: p.compare_at_price != null ? String(p.compare_at_price) : '',
      image_url: p.image_url ?? '',
      product_url: p.product_url ?? '',
    });
    setFormError(null);
    setEditTarget(p);
    setShowAddModal(true);
  }

  async function handleSave() {
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    if (!form.price || isNaN(Number(form.price))) { setFormError('A valid price is required.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        tenant_id: tenantId ?? 'demo',
        title: form.title.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        compare_at_price: form.compare_at_price ? parseFloat(form.compare_at_price) : null,
        image_url: form.image_url.trim() || null,
        product_url: form.product_url.trim() || null,
        source: 'manual' as const,
        available: true,
      };
      if (editTarget) {
        if (tenantId) {
          await supabase.from('ecommerce_products').update(payload).eq('id', editTarget.id);
        }
        setProducts(prev =>
          prev.map(p => p.id === editTarget.id ? { ...p, ...payload } : p),
        );
      } else {
        if (tenantId) {
          const { data } = await supabase.from('ecommerce_products').insert(payload).select().single();
          if (data) setProducts(prev => [data as EcommerceProduct, ...prev]);
        } else {
          const newProduct: EcommerceProduct = {
            id: crypto.randomUUID(),
            ...payload,
            external_id: null,
            created_at: new Date().toISOString(),
          };
          setProducts(prev => [newProduct, ...prev]);
        }
      }
      setShowAddModal(false);
    } catch (e: any) {
      setFormError(e?.message ?? 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (tenantId) {
        await supabase.from('ecommerce_products').delete().eq('id', deleteTarget.id);
      }
      setProducts(prev => prev.filter(p => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // silent
    } finally {
      setDeleting(false);
    }
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
    const matchSource = sourceFilter === 'all' || p.source === sourceFilter;
    return matchSearch && matchSource;
  });

  const totalProducts = products.length;
  const availableCount = products.filter(p => p.available).length;
  const shopifyCount = products.filter(p => p.source === 'shopify').length;

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          label="Total Products"
          value={totalProducts}
          icon={<Package className="w-4 h-4" />}
          iconColor="text-blue-400"
          subtitle={`${availableCount} available`}
        />
        <MetricCard
          label="Shopify Synced"
          value={shopifyCount}
          icon={<Store className="w-4 h-4" />}
          iconColor="text-green-400"
          subtitle="from Shopify store"
        />
        <MetricCard
          label="Manual Products"
          value={products.filter(p => p.source === 'manual').length}
          icon={<Tag className="w-4 h-4" />}
          iconColor="text-purple-400"
          subtitle="added manually"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4B5068]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            className="h-9 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-[#F0F2FF] placeholder:text-[#4B5068] pl-9 pr-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <Select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          options={[
            { value: 'all', label: 'All Sources' },
            { value: 'shopify', label: 'Shopify' },
            { value: 'woocommerce', label: 'WooCommerce' },
            { value: 'manual', label: 'Manual' },
          ]}
          className="w-40"
        />
        <div className="ml-auto">
          <Button variant="primary" size="default" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-[#111318] border border-[#2A2E42] rounded-xl overflow-hidden animate-pulse">
              <div className="h-40 bg-[#1A1C24]" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-[#1A1C24] rounded w-3/4" />
                <div className="h-3 bg-[#1A1C24] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-8 h-8" />}
          title={search || sourceFilter !== 'all' ? 'No matching products' : 'No products yet'}
          description={
            search || sourceFilter !== 'all'
              ? 'Try adjusting your search or filter.'
              : 'Add products manually or connect your Shopify/WooCommerce store to sync products automatically.'
          }
          action={
            !search && sourceFilter === 'all' ? (
              <Button variant="primary" size="sm" onClick={openAdd}>
                <Plus className="w-4 h-4" />
                Add First Product
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(product => (
            <div
              key={product.id}
              className="group bg-[#111318] border border-[#2A2E42] rounded-xl overflow-hidden hover:border-blue-500/30 transition-all duration-150"
            >
              {/* Image */}
              <div className="relative h-40 bg-[#1A1C24] overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    className="w-full h-full object-cover"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <ProductImagePlaceholder title={product.title} />
                )}
                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => openEdit(product)}
                    className="p-2 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-[#8B90A7] hover:text-[#F0F2FF] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(product)}
                    className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {product.product_url && (
                    <a
                      href={product.product_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-[#8B90A7] hover:text-[#F0F2FF] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                {/* Availability */}
                {!product.available && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="danger">Out of stock</Badge>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3 space-y-2">
                <p className="text-xs font-semibold text-[#F0F2FF] leading-tight line-clamp-2">
                  {product.title}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-[#F0F2FF]">
                    {formatCurrency(product.price)}
                  </span>
                  {product.compare_at_price && (
                    <span className="text-xs text-[#4B5068] line-through">
                      {formatCurrency(product.compare_at_price)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {sourceBadge(product.source)}
                  {product.available ? (
                    <Badge variant="success">In stock</Badge>
                  ) : (
                    <Badge variant="danger">Unavailable</Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editTarget ? 'Edit Product' : 'Add Product'}
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {editTarget ? 'Save Changes' : 'Add Product'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {formError}
            </div>
          )}
          <Input
            label="Product Title *"
            placeholder="e.g. Premium Wireless Headphones"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#8B90A7]">Description</label>
            <textarea
              className="w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-[#F0F2FF] placeholder:text-[#4B5068] px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-y min-h-[72px]"
              placeholder="Short product description…"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Price *"
              placeholder="0.00"
              type="number"
              min="0"
              step="0.01"
              leftIcon={<DollarSign className="w-3.5 h-3.5" />}
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            />
            <Input
              label="Compare-at Price"
              placeholder="0.00"
              type="number"
              min="0"
              step="0.01"
              leftIcon={<DollarSign className="w-3.5 h-3.5" />}
              value={form.compare_at_price}
              onChange={e => setForm(f => ({ ...f, compare_at_price: e.target.value }))}
            />
          </div>
          <Input
            label="Image URL"
            placeholder="https://…"
            value={form.image_url}
            onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
          />
          <Input
            label="Product URL"
            placeholder="https://…"
            value={form.product_url}
            onChange={e => setForm(f => ({ ...f, product_url: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Product"
        maxWidth="max-w-sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#8B90A7]">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-[#F0F2FF]">{deleteTarget?.title}</span>? This
          action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

// ─── Abandoned Carts Tab ──────────────────────────────────────────────────────

interface AbandonedCartsTabProps {
  tenantId: string | null;
}

function AbandonedCartsTab({ tenantId }: AbandonedCartsTabProps) {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const loadCarts = useCallback(async () => {
    setLoading(true);
    if (!tenantId) {
      setCarts(DEMO_CARTS);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('ecommerce_orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'abandoned')
        .order('abandoned_at', { ascending: false });
      if (error) throw error;
      setCarts((data as AbandonedCart[]) ?? DEMO_CARTS);
    } catch {
      setCarts(DEMO_CARTS);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadCarts(); }, [loadCarts]);

  async function sendRecoveryDM(cart: AbandonedCart) {
    setSendingId(cart.id);
    try {
      if (tenantId) {
        await supabase
          .from('ecommerce_orders')
          .update({ status: 'in_recovery', recovery_flow_id: 'flow-recovery-001' })
          .eq('id', cart.id);
      }
      setCarts(prev =>
        prev.map(c =>
          c.id === cart.id ? { ...c, status: 'in_recovery', recovery_flow_id: 'flow-recovery-001' } : c,
        ),
      );
      setSuccessId(cart.id);
      setTimeout(() => setSuccessId(null), 2500);
    } finally {
      setSendingId(null);
    }
  }

  const filtered =
    statusFilter === 'all' ? carts : carts.filter(c => c.status === statusFilter);

  const totalAbandoned = carts.filter(c => c.status === 'abandoned').length;
  const totalRecovered = carts.filter(c => c.status === 'recovered').length;
  const totalRevenue = carts.filter(c => c.status === 'recovered').reduce((s, c) => s + c.total_price, 0);
  const recoveryRate =
    carts.length > 0 ? Math.round((totalRecovered / carts.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Abandoned"
          value={totalAbandoned}
          icon={<ShoppingCart className="w-4 h-4" />}
          iconColor="text-red-400"
          subtitle="awaiting recovery"
        />
        <MetricCard
          label="Recovered"
          value={totalRecovered}
          icon={<CheckCircle2 className="w-4 h-4" />}
          iconColor="text-green-400"
          subtitle="orders saved"
        />
        <MetricCard
          label="Recovery Rate"
          value={`${recoveryRate}%`}
          icon={<TrendingUp className="w-4 h-4" />}
          iconColor="text-blue-400"
          subtitle="of all carts"
        />
        <MetricCard
          label="Revenue Recovered"
          value={formatCurrency(totalRevenue)}
          icon={<DollarSign className="w-4 h-4" />}
          iconColor="text-amber-400"
          subtitle="via DM flows"
        />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          options={[
            { value: 'all', label: 'All Carts' },
            { value: 'abandoned', label: 'Abandoned' },
            { value: 'in_recovery', label: 'In Recovery' },
            { value: 'recovered', label: 'Recovered' },
          ]}
          className="w-44"
        />
        <span className="text-xs text-[#4B5068]">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-[#111318] border border-[#2A2E42] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="w-8 h-8" />}
          title="No abandoned carts"
          description="When shoppers leave your store without completing checkout, they'll appear here for recovery."
        />
      ) : (
        <div className="bg-[#111318] border border-[#2A2E42] rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[#2A2E42]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[#8B90A7] uppercase tracking-wider">
                  Contact
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#8B90A7] uppercase tracking-wider">
                  Items
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[#8B90A7] uppercase tracking-wider">
                  Total
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#8B90A7] uppercase tracking-wider">
                  Abandoned
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#8B90A7] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[#8B90A7] uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2130]">
              {filtered.map(cart => (
                <tr key={cart.id} className="hover:bg-[#1A1C24]/40 transition-colors">
                  {/* Contact */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-bold shrink-0">
                        {cart.contact_name.charAt(0)}
                      </div>
                      <span className="font-medium text-[#F0F2FF]">{cart.contact_name}</span>
                    </div>
                  </td>
                  {/* Items */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {cart.items.map((item, idx) => (
                        <Badge key={idx} variant="default">
                          {item.quantity > 1 && (
                            <span className="text-blue-400 font-bold">{item.quantity}×</span>
                          )}
                          {item.title.length > 22 ? item.title.slice(0, 22) + '…' : item.title}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  {/* Total */}
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-[#F0F2FF]">
                      {formatCurrency(cart.total_price, cart.currency)}
                    </span>
                  </td>
                  {/* Time */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-[#8B90A7]">
                      <Clock className="w-3 h-3 shrink-0" />
                      {formatRelativeTime(cart.abandoned_at)}
                    </div>
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">{cartStatusBadge(cart.status)}</td>
                  {/* Action */}
                  <td className="px-4 py-3 text-right">
                    {cart.status === 'recovered' ? (
                      <span className="text-xs text-green-400 flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Recovered
                      </span>
                    ) : successId === cart.id ? (
                      <span className="text-xs text-green-400 flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        DM Sent!
                      </span>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        loading={sendingId === cart.id}
                        disabled={cart.status === 'in_recovery'}
                        onClick={() => sendRecoveryDM(cart)}
                      >
                        <Send className="w-3 h-3" />
                        {cart.status === 'in_recovery' ? 'Sent' : 'Send Recovery DM'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────

interface IntegrationsTabProps {
  tenantId: string | null;
}

function IntegrationsTab({ tenantId }: IntegrationsTabProps) {
  const [shopify, setShopify] = useState<StoreConnection>({
    platform: 'shopify',
    connected: false,
    shop_url: null,
    last_synced_at: null,
    syncing: false,
  });
  const [woocommerce, setWoocommerce] = useState<StoreConnection>({
    platform: 'woocommerce',
    connected: false,
    shop_url: null,
    last_synced_at: null,
    syncing: false,
  });
  const [showShopifyModal, setShowShopifyModal] = useState(false);
  const [showWooModal, setShowWooModal] = useState(false);
  const [shopifyUrl, setShopifyUrl] = useState('');
  const [wooUrl, setWooUrl] = useState('');
  const [wooKey, setWooKey] = useState('');
  const [wooSecret, setWooSecret] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  async function connectShopify() {
    if (!shopifyUrl.trim()) { setConnectError('Enter your Shopify store URL.'); return; }
    setConnecting(true);
    setConnectError(null);
    await new Promise(r => setTimeout(r, 1200));
    setShopify({
      platform: 'shopify',
      connected: true,
      shop_url: shopifyUrl.trim(),
      last_synced_at: new Date().toISOString(),
      syncing: false,
    });
    setShowShopifyModal(false);
    setShopifyUrl('');
    setConnecting(false);
  }

  async function connectWooCommerce() {
    if (!wooUrl.trim()) { setConnectError('Enter your WooCommerce store URL.'); return; }
    if (!wooKey.trim() || !wooSecret.trim()) { setConnectError('API Key and Secret are required.'); return; }
    setConnecting(true);
    setConnectError(null);
    await new Promise(r => setTimeout(r, 1200));
    setWoocommerce({
      platform: 'woocommerce',
      connected: true,
      shop_url: wooUrl.trim(),
      last_synced_at: new Date().toISOString(),
      syncing: false,
    });
    setShowWooModal(false);
    setWooUrl('');
    setWooKey('');
    setWooSecret('');
    setConnecting(false);
  }

  function disconnect(platform: 'shopify' | 'woocommerce') {
    if (platform === 'shopify') {
      setShopify({ platform: 'shopify', connected: false, shop_url: null, last_synced_at: null, syncing: false });
    } else {
      setWoocommerce({ platform: 'woocommerce', connected: false, shop_url: null, last_synced_at: null, syncing: false });
    }
  }

  async function syncNow(platform: 'shopify' | 'woocommerce') {
    const set = platform === 'shopify' ? setShopify : setWoocommerce;
    set(prev => ({ ...prev, syncing: true }));
    await new Promise(r => setTimeout(r, 1800));
    set(prev => ({ ...prev, syncing: false, last_synced_at: new Date().toISOString() }));
  }

  const storeCard = (conn: StoreConnection) => {
    const isShopify = conn.platform === 'shopify';
    const platformLabel = isShopify ? 'Shopify' : 'WooCommerce';
    const platformColor = isShopify ? '#96BF48' : '#7F54B3';
    const openModal = () => {
      setConnectError(null);
      if (isShopify) setShowShopifyModal(true);
      else setShowWooModal(true);
    };

    return (
      <Card className="flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0"
              style={{ backgroundColor: platformColor }}
            >
              {platformLabel.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#F0F2FF]">{platformLabel}</p>
              {conn.connected ? (
                <span className="flex items-center gap-1 text-[10px] text-green-400 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected{conn.shop_url ? ` · ${conn.shop_url}` : ''}
                </span>
              ) : (
                <span className="text-[10px] text-[#4B5068] mt-0.5 block">Not connected</span>
              )}
            </div>
          </div>
          {conn.connected && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">Live</span>
            </div>
          )}
        </div>

        <p className="text-xs text-[#8B90A7] mb-4">
          {isShopify
            ? 'Sync products, orders, and abandoned cart data directly from your Shopify store.'
            : 'Integrate with WooCommerce to pull product catalog and order events in real-time.'}
        </p>

        {conn.connected && (
          <div className="mb-4 p-3 rounded-lg bg-[#0A0B0F] border border-[#2A2E42] space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#4B5068]">Store URL</span>
              <a
                href={`https://${conn.shop_url}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                {conn.shop_url}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#4B5068]">Last synced</span>
              <span className="text-[#8B90A7]">
                {conn.last_synced_at ? formatRelativeTime(conn.last_synced_at) : 'Never'}
              </span>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="space-y-1.5 mb-5">
          {(isShopify
            ? ['Product catalog sync', 'Abandoned cart detection', 'Order status updates', 'Customer data enrichment']
            : ['Product catalog sync', 'Order webhooks', 'Inventory updates', 'Customer profiles']
          ).map(f => (
            <div key={f} className="flex items-center gap-2 text-xs text-[#8B90A7]">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${conn.connected ? 'bg-green-400' : 'bg-[#2A2E42]'}`} />
              {f}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {conn.connected ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                loading={conn.syncing}
                onClick={() => syncNow(conn.platform)}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${conn.syncing ? 'animate-spin' : ''}`} />
                {conn.syncing ? 'Syncing…' : 'Sync Now'}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => disconnect(conn.platform)}
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" className="flex-1" onClick={openModal}>
              <Link2 className="w-3.5 h-3.5" />
              Connect {platformLabel}
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Store cards */}
      <div className="flex flex-col md:flex-row gap-4">
        {storeCard(shopify)}
        {storeCard(woocommerce)}
      </div>

      {/* Webhook info */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-[#F0F2FF]">Webhook Endpoint</h3>
        </div>
        <p className="text-xs text-[#8B90A7] mb-3">
          Use this endpoint to send real-time events from your store to FlowPulse.
        </p>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#0A0B0F] border border-[#2A2E42]">
          <code className="text-xs font-mono text-blue-400 flex-1 truncate">
            https://api.flowpulse.io/webhooks/ecommerce/{tenantId ?? '<tenant_id>'}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(`https://api.flowpulse.io/webhooks/ecommerce/${tenantId ?? ''}`)}
            className="text-xs text-[#8B90A7] hover:text-[#F0F2FF] transition-colors px-2 py-1 rounded border border-[#2A2E42] hover:border-[#4B5068]"
          >
            Copy
          </button>
        </div>
      </Card>

      {/* Shopify Connect Modal */}
      <Modal
        open={showShopifyModal}
        onClose={() => { setShowShopifyModal(false); setConnectError(null); }}
        title="Connect Shopify Store"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowShopifyModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={connecting} onClick={connectShopify}>
              Connect Store
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {connectError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {connectError}
            </div>
          )}
          <p className="text-xs text-[#8B90A7]">
            Enter your Shopify store URL to begin syncing products and abandoned cart data.
          </p>
          <Input
            label="Shopify Store URL"
            placeholder="yourstore.myshopify.com"
            value={shopifyUrl}
            onChange={e => setShopifyUrl(e.target.value)}
          />
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-1">
            <p className="font-semibold text-blue-400">Required Shopify permissions:</p>
            <p>• Read products &amp; inventory</p>
            <p>• Read orders &amp; abandoned checkouts</p>
            <p>• Read customers</p>
          </div>
        </div>
      </Modal>

      {/* WooCommerce Connect Modal */}
      <Modal
        open={showWooModal}
        onClose={() => { setShowWooModal(false); setConnectError(null); }}
        title="Connect WooCommerce Store"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowWooModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={connecting} onClick={connectWooCommerce}>
              Connect Store
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {connectError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {connectError}
            </div>
          )}
          <p className="text-xs text-[#8B90A7]">
            Connect your WooCommerce store using REST API credentials. Generate them in
            WooCommerce → Settings → Advanced → REST API.
          </p>
          <Input
            label="Store URL"
            placeholder="https://yourstore.com"
            value={wooUrl}
            onChange={e => setWooUrl(e.target.value)}
          />
          <Input
            label="Consumer Key"
            placeholder="ck_••••••••••••••••"
            value={wooKey}
            onChange={e => setWooKey(e.target.value)}
          />
          <Input
            label="Consumer Secret"
            placeholder="cs_••••••••••••••••"
            value={wooSecret}
            onChange={e => setWooSecret(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function EcommercePage() {
  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState('products');

  const tabs = [
    { id: 'products', label: 'Products', badge: undefined },
    { id: 'abandoned_carts', label: 'Abandoned Carts' },
    { id: 'integrations', label: 'Integrations' },
  ];

  return (
    <div className="min-h-full bg-[#0A0B0F] p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-blue-400" />
              </div>
              <h1 className="text-xl font-bold text-[#F0F2FF]">E-Commerce</h1>
            </div>
            <p className="text-xs text-[#8B90A7] ml-[42px]">
              Manage products, recover abandoned carts, and connect your store.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          tabs={tabs}
          active={activeTab}
          onChange={setActiveTab}
          className="w-fit"
        />

        {/* Tab content */}
        {activeTab === 'products' && (
          <ProductsTab tenantId={tenant?.id ?? null} />
        )}
        {activeTab === 'abandoned_carts' && (
          <AbandonedCartsTab tenantId={tenant?.id ?? null} />
        )}
        {activeTab === 'integrations' && (
          <IntegrationsTab tenantId={tenant?.id ?? null} />
        )}
      </div>
    </div>
  );
}
