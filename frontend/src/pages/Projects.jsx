import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../state/AuthContext';

function Projects() {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const isLead = user?.role === 'lead';
  const isCustomer = user?.role === 'customer';
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({
    name: '',
    budget: '',
    completion: '',
    status: 'planned',
    customerEmail: '',
    teamName: '',
    teamLeadEmail: '',
    spocName: '',
    spocEmail: '',
    spocPhone: '',
    allocatedToEmails: '',
    assignedTeams: []
  });
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    try {
      const scoped = isEmployee || isLead || isCustomer;
      const calls = [api.get(scoped ? '/projects?mine=true' : '/projects')];
      if (!scoped) {
        calls.push(api.get('/employees'));
      }
      const [projectsRes, employeesRes] = await Promise.all(calls);
      const res = projectsRes;
      setProjects(res.data);
      if (employeesRes) {
        setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : []);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load projects');
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [isEmployee, isLead, isCustomer]);

  const teamOptions = useMemo(() => {
    const map = new Map();
    employees.forEach((emp) => {
      if (String(emp.role || '').toLowerCase() !== 'lead') return;
      if (!emp.teamName) return;
      if (!map.has(emp.teamName)) {
        map.set(emp.teamName, {
          teamName: emp.teamName,
          teamLeadEmail: emp.email || emp.teamLeadEmail || ''
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [employees]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTeamsChange = (e) => {
    const selectedTeams = Array.from(e.target.selectedOptions).map((opt) => opt.value);
    const firstTeam = teamOptions.find((team) => team.teamName === selectedTeams[0]);
    setForm((prev) => ({
      ...prev,
      assignedTeams: selectedTeams,
      teamName: selectedTeams[0] || '',
      teamLeadEmail: firstTeam?.teamLeadEmail || ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!form.name.trim()) {
      setError('Project name is required.');
      return;
    }

    if (!isEmployee && !isCustomer && (!Array.isArray(form.assignedTeams) || form.assignedTeams.length === 0)) {
      setError('Please select at least one team for this project.');
      return;
    }

    setLoading(true);
    try {
      const selectedTeams = Array.isArray(form.assignedTeams) ? form.assignedTeams : [];
      const primaryTeam = teamOptions.find((team) => team.teamName === selectedTeams[0]);

      const payload = {
        ...form,
        budget: Number(form.budget || 0),
        completion: Number(form.completion || 0)
      };
      payload.assignedTeams = selectedTeams;
      payload.teamName = selectedTeams[0] || '';
      payload.teamLeadEmail = primaryTeam?.teamLeadEmail || '';
      payload.allocatedToEmails = (form.allocatedToEmails || '')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      if (editingId) {
        await api.put(`/projects/${editingId}`, payload);
        setMessage('Project updated successfully.');
      } else {
        await api.post('/projects', payload);
        setMessage('Project added successfully.');
      }
      setForm({
        name: '', budget: '', completion: '', status: 'planned', customerEmail: '',
        teamName: '', teamLeadEmail: '', spocName: '', spocEmail: '', spocPhone: '',
        allocatedToEmails: '', assignedTeams: []
      });
      setEditingId(null);
      await load();
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || (editingId ? 'Failed to update project' : 'Failed to add project');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (project) => {
    setEditingId(project._id);
    setForm({
      name: project.name || '',
      budget: project.budget || '',
      completion: project.completion || '',
      status: project.status || 'planned',
      customerEmail: project.customerEmail || '',
      teamName: project.teamName || '',
      teamLeadEmail: project.teamLeadEmail || '',
      spocName: project.spocName || '',
      spocEmail: project.spocEmail || '',
      spocPhone: project.spocPhone || '',
      allocatedToEmails: Array.isArray(project.allocatedToEmails) ? project.allocatedToEmails.join(', ') : '',
      assignedTeams: Array.isArray(project.assignedTeams)
        ? project.assignedTeams
        : (project.teamName ? [project.teamName] : [])
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({
      name: '', budget: '', completion: '', status: 'planned', customerEmail: '',
      teamName: '', teamLeadEmail: '', spocName: '', spocEmail: '', spocPhone: '',
      allocatedToEmails: '', assignedTeams: []
    });
    setMessage('');
    setError('');
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this project?')) return;
    try {
      await api.delete(`/projects/${id}`);
      setMessage('Project removed.');
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Projects</h2>
          <p className="text-xs text-slate-400">
            {isCustomer
              ? 'Track your project flow, progress, and SPOC contact.'
              : isEmployee || isLead
                ? 'Projects allocated to your role/team.'
                : 'Overview of ongoing and planned projects.'}
          </p>
        </div>
      </div>

      {!isEmployee && !isCustomer && (
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3"
      >
        {message && <div className="text-green-400 text-sm">{message}</div>}
        {error && <div className="text-rose-400 text-sm">{error}</div>}
        {editingId && (
          <div className="text-sm text-slate-300">
            Editing project — <button type="button" onClick={handleCancelEdit} className="underline">Cancel</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Name
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Budget
            </label>
            <input
              name="budget"
              value={form.budget}
              onChange={handleChange}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Completion (%)</label>
            <input
              name="completion"
              value={form.completion}
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
              {['planned', 'ongoing', 'completed', 'on-hold'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Customer Email</label>
            <input
              name="customerEmail"
              value={form.customerEmail}
              onChange={handleChange}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] text-slate-400 mb-1">Assign Teams (multi-select)</label>
            <select
              name="assignedTeams"
              multiple
              value={form.assignedTeams || []}
              onChange={handleTeamsChange}
              className="w-full min-h-[90px] rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {teamOptions.map((team) => (
                <option key={team.teamName} value={team.teamName}>
                  {team.teamName} ({team.teamLeadEmail || 'Lead not set'})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">Hold Ctrl (Windows) to select multiple teams.</p>
            {teamOptions.length === 0 && (
              <p className="mt-1 text-[11px] text-amber-300">No available teams. Create Team Leads in Employees first.</p>
            )}
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Primary Team</label>
            <div className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
              {(form.assignedTeams && form.assignedTeams[0]) || 'Not selected'}
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Primary Team Lead Email</label>
            <div className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
              {teamOptions.find((team) => team.teamName === (form.assignedTeams && form.assignedTeams[0]))?.teamLeadEmail || 'Not selected'}
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">SPOC Name</label>
            <input
              name="spocName"
              value={form.spocName}
              onChange={handleChange}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">SPOC Email</label>
            <input
              name="spocEmail"
              value={form.spocEmail}
              onChange={handleChange}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">SPOC Phone</label>
            <input
              name="spocPhone"
              value={form.spocPhone}
              onChange={handleChange}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[11px] text-slate-400 mb-1">Allocated Emails (comma separated)</label>
            <input
              name="allocatedToEmails"
              value={form.allocatedToEmails}
              onChange={handleChange}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className={`inline-flex items-center justify-center rounded-lg text-xs font-medium text-white px-4 py-1.5 ${loading ? 'bg-primary-400' : 'bg-primary-600 hover:bg-primary-500'}`}
          >
            {loading ? (editingId ? 'Saving...' : 'Adding...') : (editingId ? 'Save changes' : 'Add project')}
          </button>
          {editingId && (
            <button type="button" onClick={handleCancelEdit} className="text-xs px-3 py-1 rounded-md bg-slate-800 text-slate-200">Cancel</button>
          )}
        </div>
      </form>
      )}

      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800">
            <tr className="text-left text-slate-400">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Progress</th>
              <th className="px-3 py-2 font-medium">Budget</th>
              <th className="px-3 py-2 font-medium">Teams</th>
              <th className="px-3 py-2 font-medium">SPOC</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              {!isEmployee && !isCustomer && <th className="px-3 py-2 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr
                key={p._id}
                className="border-t border-slate-800/80 text-slate-200"
              >
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2 capitalize">{p.status}</td>
                <td className="px-3 py-2">{Number(p.completion || 0)}%</td>
                <td className="px-3 py-2">
                  {p.budget ? `₹${p.budget.toLocaleString?.() || p.budget}` : '-'}
                </td>
                <td className="px-3 py-2">
                  {Array.isArray(p.assignedTeams) && p.assignedTeams.length > 0
                    ? p.assignedTeams.join(', ')
                    : (p.teamName || '-')}
                </td>
                <td className="px-3 py-2">{p.spocName || p.teamLeadEmail || '-'}</td>
                <td className="px-3 py-2">{p.spocEmail || p.spocPhone || '-'}</td>
                {!isEmployee && !isCustomer && <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(p)} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200">Edit</button>
                    <button onClick={() => handleDelete(p._id)} className="text-xs px-2 py-1 rounded bg-rose-700 text-white">Delete</button>
                  </div>
                </td>}
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td
                  colSpan={isEmployee || isCustomer ? '7' : '8'}
                  className="px-3 py-4 text-center text-slate-500 text-xs"
                >
                  No projects yet. Add one above to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Projects;

