import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { setApiSessionToken } from '../lib/api';
import { Tenant, Brand } from '../types';

interface AuthState {
  user: User | null;
  session: Session | null;
  tenant: Tenant | null;
  brand: Brand | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    tenant: null,
    brand: null,
    loading: true,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({ ...prev, session, user: session?.user ?? null }));
      setApiSessionToken(session?.access_token ?? null);
      if (session?.user) loadTenantData(session.user.id);
      else setState(prev => ({ ...prev, loading: false }));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setState(prev => ({ ...prev, session, user: session?.user ?? null }));
      setApiSessionToken(session?.access_token ?? null);
      if (session?.user) {
        (async () => { await loadTenantData(session.user.id); })();
      } else {
        setState(prev => ({ ...prev, tenant: null, brand: null, loading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadTenantData(userId: string) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('owner_user_id', userId)
      .maybeSingle();

    if (tenant) {
      const { data: brand } = await supabase
        .from('brands')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      setState(prev => ({ ...prev, tenant, brand, loading: false }));
    } else {
      setState(prev => ({ ...prev, loading: false }));
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signUp(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) return { error };

    const { data: tenant } = await supabase
      .from('tenants')
      .insert({ name, owner_user_id: data.user.id, plan: 'FREE' })
      .select()
      .single();

    if (tenant) {
      await supabase.from('brands').insert({
        tenant_id: tenant.id,
        name,
        timezone: 'UTC',
      });
    }

    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { ...state, signIn, signUp, signOut };
}
