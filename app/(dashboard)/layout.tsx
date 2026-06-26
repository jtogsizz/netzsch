import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Busca o email do usuario autenticado para o header
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div>
      <Sidebar />
      <div className="main-layout">
        <Header userEmail={user?.email ?? null} />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
