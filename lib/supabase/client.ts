import { createBrowserClient } from '@supabase/ssr';
import { createMockSupabaseClient } from './mock-client';

// Cliente Supabase para uso no browser (componentes Client).
// Usa apenas a chave anon — acesso controlado pelas regras de RLS.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes('placeholder')) {
    return createMockSupabaseClient();
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

