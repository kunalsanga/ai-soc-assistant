import React from 'react';
import {
  CheckCircle2,
  Clock,
  SkipForward,
  AlertOctagon,
  Layers,
} from 'lucide-react';
import type { ExecutionTraceData } from '../../services/api';

interface ExecutionTraceProps {
  trace: ExecutionTraceData | null;
  loading?: boolean;
}

export const ExecutionTrace: React.FC<ExecutionTraceProps> = ({ trace, loading = false }) => {
  if (loading) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center min-h-[350px] space-y-3 bg-[#0a0d14]">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
        <span className="text-xs font-mono text-zinc-400">Loading Pipeline Execution Trace...</span>
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center min-h-[350px] space-y-2 bg-[#0a0d14] text-center">
        <Layers className="w-8 h-8 text-zinc-600 mb-2" />
        <div className="text-sm font-semibold text-zinc-300">No Execution Trace Found</div>
        <div className="text-xs text-zinc-500 max-w-sm">
          Run an AI analysis to record real-time pipeline execution stages, timings, and verification checkpoints.
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/40 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            <span>SUCCEEDED</span>
          </span>
        );
      case 'skipped':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-400">
            <SkipForward className="w-3 h-3" />
            <span>SKIPPED</span>
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/70 border border-rose-800/40 text-rose-400">
            <AlertOctagon className="w-3 h-3" />
            <span>FAILED</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/70 border border-amber-800/40 text-amber-400">
            <Clock className="w-3 h-3" />
            <span>PENDING</span>
          </span>
        );
    }
  };

  return (
    <div className="card p-5 space-y-5 bg-[#0a0d14] border border-zinc-800/90">
      {/* Header Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-cyan-400 font-semibold uppercase tracking-wider">
              PIPELINE EXECUTION TRACE
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/40 text-cyan-300">
              MODE: {trace.mode}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            End-to-end execution path for Alert #{trace.alert_id} through FastAPI, Qdrant, and Ollama.
          </p>
        </div>

        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="text-[10px] font-mono text-zinc-500 uppercase">LLM Engine</div>
            <div className="text-xs font-mono text-zinc-200">{trace.model_name}</div>
          </div>
          {trace.created_at && (
            <div>
              <div className="text-[10px] font-mono text-zinc-500 uppercase">Executed At</div>
              <div className="text-xs font-mono text-zinc-300">
                {new Date(trace.created_at).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stages Timeline */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-800">
        {trace.stages.map((stage) => {
          const isSkipped = stage.status === 'skipped';
          return (
            <div key={stage.step} className="relative group">
              {/* Step indicator circle */}
              <div
                className={`absolute -left-6 top-1 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                  stage.status === 'succeeded'
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                    : isSkipped
                      ? 'bg-zinc-900 border-zinc-700 text-zinc-500'
                      : 'bg-rose-950 border-rose-500 text-rose-300'
                }`}
              >
                {stage.step}
              </div>

              {/* Stage Card */}
              <div
                className={`p-3.5 rounded-lg border transition-all ${
                  isSkipped
                    ? 'bg-zinc-950/40 border-zinc-800/60 opacity-60'
                    : 'bg-[#0c101a] border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-200">{stage.name}</span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      [{stage.component}]
                    </span>
                  </div>
                  {getStatusBadge(stage.status)}
                </div>

                <p className="text-xs text-zinc-300 mb-2">{stage.details}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/60 text-[10px] font-mono text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500">Interface:</span>
                    <span className="text-cyan-400/90">{stage.interface}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Records: </span>
                    <span className="text-zinc-300">{stage.records_processed}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExecutionTrace;
