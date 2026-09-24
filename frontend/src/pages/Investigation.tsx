import React from 'react';

const Investigation: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-wide">Investigation Workspace</h1>
      <div className="glass-panel p-10 rounded-xl flex flex-col items-center justify-center text-center border border-dashed border-slate-700">
        <h2 className="text-lg font-medium text-white mb-2">Workspace</h2>
        <p className="text-slate-400">Interactive workspace to query the knowledge base manually. (Implementation pending)</p>
      </div>
    </div>
  );
};

export default Investigation;
