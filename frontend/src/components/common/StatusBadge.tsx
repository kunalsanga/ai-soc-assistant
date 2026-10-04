import React from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const normalized = status.toLowerCase();

  let badgeClass = 'badge-info';
  let dotColor = 'var(--color-info)';
  let label = status.replace(/_/g, ' ');

  if (normalized === 'open' || normalized === 'active') {
    badgeClass = 'badge-danger';
    dotColor = 'var(--color-critical)';
  } else if (normalized === 'investigating' || normalized === 'in_progress') {
    badgeClass = 'badge-warning';
    dotColor = 'var(--color-medium)';
  } else if (normalized === 'resolved' || normalized === 'completed' || normalized === 'closed') {
    badgeClass = 'badge-success';
    dotColor = 'var(--color-low)';
  } else if (normalized === 'dismissed' || normalized === 'not_started' || normalized === 'pending') {
    badgeClass = 'badge-neutral';
    dotColor = 'var(--color-text-muted)';
  } else if (normalized.includes('pending') || normalized.includes('integration')) {
    badgeClass = 'badge-warning';
    dotColor = 'var(--color-medium)';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${badgeClass} ${className}`}
      role="status"
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
      {label}
    </span>
  );
};

export default StatusBadge;
