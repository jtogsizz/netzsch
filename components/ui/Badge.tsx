import { cn } from '@/lib/utils';
import type { GeneralStatus, Priority } from '@/types';
import { STATUS_STYLES, PRIORITY_STYLES } from '@/lib/constants';

interface StatusBadgeProps {
  status: GeneralStatus;
  className?: string;
  style?: React.CSSProperties;
}

export function StatusBadge({ status, className, style }: StatusBadgeProps) {
  const styles = STATUS_STYLES[status];
  return (
    <span className={cn('badge', styles.badge, className)} style={style}>
      {status}
    </span>
  );
}

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
  style?: React.CSSProperties;
}

export function PriorityBadge({ priority, className, style }: PriorityBadgeProps) {
  return (
    <span className={cn('badge', PRIORITY_STYLES[priority], className)} style={style}>
      {priority}
    </span>
  );
}

// Badge genérico para outros contextos
interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span className={cn('badge bg-gray-100 text-gray-700 border border-gray-200', className)}>
      {children}
    </span>
  );
}
