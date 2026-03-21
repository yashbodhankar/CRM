import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';

const STAGES = ['new', 'qualified', 'proposal', 'negotiation', 'converted', 'won', 'lost'];

function Deals() {
  const [deals, setDeals] = useState([]);
  const [filters, setFilters] = useState({ search: '', stage: '', sort: 'newest' });
  const [form, setForm] = useState({ title: '', value: '', stage: 'new', expectedCloseDate: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dragDealId, setDragDealId] = useState('');
  const [dropStage, setDropStage] = useState('');

  const grouped = useMemo(() => {
    return STAGES.reduce((acc, stage) => {
      acc[stage] = deals.filter((d) => d.stage === stage);
      return acc;
    }, {});
  }, [deals]);

  async function loadDeals() {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (String(v || '').trim()) params.set(k, v);
      });
      const res = await api.get(`/deals?${params.toString()}`);
      setDeals(res.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load deals');
    }
  }

  useEffect(() => {
    loadDeals();
  }, [filters.search, filters.stage, filters.sort]);

  async function createDeal(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.post('/deals', {
        ...form,
        value: Number(form.value || 0),
        expectedCloseDate: form.expectedCloseDate || undefined
      });
      setForm({ title: '', value: '', stage: 'new', expectedCloseDate: '' });
      setMessage('Deal created');
      await loadDeals();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create deal');
    }
  }

  async function moveStage(id, stage) {
    try {
      await api.patch(`/deals/${id}`, { stage });
      await loadDeals();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update stage');
    }
  }

  async function deleteDeal(id) {
    if (!confirm('Delete this deal?')) return;
    try {
      await api.delete(`/deals/${id}`);
      setMessage('Deal deleted');
      await loadDeals();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete deal');
    }
  }

  function handleDragStart(e, dealId) {
    setDragDealId(dealId);
    e.dataTransfer.setData('text/plain', dealId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, stage) {
    e.preventDefault();
    setDropStage(stage);
    e.dataTransfer.dropEffect = 'move';
  }

  async function handleDrop(e, stage) {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/plain') || dragDealId;
    setDropStage('');
    setDragDealId('');
    if (!dealId) return;
    await moveStage(dealId, stage);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-50">Deals Pipeline</h2>
        <p className="text-xs text-slate-400">Track opportunity movement from qualification to closure.</p>
      </div>

      {message && <div className="text-sm text-emerald-400">{message}</div>}
      {error && <div className="text-sm text-rose-400">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 rounded-2xl bg-slate-900 border border-slate-800 p-4 h-fit">
          <h3 className="text-sm text-slate-100 mb-3">Create Deal</h3>
          <form onSubmit={createDeal} className="space-y-2">
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required placeholder="Deal title" className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
            <input value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} type="number" min="0" placeholder="Value" className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
            <select value={form.stage} onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value }))} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100">
              {STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input type="date" value={form.expectedCloseDate} onChange={(e) => setForm((p) => ({ ...p, expectedCloseDate: e.target.value }))} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
            <button className="rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs px-3 py-2">Create</button>
          </form>

          <hr className="my-4 border-slate-800" />

          <h3 className="text-sm text-slate-100 mb-3">Filter</h3>
          <div className="space-y-2">
            <input value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} placeholder="Search title/customer" className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100" />
            <select value={filters.stage} onChange={(e) => setFilters((p) => ({ ...p, stage: e.target.value }))} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100">
              <option value="">All stages</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={filters.sort} onChange={(e) => setFilters((p) => ({ ...p, sort: e.target.value }))} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="value_desc">Value high to low</option>
              <option value="value_asc">Value low to high</option>
            </select>
          </div>
        </div>

        <div className="lg:col-span-3 overflow-x-auto">
          <div className="min-w-[980px] grid grid-cols-6 gap-3">
            {STAGES.map((stage) => (
              <div
                key={stage}
                onDragOver={(e) => handleDragOver(e, stage)}
                onDrop={(e) => handleDrop(e, stage)}
                onDragLeave={() => setDropStage('')}
                className={`rounded-2xl bg-slate-900 border ${dropStage === stage ? 'border-primary-500' : 'border-slate-800'}`}
              >
                <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-slate-300">{stage}</span>
                  <span className="text-[11px] text-slate-500">{grouped[stage]?.length || 0}</span>
                </div>
                <div className="p-2 space-y-2 max-h-[520px] overflow-y-auto">
                  {(grouped[stage] || []).map((deal) => (
                    <div
                      key={deal._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal._id)}
                      className="rounded-lg border border-slate-800 p-2 bg-slate-950/60 cursor-grab active:cursor-grabbing"
                    >
                      <p className="text-xs text-slate-100 font-medium">{deal.title}</p>
                      <p className="text-[11px] text-slate-400">Value: ${(deal.value || 0).toLocaleString()}</p>
                      <p className="text-[11px] text-slate-500">Updated: {new Date(deal.updatedAt).toLocaleDateString()}</p>
                      <div className="mt-2">
                        <button onClick={() => deleteDeal(deal._id)} className="text-[11px] px-2 py-1 rounded bg-rose-700 text-white">Delete</button>
                      </div>
                      <select value={deal.stage} onChange={(e) => moveStage(deal._id, e.target.value)} className="mt-2 w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-[11px] text-slate-100">
                        {STAGES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {(grouped[stage] || []).length === 0 && <p className="text-[11px] text-slate-500">No deals.</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Deals;
