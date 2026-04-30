import React from 'react';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell
} from 'recharts';
import api from '../utils/api';

const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444'];

function KpiCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function Reports() {
  const [data, setData] = useState(null);
  const [advanced, setAdvanced] = useState(null);
  const [range, setRange] = useState('30d');
  const [team, setTeam] = useState('');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setSyncing(true);
        const [basicRes, advancedRes, employeeRes] = await Promise.all([
          api.get('/analytics'),
          api.get(`/analytics/advanced?range=${encodeURIComponent(range)}${team ? `&team=${encodeURIComponent(team)}` : ''}`),
          api.get('/employees').catch(() => ({ data: [] }))
        ]);
        if (mounted) {
          setError('');
          setData(basicRes.data);
          setAdvanced(advancedRes.data);
          setLastUpdated(new Date());
          const uniqueTeams = Array.from(
            new Set((employeeRes.data || []).map((e) => e.teamName).filter(Boolean))
          ).sort((a, b) => a.localeCompare(b));
          setTeams(uniqueTeams);
        }
      } catch (err) {
        if (mounted && !data) setError(err?.response?.data?.message || 'Failed to load analytics');
      } finally {
        if (mounted) setSyncing(false);
        if (mounted) setLoading(false);
      }
    }
    load();

    const onVisibleRefresh = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener('focus', onVisibleRefresh);
    document.addEventListener('visibilitychange', onVisibleRefresh);

    const timer = setInterval(load, 5000);
    return () => {
      mounted = false;
      window.removeEventListener('focus', onVisibleRefresh);
      document.removeEventListener('visibilitychange', onVisibleRefresh);
      clearInterval(timer);
    };
  }, [range, team]);

  if (loading) {
    return <div className="text-sm text-slate-400">Loading analytics...</div>;
  }

  if (error) {
    return <div className="text-sm text-rose-400">{error}</div>;
  }

  const kpis = data?.kpis || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-50">Analytics Dashboard</h2>
        <p className="text-xs text-slate-400">
          Live CRM insights: conversion, growth, revenue, and activity.
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          {syncing ? 'Syncing...' : 'Synced'}{lastUpdated ? ` - ${lastUpdated.toLocaleTimeString()}` : ''}
        </p>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="180d">Last 180 days</option>
          <option value="365d">Last 365 days</option>
        </select>
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100"
        >
          <option value="">All teams</option>
          {teams.map((teamName) => (
            <option key={teamName} value={teamName}>{teamName}</option>
          ))}
        </select>
        <button
          onClick={() => {
            setRange('30d');
            setTeam('');
          }}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-100 px-3 py-2"
        >
          Reset filters
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="Lead conversion" value={`${kpis.leadConversionRate || 0}%`} />
        <KpiCard label="Open tasks" value={kpis.openTasks || 0} />
        <KpiCard label="Customers" value={kpis.totalCustomers || 0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard label="Active deals" value={kpis.activeDeals || 0} />
        <KpiCard label="Won deal value" value={`₹${(kpis.wonDealsValue || 0).toLocaleString()}`} />
        <KpiCard label="Overdue tasks" value={kpis.overdueTasks || 0} />
        <KpiCard label="Avg task completion (hrs)" value={advanced?.summary?.avgTaskCompletionHours || 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <h3 className="text-sm text-slate-100 mb-3">Monthly Sales</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.monthlySales || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#60a5fa" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <h3 className="text-sm text-slate-100 mb-3">Customer Growth</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.customerGrowth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Legend />
                <Bar dataKey="customers" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <h3 className="text-sm text-slate-100 mb-3">Lead Status Mix</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data?.leadStatusBreakdown || []} dataKey="count" nameKey="status" outerRadius={90} label>
                  {(data?.leadStatusBreakdown || []).map((entry, index) => (
                    <Cell key={`${entry.status}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <h3 className="text-sm text-slate-100 mb-3">Activity Logs</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(data?.activity || []).map((item, idx) => (
              <div key={`${item.type}-${idx}`} className="text-xs border border-slate-800 rounded-lg p-2 text-slate-300">
                <p className="font-medium text-slate-200">{item.action}</p>
                <p className="text-slate-500">{new Date(item.at).toLocaleString()}</p>
              </div>
            ))}
            {(data?.activity || []).length === 0 && <p className="text-xs text-slate-500">No activity logs.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <h3 className="text-sm text-slate-100 mb-3">Sales Funnel Value</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={advanced?.salesFunnel || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="stage" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <h3 className="text-sm text-slate-100 mb-3">Team Performance</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(advanced?.teamPerformance || []).slice(0, 10).map((row) => (
              <div key={row.email} className="text-xs border border-slate-800 rounded-lg p-2 text-slate-300">
                <p className="font-medium text-slate-200">{row.name} ({row.teamName})</p>
                <p>Completed Tasks: {row.completedTasks}/{row.totalTasks}</p>
                <p>Won Deal Value: ₹{Number(row.wonDealValue || 0).toLocaleString()}</p>
              </div>
            ))}
            {(advanced?.teamPerformance || []).length === 0 && <p className="text-xs text-slate-500">No team performance data.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <h3 className="text-sm text-slate-100 mb-3">Lead and Deal Timeline</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={advanced?.timeline || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="leads" stroke="#34d399" strokeWidth={2} />
              <Line type="monotone" dataKey="dealValue" stroke="#60a5fa" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Reports;

