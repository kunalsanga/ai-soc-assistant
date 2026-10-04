import React from 'react';

interface LoadingSkeletonProps {
  type?: 'card' | 'table' | 'detail' | 'text';
  count?: number;
  className?: string;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  type = 'card',
  count = 1,
  className = '',
}) => {
  const items = Array.from({ length: count });

  if (type === 'card') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {items.map((_, i) => (
          <div key={i} className="card p-5 animate-pulse space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-3 w-24 bg-zinc-800 rounded" />
              <div className="h-8 w-8 bg-zinc-800 rounded-lg" />
            </div>
            <div className="h-7 w-20 bg-zinc-800 rounded mt-2" />
            <div className="h-3 w-32 bg-zinc-800/60 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={`card overflow-hidden animate-pulse ${className}`}>
        <div className="p-4 border-b border-zinc-800 flex justify-between">
          <div className="h-4 w-32 bg-zinc-800 rounded" />
          <div className="h-4 w-20 bg-zinc-800 rounded" />
        </div>
        <div className="divide-y divide-zinc-800/60">
          {items.map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="h-4 w-16 bg-zinc-800 rounded" />
              <div className="h-4 w-24 bg-zinc-800/80 rounded" />
              <div className="h-4 w-48 bg-zinc-800/60 rounded" />
              <div className="h-4 w-20 bg-zinc-800/50 rounded" />
              <div className="h-6 w-16 bg-zinc-800 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'detail') {
    return (
      <div className={`space-y-6 animate-pulse ${className}`}>
        <div className="card p-6 space-y-4">
          <div className="h-6 w-64 bg-zinc-800 rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-zinc-800">
            <div className="h-10 bg-zinc-800/60 rounded" />
            <div className="h-10 bg-zinc-800/60 rounded" />
            <div className="h-10 bg-zinc-800/60 rounded" />
            <div className="h-10 bg-zinc-800/60 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-6 h-64 bg-zinc-900/60" />
          <div className="card p-6 h-64 md:col-span-2 bg-zinc-900/60" />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 animate-pulse ${className}`}>
      {items.map((_, i) => (
        <div key={i} className="h-4 bg-zinc-800 rounded w-full" />
      ))}
    </div>
  );
};

export default LoadingSkeleton;
