import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, Cpu, Network, Clock, Activity, FileText, CheckCircle } from 'lucide-react';
import { Alert, Analysis } from '../types/alert';
import { alertService } from '../services/api';

const AlertDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        if (id) {
          const data = await alertService.getAlert(id);
          setAlert(data);
        }
      } catch (error) {
        console.error("Error fetching alert", error);
        // Mock fallback
        setAlert({
          id: Number(id) || 1,
          external_alert_id: "mock-001",
          timestamp: new Date().toISOString(),
          severity: 10,
          rule_id: "5710",
          rule_description: "Multiple authentication failures",
          agent_name: "linux-lab",
          source_ip: "192.168.1.20",
          username: "test-user",
          status: "open",
          created_at: new Date().toISOString()
        });
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const handleAnalyze = async () => {
    if (!id) return;
    setAnalyzing(true);
    try {
      const result = await alertService.analyzeAlert(id);
      setAnalysis(result);
    } catch (error) {
      console.error("Analysis failed", error);
      setAnalysis({
        status: "pending",
        message: "AI analysis pipeline not connected yet."
      });
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <div className="text-center text-slate-400 py-10">Loading alert details...</div>;
  }

  if (!alert) {
    return <div className="text-center text-slate-400 py-10">Alert not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 mb-4">
        <Link to="/" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-white tracking-wide">Investigation: Alert #{alert.external_alert_id}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Alert Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-xl border-l-4" style={{ borderColor: alert.severity >= 12 ? '#ef4444' : alert.severity >= 8 ? '#f97316' : '#3b82f6' }}>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center">
              <ShieldAlert className="mr-2 text-slate-400" size={18} />
              Alert Context
            </h2>
            
            <div className="space-y-4">
              <div>
                <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Rule</div>
                <div className="text-sm text-white">{alert.rule_description} (ID: {alert.rule_id})</div>
              </div>
              
              <div className="flex justify-between">
                <div>
                  <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Severity</div>
                  <div className={`text-sm font-bold ${alert.severity >= 12 ? 'text-red-500' : alert.severity >= 8 ? 'text-orange-500' : 'text-blue-500'}`}>
                    Level {alert.severity}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Status</div>
                  <div className="text-sm text-white capitalize">{alert.status}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1 flex items-center">
                  <Clock className="mr-1" size={12} /> Timestamp
                </div>
                <div className="text-sm font-mono text-slate-300">{new Date(alert.timestamp).toLocaleString()}</div>
              </div>

              <div className="pt-4 border-t border-slate-700/50">
                <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1 flex items-center">
                  <Cpu className="mr-1" size={12} /> Agent
                </div>
                <div className="text-sm text-slate-300">{alert.agent_name}</div>
              </div>

              {(alert.source_ip || alert.destination_ip) && (
                <div className="pt-2 border-t border-slate-700/50">
                  <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2 flex items-center">
                    <Network className="mr-1" size={12} /> Network
                  </div>
                  {alert.source_ip && <div className="text-sm font-mono text-slate-300">Src: {alert.source_ip}</div>}
                  {alert.destination_ip && <div className="text-sm font-mono text-slate-300">Dst: {alert.destination_ip}</div>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Analysis */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-xl min-h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-white flex items-center">
                <Activity className="mr-2 text-blue-500" size={18} />
                AI Assistant Analysis
              </h2>
              {!analysis && (
                <button 
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors flex items-center shadow-lg shadow-blue-500/20"
                >
                  {analyzing ? (
                    <><Activity className="animate-spin mr-2" size={16} /> Processing...</>
                  ) : (
                    'Generate Analysis'
                  )}
                </button>
              )}
            </div>

            <div className="flex-1 rounded-lg border border-slate-700 bg-slate-900/50 p-6 flex flex-col items-center justify-center relative overflow-hidden">
              {!analysis ? (
                <div className="text-center text-slate-500">
                  <Activity size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No analysis generated yet.</p>
                  <p className="text-sm mt-2">Click "Generate Analysis" to run the RAG pipeline.</p>
                </div>
              ) : (
                <div className="absolute inset-0 p-6 overflow-y-auto text-left w-full h-full">
                  <div className="mb-6 pb-4 border-b border-slate-800">
                    <div className="flex items-center text-yellow-500 mb-2">
                      <ShieldAlert size={16} className="mr-2" />
                      <span className="text-sm font-medium uppercase tracking-wider">Status: {analysis.status || 'Pending'}</span>
                    </div>
                    <h3 className="text-xl font-medium text-white mb-4">
                      AI analysis will be available when the RAG + LLM pipeline is connected.
                    </h3>
                    {analysis.message && (
                      <p className="text-slate-400 bg-slate-800/50 p-4 rounded-lg font-mono text-sm border border-slate-700/50">
                        &gt; {analysis.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="opacity-40 blur-[1px] pointer-events-none mt-8">
                    <h4 className="text-sm font-bold text-white mb-2 flex items-center"><FileText size={14} className="mr-2"/> Placeholder Output Structure</h4>
                    <div className="space-y-4 text-sm text-slate-300">
                      <div>
                        <strong>Summary:</strong> <span className="bg-slate-700 h-4 w-3/4 inline-block rounded"></span>
                      </div>
                      <div>
                        <strong>Severity Assessment:</strong> <span className="bg-slate-700 h-4 w-1/4 inline-block rounded"></span>
                      </div>
                      <div>
                        <strong>Explanation:</strong> 
                        <div className="bg-slate-700 h-4 w-full mt-1 rounded"></div>
                        <div className="bg-slate-700 h-4 w-5/6 mt-1 rounded"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertDetails;
