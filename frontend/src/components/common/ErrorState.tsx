import React from 'react';
import { AlertOctagon, RotateCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Service Communication Error',
  message = 'Unable to connect to the backend security service. Please verify service health or retry.',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`card p-8 text-center flex flex-col items-center justify-center border-rose-500/30 bg-rose-500/5 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
        <AlertOctagon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
      <p className="mt-1 text-sm text-zinc-400 max-w-md mx-auto">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn btn-secondary mt-5 flex items-center gap-2 text-xs"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Retry Request</span>
        </button>
      )}
    </div>
  );
};

export default ErrorState;
