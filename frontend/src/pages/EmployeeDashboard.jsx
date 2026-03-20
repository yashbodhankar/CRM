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

function EmployeeDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [dailyTasks, setDailyTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [team, setTeam] = useState({ teamName: '', lead: null, members: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const [taskRes, dailyTaskRes, projectRes, teamRes] = await Promise.all([
        api.get('/tasks?mine=true'),
        api.get('/tasks?mine=true&daily=true'),
        api.get('/projects?mine=true'),
        api.get('/employees/team/my')
      ]);
      setTasks(taskRes.data || []);
      setDailyTasks(dailyTaskRes.data || []);
      setProjects(projectRes.data || []);
      setTeam(teamRes.data || { teamName: '', lead: null, members: [] });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load employee dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const markSubmitted = async (taskId, submitted) => {
    await api.put(`/tasks/${taskId}`, { submitted });
    await load();
  };

  const markCompleted = async (taskId, completed) => {
    await api.put(`/tasks/${taskId}`, { status: completed ? 'completed' : 'in-progress' });
    await load();
  };

  const stats = useMemo(() => {
    const totalTasks = tasks.length;
    const pendingTasks = tasks.filter((t) => t.status !== 'completed').length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const submittedTasks = tasks.filter((t) => t.submitted).length;
    const activeProjects = projects.filter((p) => p.status === 'ongoing' || p.status === 'planned').length;

    return {
      totalTasks,
      pendingTasks,
      completedTasks,
      submittedTasks,
      activeProjects,
      teamMembers: team.members?.length || 0
    };
  }, [tasks, projects, team]);

  const recentTasks = tasks.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Employee Dashboard</h2>
          <p className="text-xs text-slate-400">
            Welcome{user?.name ? `, ${user.name}` : ''}. Track your assigned work and team updates.
          </p>
        </div>
      </div>

      {error && <div className="text-rose-400 text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total tasks" value={loading ? '...' : stats.totalTasks} />
        <StatCard label="Pending tasks" value={loading ? '...' : stats.pendingTasks} />
        <StatCard label="Completed tasks" value={loading ? '...' : stats.completedTasks} />
        <StatCard label="Submitted tasks" value={loading ? '...' : stats.submittedTasks} />
        <StatCard label="Active projects" value={loading ? '...' : stats.activeProjects} />
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h3 className="text-sm font-medium text-slate-200">Daily Assigned Tasks</h3>
        </div>
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800">
            <tr className="text-left text-slate-400">
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Submitted</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {dailyTasks.map((task) => (
              <tr key={task._id} className="border-t border-slate-800/80 text-slate-200">
                <td className="px-3 py-2">{task.title}</td>
                <td className="px-3 py-2 capitalize">{task.status}</td>
                <td className="px-3 py-2">{task.submitted ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => markSubmitted(task._id, !task.submitted)}
                      className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200"
                    >
                      {task.submitted ? 'Unsubmit' : 'Submit'}
                    </button>
                    <button
                      onClick={() => markCompleted(task._id, task.status !== 'completed')}
                      className="text-xs px-2 py-1 rounded bg-primary-600 text-white"
                    >
                      {task.status === 'completed' ? 'Mark pending' : 'Mark complete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {dailyTasks.length === 0 && (
              <tr>
                <td colSpan="4" className="px-3 py-4 text-center text-slate-500 text-xs">
                  No daily tasks assigned for today.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h3 className="text-sm font-medium text-slate-200">Allocated Projects</h3>
          </div>
          <table className="min-w-full text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800">
              <tr className="text-left text-slate-400">
                <th className="px-3 py-2 font-medium">Project</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Team Lead</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project._id} className="border-t border-slate-800/80 text-slate-200">
                  <td className="px-3 py-2">{project.name}</td>
                  <td className="px-3 py-2 capitalize">{project.status}</td>
                  <td className="px-3 py-2">{project.teamLeadEmail || '-'}</td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-3 py-4 text-center text-slate-500 text-xs">
                    No project allocated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h3 className="text-sm font-medium text-slate-200">My Team</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              {team.teamName ? `Team: ${team.teamName}` : 'Team not assigned'}
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
                  <td className="px-3 py-2">
                    {team.lead?.email === member.email ? 'Team Lead' : member.role || 'Member'}
                  </td>
                </tr>
              ))}
              {!team.members?.length && (
                <tr>
                  <td colSpan="3" className="px-3 py-4 text-center text-slate-500 text-xs">
                    No team members assigned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h3 className="text-sm font-medium text-slate-200">My Recent Assigned Tasks</h3>
        </div>
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800">
            <tr className="text-left text-slate-400">
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {recentTasks.map((task) => (
              <tr key={task._id} className="border-t border-slate-800/80 text-slate-200">
                <td className="px-3 py-2">{task.title}</td>
                <td className="px-3 py-2 capitalize">{task.status}</td>
                <td className="px-3 py-2 capitalize">{task.priority || '-'}</td>
                <td className="px-3 py-2">{task.submitted ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {recentTasks.length === 0 && (
              <tr>
                <td colSpan="4" className="px-3 py-4 text-center text-slate-500 text-xs">
                  No assigned tasks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default EmployeeDashboard;
