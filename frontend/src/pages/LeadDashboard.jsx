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

function LeadDashboard() {
  const { user } = useAuth();
  const [team, setTeam] = useState({ teamName: '', lead: null, members: [] });
  const [teamTasks, setTeamTasks] = useState([]);
  const [dailyTasks, setDailyTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const [teamRes, taskRes, dailyRes] = await Promise.all([
        api.get('/employees/team/my'),
        api.get('/tasks?team=true'),
        api.get('/tasks?team=true&daily=true')
      ]);
      setTeam(teamRes.data || { teamName: '', lead: null, members: [] });
      setTeamTasks(taskRes.data || []);
      setDailyTasks(dailyRes.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load lead dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const members = team.members?.length || 0;
    const totalTasks = teamTasks.length;
    const completed = teamTasks.filter((t) => t.status === 'completed').length;
    const submitted = teamTasks.filter((t) => t.submitted).length;
    const today = dailyTasks.length;

    return { members, totalTasks, completed, submitted, today };
  }, [team, teamTasks, dailyTasks]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Lead Dashboard</h2>
          <p className="text-xs text-slate-400">
            Welcome{user?.name ? `, ${user.name}` : ''}. Manage your team and assigned tasks.
          </p>
        </div>
      </div>

      {error && <div className="text-rose-400 text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Team members" value={loading ? '...' : stats.members} />
        <StatCard label="Team tasks" value={loading ? '...' : stats.totalTasks} />
        <StatCard label="Completed" value={loading ? '...' : stats.completed} />
        <StatCard label="Submitted" value={loading ? '...' : stats.submitted} />
        <StatCard label="Today's tasks" value={loading ? '...' : stats.today} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h3 className="text-sm font-medium text-slate-200">My Team</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              {team.teamName ? `Team: ${team.teamName}` : 'No team assigned'}
            </p>
          </div>
          <table className="min-w-full text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800">
              <tr className="text-left text-slate-400">
                <th className="px-3 py-2 font-medium">Member</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {team.members?.map((member) => (
                <tr key={member._id} className="border-t border-slate-800/80 text-slate-200">
                  <td className="px-3 py-2">{member.name}</td>
                  <td className="px-3 py-2">{member.email}</td>
                  <td className="px-3 py-2">{team.lead?.email === member.email ? 'Team Lead' : member.role || 'Member'}</td>
                </tr>
              ))}
              {!team.members?.length && (
                <tr>
                  <td colSpan="3" className="px-3 py-4 text-center text-slate-500 text-xs">No team members found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h3 className="text-sm font-medium text-slate-200">Today's Team Tasks</h3>
          </div>
          <table className="min-w-full text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800">
              <tr className="text-left text-slate-400">
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Assigned</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {dailyTasks.map((task) => (
                <tr key={task._id} className="border-t border-slate-800/80 text-slate-200">
                  <td className="px-3 py-2">{task.title}</td>
                  <td className="px-3 py-2">{task.assignedEmail || '-'}</td>
                  <td className="px-3 py-2 capitalize">{task.status}</td>
                </tr>
              ))}
              {!dailyTasks.length && (
                <tr>
                  <td colSpan="3" className="px-3 py-4 text-center text-slate-500 text-xs">No daily tasks for team.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default LeadDashboard;
