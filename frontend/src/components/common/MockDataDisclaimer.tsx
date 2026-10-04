import React from 'react';
import { Database, AlertTriangle } from 'lucide-react';

interface MockDataDisclaimerProps {
  label?: string;
  detail?: string;
  compact?: boolean;
  className?: string;
}

const MockDataDisclaimer: React.FC<MockDataDisclaimerProps> = ({
  label = 'MOCK / DEVELOPMENT DATA',
  detail = 'Simulated telemetry — Backend integration pending',
  compact = false,
  className = '',
}) => {
  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono tracking-wider font-semibold border ${className}`}
        style={{
          backgroundColor: 'rgba(234, 179, 8, 0.08)',
          color: '#fbbf24',
          borderColor: 'rgba(234, 179, 8, 0.25)',
        }}
        title={detail}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        {label}
      </span>
    );
  }

  return (
    <div
      className={`flex items-center justify-between px-3.5 py-2 rounded-lg border text-xs font-mono backdrop-blur-sm ${className}`}
      style={{
        backgroundColor: 'rgba(234, 179, 8, 0.05)',
        borderColor: 'rgba(234, 179, 8, 0.2)',
        color: '#fbbf24',
      }}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="font-semibold tracking-wide">{label}:</span>
        <span className="text-zinc-300 font-sans">{detail}</span>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-zinc-400 shrink-0">
        <Database className="w-3 h-3 text-amber-400/80" />
        <span>Dev Environment</span>
      </div>
    </div>
  );
};

export default MockDataDisclaimer;
