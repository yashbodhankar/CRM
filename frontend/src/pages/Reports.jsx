import React from 'react';

function Reports() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-50">Reports</h2>
        <p className="text-xs text-slate-400">
          High-level summary reports for your CRM data.
        </p>
      </div>
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-xs text-slate-300">
        <p>
          This page is a placeholder for more advanced analytics (conversion
          funnels, revenue projections, and team productivity). The core CRM
          flows are available from the other sections.
        </p>
      </div>
    </div>
  );
}

export default Reports;

