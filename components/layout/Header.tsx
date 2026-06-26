'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight, Search, Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { GlobalSearch } from './GlobalSearch';
import { NotificationPanel } from './NotificationPanel';
import type { AppNotification, Databook } from '@/types';

// Gera notificacoes derivadas dos dados de databooks
function buildNotifications(databooks: Databook[]): AppNotification[] {
  const now = new Date();
  const notifs: AppNotification[] = [];

  databooks.forEach((db) => {
    // Databooks proximos do prazo (menos de 7 dias)
    if (db.delivery_date && db.general_status !== 'Encerrado') {
      const delivery = new Date(db.delivery_date);
      const diffDays = Math.ceil((delivery.getTime() - now.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays <= 7) {
        notifs.push({
          id: `deadline-${db.id}`,
          type: 'overdue',
          title: `Prazo proximo: ${db.number}`,
          body: `${db.client_name ?? 'Cliente nao informado'} — entrega em ${diffDays === 0 ? 'hoje' : `${diffDays} dia${diffDays > 1 ? 's' : ''}`}`,
          databook_id: db.id,
          databook_number: db.number,
          timestamp: now.toISOString(),
          read: false,
        });
      }
      // Prazo vencido
      if (diffDays < 0) {
        notifs.push({
          id: `overdue-${db.id}`,
          type: 'overdue',
          title: `Prazo vencido: ${db.number}`,
          body: `${db.client_name ?? 'Cliente nao informado'} — venceu ha ${Math.abs(diffDays)} dia${Math.abs(diffDays) > 1 ? 's' : ''}`,
          databook_id: db.id,
          databook_number: db.number,
          timestamp: now.toISOString(),
          read: false,
        });
      }
    }

    // Databooks sem atualizacao ha mais de 30 dias
    if (db.general_status === 'Em andamento' && db.updated_at) {
      const updated = new Date(db.updated_at);
      const staleDays = Math.floor((now.getTime() - updated.getTime()) / 86400000);
      if (staleDays >= 30) {
        notifs.push({
          id: `stale-${db.id}`,
          type: 'stale',
          title: `Sem atualizacao: ${db.number}`,
          body: `Em andamento ha ${staleDays} dias sem alteracoes`,
          databook_id: db.id,
          databook_number: db.number,
          timestamp: db.updated_at,
          read: false,
        });
      }
    }
  });

  return notifs.slice(0, 20); // limita a 20 notificacoes
}

interface HeaderProps {
  userEmail?: string | null;
}

export function Header({ userEmail }: HeaderProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Carrega notificacoes em background ao montar
  useEffect(() => {
    async function loadNotifications() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('databooks')
          .select('id, number, client_name, delivery_date, general_status, updated_at')
          .in('general_status', ['Novo', 'Em andamento']);
        if (data) {
          setNotifications(buildNotifications(data as Databook[]));
        }
      } catch {
        // Ignorar silenciando erro
      }
    }
    loadNotifications();
  }, []);

  // Ctrl+K / Cmd+K abre a busca global
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const markRead = (id: string) =>
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Breadcrumbs derivados do pathname
  const breadcrumbs = buildBreadcrumbs(pathname);

  // Iniciais do usuario para avatar
  const avatarInitials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : 'NZ';

  return (
    <>
      <header className="main-header">
        {/* Breadcrumbs */}
        <nav className="header-breadcrumb" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {i > 0 && <ChevronRight size={13} className="header-breadcrumb-sep" />}
              <span className={`header-breadcrumb-item ${i === breadcrumbs.length - 1 ? 'current' : ''}`}>
                {crumb}
              </span>
            </span>
          ))}
        </nav>

        <div className="header-actions">
          {/* Busca global */}
          <button
            className="header-search-trigger"
            onClick={() => setSearchOpen(true)}
            aria-label="Busca global"
            title="Buscar (Ctrl+K)"
          >
            <Search size={14} />
            <span>Buscar...</span>
            <span className="kbd" style={{ marginLeft: 'auto', fontSize: '0.6875rem' }}>Ctrl K</span>
          </button>

          {/* Notificacoes */}
          <button
            className="header-icon-btn"
            onClick={() => setNotifOpen(true)}
            aria-label="Notificacoes"
            title="Notificacoes"
          >
            <Bell size={16} />
            {unreadCount > 0 && <span className="header-notif-dot" />}
          </button>

          {/* Usuario */}
          <div className="header-user">
            <div className="header-user-avatar">{avatarInitials}</div>
            {userEmail && (
              <span className="header-user-label">{userEmail}</span>
            )}
          </div>
        </div>
      </header>

      {/* Busca global */}
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      {/* Painel de notificacoes */}
      {notifOpen && (
        <NotificationPanel
          notifications={notifications}
          onClose={() => setNotifOpen(false)}
          onMarkAllRead={markAllRead}
          onMarkRead={markRead}
        />
      )}
    </>
  );
}

function buildBreadcrumbs(pathname: string): string[] {
  const MAP: Record<string, string> = {
    '/': 'Home',
    '/dashboard': 'Dashboard',
    '/databooks': 'Databooks',
    '/databooks/new': 'Novo Databook',
    '/reports': 'Relatorios',
    '/employees': 'Responsaveis',
  };

  if (MAP[pathname]) {
    return ['NETZSCH', MAP[pathname]];
  }

  if (pathname.startsWith('/databooks/') && pathname.endsWith('/edit')) {
    return ['NETZSCH', 'Databooks', 'Editar'];
  }

  if (pathname.startsWith('/databooks/')) {
    return ['NETZSCH', 'Databooks', 'Detalhes'];
  }

  return ['NETZSCH', 'Sistema'];
}
