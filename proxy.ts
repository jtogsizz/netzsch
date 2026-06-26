import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Proxy de protecao de rotas (renomeado de middleware para proxy no Next.js 16).
// Verifica a sessao Supabase em cada request e redireciona para /login se nao autenticado.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: any;

  if (!url || url.includes('placeholder')) {
    const { createMockSupabaseClient } = eval('require')('./lib/supabase/mock-client');
    supabase = createMockSupabaseClient(request.cookies);
  } else {
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith('/login');
  const isApiRoute = pathname.startsWith('/api');

  // Rotas de API lidam com autenticacao internamente
  if (isApiRoute) {
    return supabaseResponse;
  }

  // Usuario nao autenticado tentando acessar rota protegida
  if (!user && !isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  // Usuario autenticado tentando acessar login — redireciona para dashboard
  if (user && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
