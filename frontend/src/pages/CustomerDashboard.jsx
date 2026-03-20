import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../state/AuthContext';

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-xl font-semibold text-slate-50">{value}</p>
    </div>
  );
}

function ProgressBar({ value }) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="w-full bg-slate-800 rounded-full h-2">
      <div className="h-2 rounded-full bg-primary-500" style={{ width: `${safe}%` }} />
    </div>
  );
}

function CustomerDashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setError('');
        const res = await api.get('/projects?mine=true');
        setProjects(res.data || []);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load project tracking');
      } finally {
        setLoading(false);
      }
    }
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const total = projects.length;
    const completed = projects.filter((p) => p.status === 'completed').length;
    const ongoing = projects.filter((p) => p.status === 'ongoing' || p.status === 'planned').length;
    const avgProgress = total
      ? Math.round(projects.reduce((sum, p) => sum + Number(p.completion || 0), 0) / total)
      : 0;
    return { total, completed, ongoing, avgProgress };
  }, [projects]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Customer Project Portal</h2>
          <p className="text-xs text-slate-400">
            Welcome{user?.name ? `, ${user.name}` : ''}. Track project flow, progress, and SPOC contact.
          </p>
        </div>
      </div>

      {error && <div className="text-rose-400 text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Projects" value={loading ? '...' : stats.total} />
        <StatCard label="In Progress" value={loading ? '...' : stats.ongoing} />
        <StatCard label="Completed" value={loading ? '...' : stats.completed} />
        <StatCard label="Avg Progress" value={loading ? '...' : `${stats.avgProgress}%`} />
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h3 className="text-sm font-medium text-slate-200">Project Flow & Progress</h3>
        </div>
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800">
            <tr className="text-left text-slate-400">
              <th className="px-3 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Progress</th>
              <th className="px-3 py-2 font-medium">SPOC</th>
              <th className="px-3 py-2 font-medium">Contact</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project._id} className="border-t border-slate-800/80 text-slate-200">
                <td className="px-3 py-2">{project.name}</td>
                <td className="px-3 py-2 capitalize">{project.status || '-'}</td>
                <td className="px-3 py-2 min-w-[170px]">
                  <div className="space-y-1">
                    <ProgressBar value={project.completion} />
                    <p className="text-[11px] text-slate-400">{Number(project.completion || 0)}%</p>
                  </div>
                </td>
                <td className="px-3 py-2">{project.spocName || '-'}</td>
                <td className="px-3 py-2">
                  <div className="space-y-1">
                    <p>{project.spocEmail || '-'}</p>
                    <p>{project.spocPhone || '-'}</p>
                  </div>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan="5" className="px-3 py-4 text-center text-slate-500 text-xs">
                  No projects available for your account.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CustomerDashboard;
