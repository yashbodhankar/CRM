import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../state/AuthContext';

function createSubtask() {
  return { title: '', weight: 1, completed: false };
}

function createMilestone() {
  return { title: '', weight: 1, completed: false, subtasks: [createSubtask()] };
}

function Projects() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isEmployee = user?.role === 'employee';
  const isLead = user?.role === 'lead';
  const isCustomer = user?.role === 'customer';
  const canEditProject = isAdmin || isManager;
  const canTrackMilestones = canEditProject || isLead;
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({
    name: '',
    budget: '',
    status: 'planned',
    customerEmail: '',
    teamName: '',
    teamLeadEmail: '',
    spocName: '',
    spocEmail: '',
    spocPhone: '',
    allocatedToEmails: '',
    assignedTeams: [],
    milestones: [createMilestone()]
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

    if (canEditProject && (!Array.isArray(form.assignedTeams) || form.assignedTeams.length === 0)) {
      setError('Please select at least one team for this project.');
      return;
    }

    const cleanedMilestones = (form.milestones || [])
      .map((milestone) => ({
        ...milestone,
        title: String(milestone.title || '').trim(),
        weight: Number(milestone.weight || 0),
        subtasks: (milestone.subtasks || [])
          .map((subtask) => ({
            ...subtask,
            title: String(subtask.title || '').trim(),
            weight: Number(subtask.weight || 0)
          }))
          .filter((subtask) => subtask.title)
      }))
      .filter((milestone) => milestone.title);

    if (canEditProject && cleanedMilestones.length === 0) {
      setError('Add at least one important task (milestone).');
      return;
    }

    setLoading(true);
    try {
      const selectedTeams = Array.isArray(form.assignedTeams) ? form.assignedTeams : [];
      const primaryTeam = teamOptions.find((team) => team.teamName === selectedTeams[0]);

      const payload = {
        ...form,
        budget: Number(form.budget || 0),
        milestones: cleanedMilestones
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
        name: '', budget: '', status: 'planned', customerEmail: '',
        teamName: '', teamLeadEmail: '', spocName: '', spocEmail: '', spocPhone: '',
        allocatedToEmails: '', assignedTeams: [], milestones: [createMilestone()]
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
        : (project.teamName ? [project.teamName] : []),
      milestones: Array.isArray(project.milestones) && project.milestones.length > 0
        ? project.milestones
        : [createMilestone()]
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({
      name: '', budget: '', status: 'planned', customerEmail: '',
      teamName: '', teamLeadEmail: '', spocName: '', spocEmail: '', spocPhone: '',
      allocatedToEmails: '', assignedTeams: [], milestones: [createMilestone()]
    });
    setMessage('');
    setError('');
  };

  const updateMilestoneField = (milestoneIndex, field, value) => {
    setForm((prev) => {
      const milestones = [...(prev.milestones || [])];
      milestones[milestoneIndex] = { ...milestones[milestoneIndex], [field]: value };
      return { ...prev, milestones };
    });
  };

  const updateSubtaskField = (milestoneIndex, subtaskIndex, field, value) => {
    setForm((prev) => {
      const milestones = [...(prev.milestones || [])];
      const milestone = { ...milestones[milestoneIndex] };
      const subtasks = [...(milestone.subtasks || [])];
      subtasks[subtaskIndex] = { ...subtasks[subtaskIndex], [field]: value };
      milestone.subtasks = subtasks;
      milestones[milestoneIndex] = milestone;
      return { ...prev, milestones };
    });
  };

  const addMilestone = () => {
    setForm((prev) => ({ ...prev, milestones: [...(prev.milestones || []), createMilestone()] }));
  };

  const removeMilestone = (milestoneIndex) => {
    setForm((prev) => {
      const milestones = [...(prev.milestones || [])];
      milestones.splice(milestoneIndex, 1);
      return { ...prev, milestones: milestones.length > 0 ? milestones : [createMilestone()] };
    });
  };

  const addSubtask = (milestoneIndex) => {
    setForm((prev) => {
      const milestones = [...(prev.milestones || [])];
      const milestone = { ...milestones[milestoneIndex] };
      milestone.subtasks = [...(milestone.subtasks || []), createSubtask()];
      milestones[milestoneIndex] = milestone;
      return { ...prev, milestones };
    });
  };

  const removeSubtask = (milestoneIndex, subtaskIndex) => {
    setForm((prev) => {
      const milestones = [...(prev.milestones || [])];
      const milestone = { ...milestones[milestoneIndex] };
      const subtasks = [...(milestone.subtasks || [])];
      subtasks.splice(subtaskIndex, 1);
      milestone.subtasks = subtasks;
      milestones[milestoneIndex] = milestone;
      return { ...prev, milestones };
    });
  };

  const handleMilestoneToggle = async (projectId, milestoneId, completed) => {
    try {
      await api.patch(`/projects/${projectId}/milestones/${milestoneId}`, { completed });
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update milestone');
    }
  };

  const handleSubtaskToggle = async (projectId, milestoneId, subtaskId, completed) => {
    try {
      await api.patch(`/projects/${projectId}/milestones/${milestoneId}/subtasks/${subtaskId}`, { completed });
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update subtask');
    }
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

  const handleLeadSubmitCompletion = async (projectId) => {
    try {
      setMessage('');
      setError('');
      await api.post(`/projects/${projectId}/submit-completion`);
      setMessage('Project completion submitted by lead. Waiting for admin and customer verification.');
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit project completion');
    }
  };

  const handleVerifyCompletion = async (projectId) => {
    try {
      setMessage('');
      setError('');
      await api.post(`/projects/${projectId}/verify-completion`);
      setMessage('Verification submitted successfully.');
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to verify project completion');
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

      {message && <div className="text-emerald-400 text-sm">{message}</div>}
      {error && <div className="text-rose-400 text-sm">{error}</div>}

      {canEditProject && (
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3"
      >
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

          <div className="md:col-span-3 space-y-2 rounded-xl border border-slate-800 p-3 bg-slate-950/40">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] text-slate-300">Important Tasks (Milestones) with Subtasks</label>
              <button type="button" onClick={addMilestone} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200">Add milestone</button>
            </div>

            {(form.milestones || []).map((milestone, milestoneIndex) => (
              <div key={`m-${milestoneIndex}`} className="rounded-lg border border-slate-800 p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    value={milestone.title || ''}
                    onChange={(e) => updateMilestoneField(milestoneIndex, 'title', e.target.value)}
                    placeholder="Milestone title"
                    className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-100"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={milestone.weight || 0}
                    onChange={(e) => updateMilestoneField(milestoneIndex, 'weight', e.target.value)}
                    placeholder="Weight"
                    className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-100"
                  />
                  <button type="button" onClick={() => removeMilestone(milestoneIndex)} className="text-xs px-2 py-1 rounded bg-rose-800 text-white">
                    Remove milestone
                  </button>
                </div>

                <div className="space-y-2">
                  {(milestone.subtasks || []).map((subtask, subtaskIndex) => (
                    <div key={`s-${milestoneIndex}-${subtaskIndex}`} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        value={subtask.title || ''}
                        onChange={(e) => updateSubtaskField(milestoneIndex, subtaskIndex, 'title', e.target.value)}
                        placeholder="Subtask title"
                        className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-100"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={subtask.weight || 0}
                        onChange={(e) => updateSubtaskField(milestoneIndex, subtaskIndex, 'weight', e.target.value)}
                        placeholder="Weight"
                        className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-100"
                      />
                      <button type="button" onClick={() => removeSubtask(milestoneIndex, subtaskIndex)} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200">
                        Remove subtask
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addSubtask(milestoneIndex)} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200">
                  Add subtask
                </button>
              </div>
            ))}
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
              <th className="px-3 py-2 font-medium">Task Completion</th>
              <th className="px-3 py-2 font-medium">Budget</th>
              <th className="px-3 py-2 font-medium">Teams</th>
              <th className="px-3 py-2 font-medium">SPOC</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              {canEditProject && <th className="px-3 py-2 font-medium">Actions</th>}
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
                <td className="px-3 py-2">{p.taskStats?.completedTasks || 0}/{p.taskStats?.totalTasks || 0}</td>
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
                {canEditProject && <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(p)} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200">Edit</button>
                    <button onClick={() => handleDelete(p._id)} className="text-xs px-2 py-1 rounded bg-rose-700 text-white">Delete</button>
                  </div>
                </td>}
              </tr>
            ))}
            {projects.map((p) => (
              <tr key={`${p._id}-milestones`} className="border-t border-slate-800/40 text-slate-300 bg-slate-950/30">
                <td className="px-3 py-2" colSpan={canEditProject ? '9' : '8'}>
                  <div className="space-y-2">
                    {!!p.completionReviewMeta?.submitted && (
                      <div className={`rounded border px-3 py-2 text-xs ${p.completionReviewMeta?.allVerified ? 'border-emerald-700 bg-emerald-950/30 text-emerald-200' : 'border-amber-700 bg-amber-950/30 text-amber-100'}`}>
                        <p>
                          {p.completionReviewMeta?.allVerified
                            ? 'Project completion verified by admin and customer.'
                            : 'Project completed by lead. Please verify to finalize.'}
                        </p>
                        {!p.completionReviewMeta?.allVerified && (
                          <p className="text-[11px] mt-1 text-amber-200">
                            Admin: {p.completionReviewMeta?.adminVerified ? 'Verified' : 'Pending'} | Customer: {p.completionReviewMeta?.customerVerified ? 'Verified' : 'Pending'}
                          </p>
                        )}
                        {isAdmin && !p.completionReviewMeta?.adminVerified && (
                          <button
                            type="button"
                            onClick={() => handleVerifyCompletion(p._id)}
                            className="mt-2 text-xs px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-500"
                          >
                            Verify as Admin
                          </button>
                        )}
                        {isCustomer && !p.completionReviewMeta?.customerVerified && (
                          <button
                            type="button"
                            onClick={() => handleVerifyCompletion(p._id)}
                            className="mt-2 text-xs px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-500"
                          >
                            Verify as Customer
                          </button>
                        )}
                      </div>
                    )}

                    {isLead && !p.completionReviewMeta?.submitted && Number(p.completion || 0) >= 100 && (
                      <div className="rounded border border-sky-800 bg-sky-950/20 px-3 py-2 text-xs text-sky-100">
                        <p>All tasks are completed. Submit this project for final verification.</p>
                        <button
                          type="button"
                          onClick={() => handleLeadSubmitCompletion(p._id)}
                          className="mt-2 text-xs px-2 py-1 rounded bg-sky-600 text-white hover:bg-sky-500"
                        >
                          Submit Project Complete
                        </button>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-400">Important tasks for {p.name}</p>
                    {(p.milestones || []).length === 0 && (
                      <p className="text-xs text-slate-500">No milestones configured.</p>
                    )}
                    {(p.milestones || []).map((milestone) => (
                      <div key={milestone._id || milestone.title} className="rounded border border-slate-800 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs">
                            <span className="font-medium text-slate-200">{milestone.title}</span>
                            <span className="text-slate-500"> (weight {milestone.weight || 0})</span>
                          </div>
                          <label className="text-xs flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={!!milestone.completed}
                              disabled={!canTrackMilestones || !milestone._id}
                              onChange={(e) => handleMilestoneToggle(p._id, milestone._id, e.target.checked)}
                            />
                            Done
                          </label>
                        </div>
                        {(milestone.subtasks || []).length > 0 && (
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                            {milestone.subtasks.map((subtask) => (
                              <label key={subtask._id || subtask.title} className="text-xs flex items-center justify-between border border-slate-800 rounded px-2 py-1">
                                <span>{subtask.title} <span className="text-slate-500">(w {subtask.weight || 0})</span></span>
                                <input
                                  type="checkbox"
                                  checked={!!subtask.completed}
                                  disabled={!canTrackMilestones || !milestone._id || !subtask._id}
                                  onChange={(e) => handleSubtaskToggle(p._id, milestone._id, subtask._id, e.target.checked)}
                                />
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td
                  colSpan={canEditProject ? '9' : '8'}
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

