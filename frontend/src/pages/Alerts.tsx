import React from 'react';

const Alerts: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-wide">All Alerts</h1>
      <div className="glass-panel p-10 rounded-xl flex flex-col items-center justify-center text-center border border-dashed border-slate-700">
        <h2 className="text-lg font-medium text-white mb-2">Alerts Feed</h2>
        <p className="text-slate-400">View and filter all security events from Wazuh. (Implementation pending)</p>
      </div>
    </div>
  );
};

export default Alerts;
