import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createMockSupabaseClient } from './mock-client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Cliente Supabase para uso em Server Components, Route Handlers e Server Actions.
// Lê o cookie da sessão para autenticar o usuário no servidor.
export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url || url.includes('placeholder')) {
    return createMockSupabaseClient(cookieStore);
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll em Server Components é inofensivo — o middleware garante a persistência
          }
        },
      },
    }
  );
}

// Cliente administrativo com service_role — NUNCA exportar para o browser.
// Usado apenas em Route Handlers para operações que bypassam RLS (ex: audit logs via trigger).
export async function createAdminClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url || url.includes('placeholder')) {
    return createMockSupabaseClient(cookieStore);
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// Cliente de serviço sem cookies — para webhooks/inbound sem sessão de usuário.
// Usa SUPABASE_SECRET_KEY e bypassa RLS via service_role. NUNCA expor ao browser.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url || url.includes('placeholder') || !secret) {
    // Stub mínimo para desenvolvimento sem Supabase configurado
    return {
      from: () => ({
        insert: () => Promise.resolve({ data: null, error: null }),
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof createSupabaseClient>;
  }

  return createSupabaseClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
