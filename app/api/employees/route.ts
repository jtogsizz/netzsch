import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/employees — lista responsáveis ativos
export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST /api/employees — adiciona novo responsável
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const body = await request.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('employees')
    .insert({ name: body.name.trim(), active: body.active ?? true })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
