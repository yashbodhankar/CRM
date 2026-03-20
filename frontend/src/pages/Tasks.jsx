import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../state/AuthContext';

function Tasks() {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const isLead = user?.role === 'lead';
  const [tasks, setTasks] = useState([]);
  const [dailyTasks, setDailyTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    assignedEmail: '',
    dailyDate: '',
    status: 'pending',
    priority: 'medium',
    submitted: false
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    try {
      if (isEmployee) {
        const [mineRes, dailyRes] = await Promise.all([
          api.get('/tasks?mine=true'),
          api.get('/tasks?mine=true&daily=true')
        ]);
        setTasks(mineRes.data || []);
        setDailyTasks(dailyRes.data || []);
        setTeamMembers([]);
      } else if (isLead) {
        const [teamRes, taskRes, dailyRes] = await Promise.all([
          api.get('/employees?mineTeam=true'),
          api.get('/tasks?team=true'),
          api.get('/tasks?team=true&daily=true')
        ]);
        setTeamMembers(teamRes.data || []);
        setTasks(taskRes.data || []);
        setDailyTasks(dailyRes.data || []);
      } else {
        const res = await api.get('/tasks');
        setTasks(res.data || []);
        setDailyTasks([]);
        setTeamMembers([]);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load tasks');
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [isEmployee, isLead]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/tasks/${editingId}`, form);
        setMessage('Task updated successfully.');
      } else {
        await api.post('/tasks', form);
        setMessage('Task added successfully.');
      }
      setForm({ title: '', description: '', assignedEmail: '', dailyDate: '', status: 'pending', priority: 'medium', submitted: false });
      setEditingId(null);
      await load();
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || (editingId ? 'Failed to update task' : 'Failed to add task');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (task) => {
    setEditingId(task._id);
    setForm({
      title: task.title || '',
      description: task.description || '',
      assignedEmail: task.assignedEmail || '',
      dailyDate: task.dailyDate ? String(task.dailyDate).slice(0, 10) : '',
      status: task.status || 'pending',
      priority: task.priority || 'medium',
      submitted: !!task.submitted
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ title: '', description: '', assignedEmail: '', dailyDate: '', status: 'pending', priority: 'medium', submitted: false });
    setMessage('');
    setError('');
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      setMessage('Task removed.');
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete');
    }
  };

  const handleEmployeeAction = async (taskId, patch) => {
    try {
      await api.put(`/tasks/${taskId}`, patch);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update task');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Tasks</h2>
          <p className="text-xs text-slate-400">
            {isEmployee ? 'Your assigned tasks and daily updates.' : isLead ? 'Assign and track tasks for your team.' : 'Keep track of work items and their status.'}
          </p>
        </div>
      </div>

      {!isEmployee && (
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3"
      >
        {message && <div className="text-green-400 text-sm">{message}</div>}
        {error && <div className="text-rose-400 text-sm">{error}</div>}
        {editingId && (
          <div className="text-sm text-slate-300">
            Editing task — <button type="button" onClick={handleCancelEdit} className="underline">Cancel</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-[11px] text-slate-400 mb-1">
              Title
            </label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Assigned Email
            </label>
            {isLead ? (
              <select
                name="assignedEmail"
                value={form.assignedEmail}
                onChange={handleChange}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Select team member</option>
                {teamMembers.map((m) => (
                  <option key={m._id} value={m.email}>{m.name} ({m.email})</option>
                ))}
              </select>
            ) : (
              <input
                name="assignedEmail"
                value={form.assignedEmail}
                onChange={handleChange}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            )}
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Daily Date
            </label>
            <input
              type="date"
              name="dailyDate"
              value={form.dailyDate}
              onChange={handleChange}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Status
            </label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {['pending', 'in-progress', 'completed'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Priority
            </label>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {['low', 'medium', 'high'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">
            Description
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows="2"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className={`inline-flex items-center justify-center rounded-lg text-xs font-medium text-white px-4 py-1.5 ${loading ? 'bg-primary-400' : 'bg-primary-600 hover:bg-primary-500'}`}
          >
            {loading ? (editingId ? 'Saving...' : 'Adding...') : (editingId ? 'Save changes' : 'Add task')}
          </button>
          {editingId && (
            <button type="button" onClick={handleCancelEdit} className="text-xs px-3 py-1 rounded-md bg-slate-800 text-slate-200">Cancel</button>
          )}
        </div>
      </form>
      )}

      {isEmployee && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h3 className="text-sm font-medium text-slate-200">Daily Tasks Assigned To You</h3>
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
                      <button onClick={() => handleEmployeeAction(task._id, { submitted: !task.submitted })} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200">
                        {task.submitted ? 'Unsubmit' : 'Submit'}
                      </button>
                      <button onClick={() => handleEmployeeAction(task._id, { status: task.status === 'completed' ? 'in-progress' : 'completed' })} className="text-xs px-2 py-1 rounded bg-primary-600 text-white">
                        {task.status === 'completed' ? 'Mark pending' : 'Mark complete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {dailyTasks.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-3 py-4 text-center text-slate-500 text-xs">No daily tasks assigned.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800">
            <tr className="text-left text-slate-400">
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Assigned</th>
              <th className="px-3 py-2 font-medium">Daily Date</th>
              <th className="px-3 py-2 font-medium">Submitted</th>
              {!isEmployee && <th className="px-3 py-2 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr
                key={task._id}
                className="border-t border-slate-800/80 text-slate-200"
              >
                <td className="px-3 py-2">{task.title}</td>
                <td className="px-3 py-2 capitalize">{task.status}</td>
                <td className="px-3 py-2 capitalize">{task.priority}</td>
                <td className="px-3 py-2">{task.assignedEmail || '-'}</td>
                <td className="px-3 py-2">{task.dailyDate ? String(task.dailyDate).slice(0, 10) : '-'}</td>
                <td className="px-3 py-2">{task.submitted ? 'Yes' : 'No'}</td>
                {!isEmployee && <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(task)} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200">Edit</button>
                    <button onClick={() => handleDelete(task._id)} className="text-xs px-2 py-1 rounded bg-rose-700 text-white">Delete</button>
                  </div>
                </td>}
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td
                  colSpan={isEmployee ? '6' : '7'}
                  className="px-3 py-4 text-center text-slate-500 text-xs"
                >
                  No tasks yet. Add a task above to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Tasks;

