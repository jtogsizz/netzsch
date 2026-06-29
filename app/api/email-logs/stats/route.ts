/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/email-logs/stats
// Retorna contagens para o dashboard de emails:
// - today:    emails recebidos hoje
// - pending:  aguardando revisão do operador
// - approved: criados no sistema pelo operador
// - blocked:  remetente não autorizado
export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  const [
    { count: today },
    { count: pending },
    { count: approved },
    { count: blocked },
  ] = await Promise.all([
    (supabase as any)
      .from('email_import_logs')
      .select('id', { count: 'exact', head: true })
      .gte('received_at', todayISO),
    (supabase as any)
      .from('email_import_logs')
      .select('id', { count: 'exact', head: true })
      .eq('queue_status', 'pending'),
    (supabase as any)
      .from('email_import_logs')
      .select('id', { count: 'exact', head: true })
      .eq('queue_status', 'approved'),
    (supabase as any)
      .from('email_import_logs')
      .select('id', { count: 'exact', head: true })
      .eq('queue_status', 'blocked'),
  ]);

  return NextResponse.json({
    today: today ?? 0,
    pending: pending ?? 0,
    approved: approved ?? 0,
    blocked: blocked ?? 0,
  });
}
