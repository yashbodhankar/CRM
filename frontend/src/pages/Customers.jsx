import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';

const DEFAULT_FORM = {
  name: '',
  company: '',
  email: '',
  phone: '',
  address: '',
  status: 'active'
};

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [timeline, setTimeline] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [interaction, setInteraction] = useState({ type: 'call', title: '', details: '', happenedAt: '' });
  const [filters, setFilters] = useState({ search: '', status: '', activityType: '', from: '', to: '', sort: 'newest' });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [generatedLogin, setGeneratedLogin] = useState(null);

  const uploadsBase = useMemo(() => {
    const apiBase = api.defaults.baseURL
      || `${String(import.meta.env.VITE_API_URL || 'http://localhost:5003').replace(/\/$/, '')}/api`;
    return apiBase.replace(/\/api\/?$/, '');
  }, []);

  async function loadCustomers() {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (String(v || '').trim()) params.set(k, v);
      });
      const res = await api.get(`/customers?${params.toString()}`);
      const list = res.data || [];
      setCustomers(list);
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0]._id);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load customers');
    }
  }

  async function loadTimeline(customerId) {
    if (!customerId) return;
    try {
      const res = await api.get(`/customers/${customerId}/timeline`);
      setTimeline(res.data?.timeline || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load timeline');
    }
  }

  useEffect(() => {
    loadCustomers();
  }, [filters.search, filters.status, filters.activityType, filters.from, filters.to, filters.sort]);

  useEffect(() => {
    loadTimeline(selectedId);
  }, [selectedId]);

  async function createCustomer(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setGeneratedLogin(null);
    setLoading(true);
    try {
      const res = editingCustomerId
        ? await api.put(`/customers/${editingCustomerId}`, form)
        : await api.post('/customers', form);

      if (!editingCustomerId && res.data?.generatedLogin) {
        setGeneratedLogin(res.data.generatedLogin);
        setMessage('Customer created and login generated');
      } else if (!editingCustomerId) {
        setMessage('Customer created (login already exists for this email)');
      } else {
        setMessage('Customer updated');
      }

      setForm(DEFAULT_FORM);
      setEditingCustomerId('');
      await loadCustomers();
      setSelectedId(res.data?._id || selectedId);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  }

  async function addInteraction(e) {
    e.preventDefault();
    if (!selectedId) return;
    setError('');
    setMessage('');
    try {
      await api.post(`/customers/${selectedId}/interactions`, {
        ...interaction,
        happenedAt: interaction.happenedAt || undefined
      });
      setMessage('Interaction added');
      setInteraction({ type: 'call', title: '', details: '', happenedAt: '' });
      await loadTimeline(selectedId);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to add interaction');
    }
  }

  async function uploadDocument(e) {
    e.preventDefault();
    if (!selectedId || !file) return;
    setError('');
    setMessage('');
    try {
      const data = new FormData();
      data.append('file', file);
      await api.post(`/customers/${selectedId}/documents`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage('Document uploaded');
      setFile(null);
      await loadTimeline(selectedId);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to upload document');
    }
  }

  function startEditCustomer(customer) {
    setEditingCustomerId(customer._id);
    setForm({
      name: customer.name || '',
      company: customer.company || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      status: customer.status || 'active'
    });
  }

  async function deleteCustomer(id) {
    if (!confirm('Delete this customer?')) return;
    try {
      await api.delete(`/customers/${id}`);
      setMessage('Customer deleted');
      if (selectedId === id) setSelectedId('');
      if (editingCustomerId === id) {
        setEditingCustomerId('');
        setForm(DEFAULT_FORM);
      }
      await loadCustomers();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete customer');
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-50">Customers</h2>
        <p className="text-xs text-slate-400">Manage customers, track interactions, attach documents, and generate customer login on create.</p>
      </div>

      {message && <div className="text-sm text-emerald-400">{message}</div>}
      {error && <div className="text-sm text-rose-400">{error}</div>}
      {generatedLogin && (
        <div className="text-xs text-emerald-200 bg-emerald-950/40 border border-emerald-900 rounded-xl px-3 py-2">
          Customer login created -
          Email: <span className="font-mono"> {generatedLogin.email}</span>,
          Temporary Password: <span className="font-mono"> {generatedLogin.temporaryPassword}</span>
        </div>
      )}

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
        <input value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} placeholder="Search name/email/phone" className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
        <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100">
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="lead">Lead</option>
        </select>
        <select value={filters.activityType} onChange={(e) => setFilters((p) => ({ ...p, activityType: e.target.value }))} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100">
          <option value="">Any activity</option>
          <option value="call">Call</option>
          <option value="email">Email</option>
          <option value="meeting">Meeting</option>
          <option value="note">Note</option>
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
        <input type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
        <select value={filters.sort} onChange={(e) => setFilters((p) => ({ ...p, sort: e.target.value }))} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name_asc">Name A-Z</option>
          <option value="name_desc">Name Z-A</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 text-sm text-slate-200">Customer List</div>
          <div className="max-h-[440px] overflow-y-auto divide-y divide-slate-800">
            {customers.map((c) => (
              <div key={c._id} className={`p-3 ${selectedId === c._id ? 'bg-primary-500/10' : 'hover:bg-slate-800/60'}`}>
                <button onClick={() => setSelectedId(c._id)} className="w-full text-left">
                  <p className="text-sm text-slate-100 font-medium">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.email}</p>
                  <p className="text-[11px] text-slate-500 capitalize">{c.status || 'active'}</p>
                </button>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => startEditCustomer(c)} className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-200">Edit</button>
                  <button onClick={() => deleteCustomer(c._id)} className="text-[11px] px-2 py-1 rounded bg-rose-700 text-white">Delete</button>
                </div>
              </div>
            ))}
            {customers.length === 0 && <div className="p-3 text-xs text-slate-500">No customers found.</div>}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <h3 className="text-sm text-slate-100 mb-3">{editingCustomerId ? 'Update Customer' : 'Create Customer'}</h3>
          <form onSubmit={createCustomer} className="space-y-2">
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required placeholder="Name" className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
            <input value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} placeholder="Company" className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
            <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required placeholder="Email" className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
            <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
            <input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Address" className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="lead">Lead</option>
            </select>
            <div className="flex gap-2">
              <button disabled={loading} className="rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs px-3 py-2">{loading ? 'Saving...' : editingCustomerId ? 'Update' : 'Create'}</button>
              {editingCustomerId && (
                <button
                  type="button"
                  onClick={() => { setEditingCustomerId(''); setForm(DEFAULT_FORM); }}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs px-3 py-2"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <hr className="my-4 border-slate-800" />

          <h3 className="text-sm text-slate-100 mb-3">Add Interaction</h3>
          <form onSubmit={addInteraction} className="space-y-2">
            <select value={interaction.type} onChange={(e) => setInteraction((p) => ({ ...p, type: e.target.value }))} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100">
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="note">Note</option>
            </select>
            <input value={interaction.title} onChange={(e) => setInteraction((p) => ({ ...p, title: e.target.value }))} required placeholder="Interaction title" className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
            <textarea value={interaction.details} onChange={(e) => setInteraction((p) => ({ ...p, details: e.target.value }))} rows="2" placeholder="Details" className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
            <input type="datetime-local" value={interaction.happenedAt} onChange={(e) => setInteraction((p) => ({ ...p, happenedAt: e.target.value }))} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
            <button disabled={!selectedId} className="rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3 py-2">Add interaction</button>
          </form>

          <hr className="my-4 border-slate-800" />
          <h3 className="text-sm text-slate-100 mb-3">Upload Document</h3>
          <form onSubmit={uploadDocument} className="space-y-2">
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
            <button disabled={!selectedId || !file} className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs px-3 py-2">Upload</button>
          </form>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 text-sm text-slate-200">Customer Timeline</div>
          <div className="p-3 space-y-2 max-h-[440px] overflow-y-auto">
            {timeline.map((item, idx) => (
              <div key={`${item.kind}-${idx}`} className="rounded-lg border border-slate-800 p-2">
                <p className="text-xs text-slate-200 font-medium">[{item.kind}] {item.title}</p>
                <p className="text-xs text-slate-400">{item.details || '-'}</p>
                <p className="text-[11px] text-slate-500">{item.at ? new Date(item.at).toLocaleString() : '-'}</p>
                {item.kind === 'document' && item.path && (
                  <a href={`${uploadsBase}/${String(item.path).replace(/\\/g, '/')}`} target="_blank" rel="noreferrer" className="text-xs text-sky-400 underline">
                    Preview / Download
                  </a>
                )}
              </div>
            ))}
            {timeline.length === 0 && <p className="text-xs text-slate-500">No timeline entries.</p>}
          </div>
        </div>
      </div>

    </div>
  );
}

export default Customers;
