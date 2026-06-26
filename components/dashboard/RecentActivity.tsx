import type { Databook } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import Link from 'next/link';

interface RecentActivityProps {
  databooks: Databook[];
}

export function RecentActivity({ databooks }: RecentActivityProps) {
  if (databooks.length === 0) {
    return <div className="empty-state">Nenhuma atividade recente</div>;
  }

  return (
    <table className="data-table">
      <tbody>
        {databooks.map((db) => (
          <tr key={db.id}>
            <td style={{ fontWeight: 600 }}>
              <Link href={`/databooks/${db.id}`} style={{ color: 'var(--brand-700)', textDecoration: 'none' }}>
                {db.number}
              </Link>
            </td>
            <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {db.client_name ?? '-'}
            </td>
            <td>
              <StatusBadge status={db.general_status} />
            </td>
            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {formatDateTime(db.updated_at)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
