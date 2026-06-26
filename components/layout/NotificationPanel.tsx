'use client';

import { X, Bell, AlertCircle, Clock, FileText, TrendingUp } from 'lucide-react';
import type { AppNotification, NotificationType } from '@/types';
import { formatDateTime } from '@/lib/utils';

interface NotificationPanelProps {
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
}

const TYPE_ICON: Record<NotificationType, { icon: typeof Bell; bg: string; color: string }> = {
  new: { icon: FileText, bg: '#f0fdf4', color: '#16a34a' },
  overdue: { icon: AlertCircle, bg: '#fef2f2', color: '#dc2626' },
  stale: { icon: Clock, bg: '#fffbeb', color: '#d97706' },
  change: { icon: TrendingUp, bg: 'var(--brand-50)', color: 'var(--brand-600)' },
};


export function NotificationPanel({ notifications, onClose, onMarkAllRead, onMarkRead }: NotificationPanelProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <div className="side-panel-backdrop" onClick={onClose} />
      <div className="side-panel">
        <div className="side-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <h2 className="side-panel-title">Notificacoes</h2>
            {unreadCount > 0 && (
              <span
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '1px 7px',
                  borderRadius: '10px',
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                style={{ fontSize: '0.8125rem', color: 'var(--brand-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
              >
                Marcar todas como lidas
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem', display: 'flex' }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="side-panel-body" style={{ padding: '0.75rem 1rem' }}>
          {notifications.length === 0 ? (
            <div className="empty-state">
              <Bell size={36} />
              <p className="empty-state-title">Sem notificacoes</p>
              <p className="empty-state-desc">Tudo em dia por aqui.</p>
            </div>
          ) : (
            <div>
              {notifications.map((notif) => {
                const meta = TYPE_ICON[notif.type];
                const Icon = meta.icon;

                return (
                  <div
                    key={notif.id}
                    className={`notif-item ${!notif.read ? 'unread' : ''}`}
                    onClick={() => onMarkRead(notif.id)}
                    style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.875rem 0.5rem', borderBottom: '1px solid #f3f5f4', cursor: 'pointer', borderRadius: '6px', marginBottom: '2px' }}
                  >
                    <div style={{ paddingTop: 3, flexShrink: 0 }}>
                      <div
                        className="notif-dot"
                        style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: !notif.read ? 'var(--brand-500)' : 'transparent',
                          marginTop: 4,
                        }}
                      />
                    </div>
                    <div
                      className="notif-icon"
                      style={{ background: meta.bg, color: meta.color, width: 32, height: 32, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <Icon size={15} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="notif-title">{notif.title}</div>
                      <div className="notif-body">{notif.body}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-disabled)', marginTop: '0.25rem' }}>
                        {formatDateTime(notif.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
