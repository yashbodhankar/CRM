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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await api.get('/analytics');
        if (mounted) setData(res.data);
      } catch (err) {
        if (mounted) setError(err?.response?.data?.message || 'Failed to load analytics');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const timer = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="Lead conversion" value={`${kpis.leadConversionRate || 0}%`} />
        <KpiCard label="Open tasks" value={kpis.openTasks || 0} />
        <KpiCard label="Customers" value={kpis.totalCustomers || 0} />
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
    </div>
  );
}

export default Reports;

