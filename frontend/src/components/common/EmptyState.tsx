import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title = 'No Records Available',
  description = 'No telemetry data or active items match the current query criteria.',
  action,
  className = '',
}) => {
  return (
    <div
      className={`card p-12 text-center flex flex-col items-center justify-center border-dashed border-zinc-800 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400 mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-medium text-zinc-200">{title}</h3>
      <p className="mt-1 text-sm text-zinc-400 max-w-sm mx-auto">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};

export default EmptyState;
