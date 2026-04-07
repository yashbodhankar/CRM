import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [stats, setStats] = useState({
    employees: 0,
    leads: 0,
    projects: 0,
    tasks: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [adminUsers, setAdminUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [usersSearch, setUsersSearch] = useState('');
  const [resetFeedback, setResetFeedback] = useState('');
  const [resettingUserId, setResettingUserId] = useState('');

  const loadStats = useCallback(async () => {
    setStatsError('');
    try {
      const [e, l, p, t] = await Promise.allSettled([
        api.get('/employees'),
        api.get('/leads'),
        api.get('/projects'),
        api.get('/tasks')
      ]);

      const nextStats = {
        employees: e.status === 'fulfilled' ? e.value.data.length : 0,
        leads: l.status === 'fulfilled' ? l.value.data.length : 0,
        projects: p.status === 'fulfilled' ? p.value.data.length : 0,
        tasks: t.status === 'fulfilled' ? t.value.data.length : 0
      };

      setStats(nextStats);
      setLastUpdated(new Date());

      if ([e, l, p, t].some((result) => result.status === 'rejected')) {
        setStatsError('Some dashboard modules failed to load. Showing available data.');
      }
    } catch (error) {
      setStatsError(error?.response?.data?.message || 'Failed to load dashboard stats');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUsersError('');
    setUsersLoading(true);
    try {
      const res = await api.get('/auth/users');
      setAdminUsers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setUsersError(error?.response?.data?.message || 'Failed to load user accounts');
    } finally {
      setUsersLoading(false);
    }
  }, [isAdmin]);

  const resetUserPassword = async (targetUser) => {
    setResetFeedback('');
    setResettingUserId(targetUser.id);
    try {
      const res = await api.post(`/auth/users/${targetUser.id}/reset-password`);
      const temp = res.data?.temporaryPassword || '';
      setResetFeedback(
        `Password reset for ${targetUser.email}. Temporary password: ${temp}`
      );
      await loadUsers();
    } catch (error) {
      setResetFeedback(error?.response?.data?.message || 'Failed to reset password');
    } finally {
      setResettingUserId('');
    }
  };

  useEffect(() => {
    loadStats();
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin, loadStats, loadUsers]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(() => {
      loadStats();
      if (isAdmin) {
        loadUsers();
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [autoRefresh, isAdmin, loadStats, loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = usersSearch.trim().toLowerCase();
    if (!q) return adminUsers;
    return adminUsers.filter(
      (u) =>
        String(u.id || '').toLowerCase().includes(q) ||
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.role || '').toLowerCase().includes(q)
    );
  }, [adminUsers, usersSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Dashboard</h2>
          <p className="text-xs text-slate-400">
            High-level overview of your team and pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadStats();
              if (isAdmin) loadUsers();
            }}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-100 px-3 py-2"
          >
            Refresh now
          </button>
          <button
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={`rounded-lg text-xs px-3 py-2 ${
              autoRefresh
                ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
            }`}
          >
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      {statsError && (
        <div className="text-xs text-amber-200 bg-amber-900/30 border border-amber-800 rounded-xl px-3 py-2">
          {statsError}
        </div>
      )}
      <div className="text-xs text-slate-500">
        {loadingStats ? 'Loading dashboard data...' : `Last updated: ${lastUpdated ? lastUpdated.toLocaleTimeString() : 'Not yet updated'}`}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active employees" value={stats.employees} />
        <StatCard label="Open leads" value={stats.leads} />
        <StatCard label="Ongoing projects" value={stats.projects} />
        <StatCard label="Open tasks" value={stats.tasks} />
      </div>

      {isAdmin && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Employee Info & User Access</h3>
              <p className="text-xs text-slate-400">
                View employee, lead, and customer login IDs and reset temporary passwords securely.
              </p>
            </div>
            <input
              value={usersSearch}
              onChange={(e) => setUsersSearch(e.target.value)}
              placeholder="Search by id, name, email, role"
              className="w-full max-w-xs rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100"
            />
          </div>

          {usersError && (
            <div className="text-xs text-rose-300 bg-rose-900/20 border border-rose-800 rounded-lg px-3 py-2">
              {usersError}
            </div>
          )}
          {resetFeedback && (
            <div className="text-xs text-emerald-200 bg-emerald-900/20 border border-emerald-800 rounded-lg px-3 py-2 break-all">
              {resetFeedback}
            </div>
          )}

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800">
                <tr className="text-left text-slate-400">
                  <th className="px-3 py-2 font-medium">User ID</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Password</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((row) => (
                  <tr key={row.id} className="border-t border-slate-800/80 text-slate-200">
                    <td className="px-3 py-2 font-mono">{row.id}</td>
                    <td className="px-3 py-2">{row.name || '-'}</td>
                    <td className="px-3 py-2">{row.email}</td>
                    <td className="px-3 py-2 capitalize">{row.role}</td>
                    <td className="px-3 py-2">
                      {row.passwordConfigured ? 'Configured' : 'Not configured'}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => resetUserPassword(row)}
                        disabled={resettingUserId === row.id}
                        className="rounded-md bg-primary-700 hover:bg-primary-600 disabled:opacity-70 text-white px-2 py-1"
                      >
                        {resettingUserId === row.id ? 'Resetting...' : 'Reset password'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!usersLoading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-3 py-4 text-center text-slate-500">
                      No user records found.
                    </td>
                  </tr>
                )}
                {usersLoading && (
                  <tr>
                    <td colSpan="6" className="px-3 py-4 text-center text-slate-500">
                      Loading users...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;

