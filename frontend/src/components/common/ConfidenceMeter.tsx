import React from 'react';
import { ShieldCheck, HelpCircle } from 'lucide-react';

interface ConfidenceMeterProps {
  confidence?: string | number | null;
  label?: string;
  showBar?: boolean;
  className?: string;
}

const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({
  confidence,
  label = 'AI Confidence',
  showBar = true,
  className = '',
}) => {
  // If confidence is not available, be honest according to Master Prompt Section 25 & 40
  if (confidence === undefined || confidence === null || confidence === '') {
    return (
      <div className={`flex items-center gap-2 text-zinc-400 text-xs font-mono ${className}`}>
        <HelpCircle className="w-4 h-4 text-zinc-400 shrink-0" />
        <span>Confidence unavailable</span>
      </div>
    );
  }

  // Parse numerical confidence (e.g. "0.94", 0.94, "94%")
  let numericVal = 0;
  if (typeof confidence === 'number') {
    numericVal = confidence <= 1 ? confidence * 100 : confidence;
  } else {
    const clean = confidence.replace('%', '').trim();
    const parsed = parseFloat(clean);
    if (!isNaN(parsed)) {
      numericVal = parsed <= 1 ? parsed * 100 : parsed;
    }
  }

  const rounded = Math.round(numericVal);

  let colorClass = 'text-cyan-400';
  let barBg = 'bg-cyan-500';
  let statusText = 'High Confidence';

  if (rounded < 60) {
    colorClass = 'text-amber-400';
    barBg = 'bg-amber-500';
    statusText = 'Moderate / Review Suggested';
  } else if (rounded >= 85) {
    colorClass = 'text-emerald-400';
    barBg = 'bg-emerald-500';
    statusText = 'High Grounding Confidence';
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
          <ShieldCheck className={`w-4 h-4 ${colorClass}`} />
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span className="text-[11px] text-zinc-400">{statusText}</span>
          <span className={`font-bold ${colorClass}`}>{rounded}%</span>
        </div>
      </div>

      {showBar && (
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${barBg} transition-all duration-700 ease-out`}
            style={{ width: `${Math.min(Math.max(rounded, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default ConfidenceMeter;
