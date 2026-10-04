/**
 * SeverityBadge — Displays alert severity with appropriate styling.
 */
import React from 'react';
import { getSeverityLevel, getSeverityLabel } from '../../types/alert';

interface SeverityBadgeProps {
  severity: number;
  showLevel?: boolean;
  className?: string;
}

const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, showLevel = false, className = '' }) => {
  const level = getSeverityLevel(severity);
  const label = getSeverityLabel(severity);

  return (
    <span
      className={`badge severity-${level} ${className}`}
      role="status"
      aria-label={`Severity: ${label}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor:
            level === 'critical' ? 'var(--color-critical)' :
            level === 'high' ? 'var(--color-high)' :
            level === 'medium' ? 'var(--color-medium)' :
            level === 'low' ? 'var(--color-low)' :
            'var(--color-info)',
        }}
      />
      {label}
      {showLevel && <span className="opacity-60 ml-1">L{severity}</span>}
    </span>
  );
};

export default SeverityBadge;
