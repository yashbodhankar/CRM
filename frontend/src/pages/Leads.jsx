import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../state/AuthContext';

function Leads() {
  const { user } = useAuth();
  const isLead = user?.role === 'lead';
  const [leads, setLeads] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [form, setForm] = useState({
    customerName: '',
    email: '',
    phone: '',
    source: '',
    status: 'new',
    expectedValue: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [taskDraftByLead, setTaskDraftByLead] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (sortBy) params.set('sort', sortBy);
      const leadReq = api.get(`/leads?${params.toString()}`);
      const teamReq = isLead ? api.get('/employees?mineTeam=true') : Promise.resolve({ data: [] });
      const [res, teamRes] = await Promise.all([leadReq, teamReq]);
      setLeads(res.data || []);
      setTeamMembers(teamRes.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load leads');
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [isLead, search, statusFilter, sortBy]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!form.customerName.trim() || !form.email.trim()) {
      setError('Customer name and email are required.');
      return;
    }

    setLoading(true);
    try {
      const payload = { ...form, expectedValue: Number(form.expectedValue || 0) };
      if (editingId) {
        await api.put(`/leads/${editingId}`, payload);
        setMessage('Lead updated successfully.');
      } else {
        await api.post('/leads', payload);
        setMessage('Lead added successfully.');
      }
      setForm({ customerName: '', email: '', phone: '', source: '', status: 'new', expectedValue: '' });
      setEditingId(null);
      await load();
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || (editingId ? 'Failed to update lead' : 'Failed to add lead');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (lead) => {
    setEditingId(lead._id);
    setForm({
      customerName: lead.customerName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      source: lead.source || '',
      status: lead.status || 'new',
      expectedValue: lead.expectedValue || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ customerName: '', email: '', phone: '', source: '', status: 'new', expectedValue: '' });
    setMessage('');
    setError('');
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this lead?')) return;
    try {
      await api.delete(`/leads/${id}`);
      setMessage('Lead removed.');
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete');
    }
  };

  const openTaskAssign = (lead) => {
    setTaskDraftByLead((prev) => ({
      ...prev,
      [lead._id]: {
        assignedEmail: prev[lead._id]?.assignedEmail || '',
        dailyDate: prev[lead._id]?.dailyDate || '',
        priority: prev[lead._id]?.priority || 'medium'
      }
    }));
  };

  const updateTaskDraft = (leadId, key, value) => {
    setTaskDraftByLead((prev) => ({
      ...prev,
      [leadId]: {
        assignedEmail: prev[leadId]?.assignedEmail || '',
        dailyDate: prev[leadId]?.dailyDate || '',
        priority: prev[leadId]?.priority || 'medium',
        [key]: value
      }
    }));
  };

  const assignTaskFromLead = async (lead) => {
    const draft = taskDraftByLead[lead._id] || {};
    if (!draft.assignedEmail) {
      setError('Select team member to assign task.');
      return;
    }

    try {
      await api.post('/tasks', {
        title: `Follow up: ${lead.customerName || 'Lead'}`,
        description: `Lead follow-up for ${lead.customerName || '-'} (${lead.email || '-'}) from ${lead.source || 'unknown source'}`,
        assignedEmail: draft.assignedEmail,
        dailyDate: draft.dailyDate || null,
        priority: draft.priority || 'medium',
        status: 'pending'
      });
      setMessage('Task assigned from lead successfully.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to assign task');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Leads</h2>
          <p className="text-xs text-slate-400">
            Track incoming leads and their status in the pipeline.
          </p>
        </div>
      </div>

      {isLead && (
        <div className="text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
          Lead mode: you can create follow-up tasks for team members directly from each lead row.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3"
      >
        {message && <div className="text-green-400 text-sm">{message}</div>}
        {error && <div className="text-rose-400 text-sm">{error}</div>}
        {editingId && (
          <div className="text-sm text-slate-300">
            Editing lead — <button type="button" onClick={handleCancelEdit} className="underline">Cancel</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {['customerName', 'email', 'phone', 'source', 'expectedValue'].map(
            (field) => (
              <div key={field}>
                <label className="block text-[11px] text-slate-400 mb-1 capitalize">
                  {field.replace('customerName', 'Customer')}
                </label>
                <input
                  name={field}
                  value={form[field]}
                  onChange={handleChange}
                  required={field === 'customerName' || field === 'email'}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            )
          )}
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
              {['new', 'qualified', 'negotiation', 'won', 'lost'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className={`inline-flex items-center justify-center rounded-lg text-xs font-medium text-white px-4 py-1.5 ${loading ? 'bg-primary-400' : 'bg-primary-600 hover:bg-primary-500'}`}
          >
            {loading ? (editingId ? 'Saving...' : 'Adding...') : (editingId ? 'Save changes' : 'Add lead')}
          </button>
          {editingId && (
            <button type="button" onClick={handleCancelEdit} className="text-xs px-3 py-1 rounded-md bg-slate-800 text-slate-200">Cancel</button>
          )}
        </div>
      </form>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, phone, source"
          className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100"
        >
          <option value="">All status</option>
          <option value="new">New</option>
          <option value="qualified">Qualified</option>
          <option value="negotiation">Negotiation</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="value_desc">Highest value</option>
          <option value="value_asc">Lowest value</option>
        </select>
        <button
          onClick={() => {
            setSearch('');
            setStatusFilter('');
            setSortBy('newest');
          }}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-100 px-3 py-2"
        >
          Reset filters
        </button>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800">
            <tr className="text-left text-slate-400">
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="px-3 py-2 font-medium">Actions</th>
              {isLead && <th className="px-3 py-2 font-medium">Lead Task Assignment</th>}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead._id}
                className="border-t border-slate-800/80 text-slate-200"
              >
                <td className="px-3 py-2">{lead.customerName}</td>
                <td className="px-3 py-2">{lead.email}</td>
                <td className="px-3 py-2">{lead.source}</td>
                <td className="px-3 py-2 capitalize">{lead.status}</td>
                <td className="px-3 py-2">
                  {lead.expectedValue ? `₹${lead.expectedValue}` : '-'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(lead)} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200">Edit</button>
                    <button onClick={() => handleDelete(lead._id)} className="text-xs px-2 py-1 rounded bg-rose-700 text-white">Delete</button>
                  </div>
                </td>
                {isLead && (
                  <td className="px-3 py-2">
                    <div className="space-y-2">
                      <button onClick={() => openTaskAssign(lead)} className="text-xs px-2 py-1 rounded bg-primary-700 text-white">
                        Assign task
                      </button>
                      {taskDraftByLead[lead._id] && (
                        <div className="grid grid-cols-1 gap-1">
                          <select
                            value={taskDraftByLead[lead._id]?.assignedEmail || ''}
                            onChange={(e) => updateTaskDraft(lead._id, 'assignedEmail', e.target.value)}
                            className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-[11px] text-slate-100"
                          >
                            <option value="">Select team member</option>
                            {teamMembers.map((m) => (
                              <option key={m._id} value={m.email}>{m.name} ({m.email})</option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={taskDraftByLead[lead._id]?.dailyDate || ''}
                            onChange={(e) => updateTaskDraft(lead._id, 'dailyDate', e.target.value)}
                            className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-[11px] text-slate-100"
                          />
                          <select
                            value={taskDraftByLead[lead._id]?.priority || 'medium'}
                            onChange={(e) => updateTaskDraft(lead._id, 'priority', e.target.value)}
                            className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-[11px] text-slate-100"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                          <button onClick={() => assignTaskFromLead(lead)} className="text-[11px] px-2 py-1 rounded bg-emerald-700 text-white">
                            Save task
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td
                  colSpan={isLead ? '7' : '6'}
                  className="px-3 py-4 text-center text-slate-500 text-xs"
                >
                  No leads yet. Capture your first opportunity above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Leads;

