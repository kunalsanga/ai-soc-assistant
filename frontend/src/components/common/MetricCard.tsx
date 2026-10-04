import React from 'react';
import type { LucideIcon } from 'lucide-react';
import MockDataDisclaimer from './MockDataDisclaimer';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  subtitle?: string;
  isMock?: boolean;
  className?: string;
  glowColor?: 'cyan' | 'red' | 'amber' | 'emerald';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  change,
  changeType = 'neutral',
  subtitle,
  isMock = false,
  className = '',
  glowColor = 'cyan',
}) => {
  const glowStyles = {
    cyan: 'hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)]',
    red: 'hover:border-rose-500/40 hover:shadow-[0_0_25px_rgba(244,63,94,0.15)]',
    amber: 'hover:border-amber-500/40 hover:shadow-[0_0_25px_rgba(245,158,11,0.15)]',
    emerald: 'hover:border-emerald-500/40 hover:shadow-[0_0_25px_rgba(16,185,129,0.15)]',
  };

  const iconStyles = {
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    red: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  return (
    <div
      className={`card relative overflow-hidden transition-all duration-300 p-5 ${glowStyles[glowColor]} ${className}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase">
            {title}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tracking-tight text-zinc-100">
              {value}
            </span>
            {change && (
              <span
                className={`text-xs font-mono font-medium ${
                  changeType === 'positive'
                    ? 'text-emerald-400'
                    : changeType === 'negative'
                    ? 'text-rose-400'
                    : 'text-zinc-400'
                }`}
              >
                {change}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-zinc-400 line-clamp-1">{subtitle}</p>
          )}
        </div>
        <div
          className={`p-2.5 rounded-lg border ${iconStyles[glowColor]} transition-transform duration-200 group-hover:scale-105`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {isMock && (
        <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between">
          <MockDataDisclaimer compact />
        </div>
      )}
    </div>
  );
};

export default MetricCard;
