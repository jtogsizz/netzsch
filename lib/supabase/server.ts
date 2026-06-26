import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createMockSupabaseClient } from './mock-client';

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

