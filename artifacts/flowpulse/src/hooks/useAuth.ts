import { useState, useEffect, useCallback } from 'react';

const TOKEN_KEY = 'fp_token';
const BASE_URL = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthTenant {
  id: string;
  name: string;
  plan: 'FREE' | 'PRO' | 'LEGEND';
}

interface AuthBrand {
  id: string;
  name: string;
  tenantId: string;
  [key: string]: unknown;
}

interface AuthState {
  user: AuthUser | null;
  tenant: AuthTenant | null;
  brand: AuthBrand | null;
  loading: boolean;
  session: { access_token: string } | null;
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${BASE_URL}/api/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed: ${res.status}`);
  return body?.data ?? body;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    tenant: null,
    brand: null,
    loading: true,
  });

  const loadSession = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setState({ user: null, session: null, tenant: null, brand: null, loading: false });
      return;
    }
    try {
      const data = await apiFetch('auth/me');
      const brands = await apiFetch('brands').catch(() => []);
      setState({
        user: data.user,
        tenant: data.tenant,
        brand: Array.isArray(brands) ? (brands[0] ?? null) : null,
        session: { access_token: token },
        loading: false,
      });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setState({ user: null, session: null, tenant: null, brand: null, loading: false });
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  async function signIn(email: string, password: string) {
    try {
      const data = await apiFetch('auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      const brands = await apiFetch('brands').catch(() => []);
      setState({
        user: data.user,
        tenant: data.tenant,
        brand: Array.isArray(brands) ? (brands[0] ?? null) : null,
        session: { access_token: data.token },
        loading: false,
      });
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }

  async function signUp(email: string, password: string, name: string, tenantName?: string) {
    try {
      const data = await apiFetch('auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, tenantName: tenantName ?? name }),
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      const brands = await apiFetch('brands').catch(() => []);
      setState({
        user: data.user,
        tenant: data.tenant,
        brand: Array.isArray(brands) ? (brands[0] ?? null) : null,
        session: { access_token: data.token },
        loading: false,
      });
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }

  async function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    setState({ user: null, session: null, tenant: null, brand: null, loading: false });
  }

  return { ...state, signIn, signUp, signOut };
}
