import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get('table');

  let db = { employees: [], databooks: [], audit_logs: [] };
  try {
    const fs = eval('require')('fs');
    const path = eval('require')('path');
    const dbFile = path.join(process.cwd(), 'lib', 'supabase', 'mock_db.json');
    if (fs.existsSync(dbFile)) {
      db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    }
  } catch (error) {
    console.error('Error reading mock DB in API:', error);
  }

  if (table) {
    const data = db[table as keyof typeof db] || [];
    return NextResponse.json(data);
  }

  return NextResponse.json(db);
}
