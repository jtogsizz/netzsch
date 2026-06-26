'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  FileText,
  BarChart2,
  Users,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'Databooks', icon: FileText, exact: true },
  { href: '/reports', label: 'Relatórios', icon: BarChart2 },
  { href: '/employees', label: 'Responsáveis', icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  // Iniciais do sistema para o avatar
  const initials = 'NZ';

  return (
    <nav className="sidebar" aria-label="Menu principal">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">NZ</div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-title">NETZSCH</span>
          <span className="sidebar-logo-sub">Databooks</span>
        </div>
      </div>

      {/* Navegacao principal */}
      <div className="sidebar-nav">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={cn('sidebar-nav-item', isActive(href, exact) && 'active')}
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
          </Link>
        ))}
      </div>

      {/* Footer com usuario e logout */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <span style={{ fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Sistema interno
          </span>
        </div>

        <button
          className="sidebar-nav-item"
          onClick={handleLogout}
          disabled={loggingOut}
          aria-label="Sair do sistema"
        >
          <LogOut size={15} strokeWidth={1.75} />
          {loggingOut ? 'Saindo...' : 'Sair'}
        </button>
      </div>
    </nav>
  );
}
