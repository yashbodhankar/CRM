import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../state/AuthContext';

const getInitialForm = () => ({
  name: '',
  email: '',
  phone: '',
  department: '',
  role: 'employee',
  teamName: '',
  teamLeadEmail: '',
  status: 'active'
});

function Employees() {
  const { user } = useAuth();
  const isLead = user?.role === 'lead';
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(getInitialForm());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [generatedLogin, setGeneratedLogin] = useState(null);
  const [editingId, setEditingId] = useState(null);

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

  const load = async () => {
    const res = await api.get(isLead ? '/employees?mineTeam=true' : '/employees');
    setEmployees(res.data);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [isLead]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === 'role') {
        if (value === 'lead') {
          next.teamLeadEmail = next.email || '';
          next.teamName = '';
        } else {
          next.teamName = '';
          next.teamLeadEmail = '';
        }
      }

      if (name === 'email' && next.role === 'lead') {
        next.teamLeadEmail = value;
      }

      if (name === 'teamName' && next.role === 'employee') {
        const selectedTeam = teamOptions.find((team) => team.teamName === value);
        next.teamLeadEmail = selectedTeam?.teamLeadEmail || '';
      }

      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setGeneratedLogin(null);

    // basic validation
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }

    if (!form.role) {
      setError('Please select member type.');
      return;
    }

    if (isLead && !editingId) {
      setError('Lead can manage existing team members only. Use Edit from the table.');
      return;
    }

    if (!editingId && form.role === 'employee' && teamOptions.length === 0) {
      setError('No team exists yet. Create a Team Lead first to create a team.');
      return;
    }

    if (!editingId && form.role === 'employee' && !form.teamName) {
      setError('Please select an existing team for this employee.');
      return;
    }

    const payload = { ...form };
    if (payload.role === 'employee') {
      const selectedTeam = teamOptions.find((team) => team.teamName === payload.teamName);
      payload.teamLeadEmail = selectedTeam?.teamLeadEmail || payload.teamLeadEmail;
    }
    if (payload.role === 'lead') {
      payload.teamLeadEmail = payload.email;
    }

    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/employees/${editingId}`, payload);
        setMessage('Employee updated successfully.');
      } else {
        const res = await api.post('/employees', payload);
        if (res.data?.generatedLogin) {
          setGeneratedLogin(res.data.generatedLogin);
        }
        setMessage('Employee added successfully.');
      }
      setForm(getInitialForm());
      setEditingId(null);
      await load();
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || (editingId ? 'Failed to update employee' : 'Failed to add employee');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (emp) => {
    setEditingId(emp._id);
    setForm({
      name: emp.name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      department: emp.department || '',
      role: emp.role || '',
      teamName: emp.teamName || '',
      teamLeadEmail: emp.teamLeadEmail || '',
      status: emp.status || 'active'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(getInitialForm());
    setMessage('');
    setError('');
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this employee?')) return;
    try {
      await api.delete(`/employees/${id}`);
      setMessage('Employee removed.');
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Employees</h2>
          <p className="text-xs text-slate-400">
            {isLead ? 'View and manage your team members.' : 'Manage employees and team leads. Login credentials are auto-generated on create.'}
          </p>
        </div>
      </div>

      {generatedLogin && (
        <div className="text-xs text-emerald-200 bg-emerald-950/40 border border-emerald-900 rounded-xl px-3 py-2">
          Generated login for <span className="font-semibold">{generatedLogin.role}</span> —
          Email: <span className="font-mono"> {generatedLogin.email}</span>,
          Temporary Password: <span className="font-mono"> {generatedLogin.temporaryPassword}</span>
        </div>
      )}

      {isLead && !editingId && (
        <div className="text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
          Team lead mode: click <span className="font-semibold">Edit</span> on a team member to manage their details.
        </div>
      )}

      {(!isLead || editingId) && (
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3"
      >
        {message && (
          <div className="text-green-400 text-sm">{message}</div>
        )}
        {error && (
          <div className="text-rose-400 text-sm">{error}</div>
        )}
        {editingId && (
          <div className="text-sm text-slate-300">Editing employee — <button type="button" onClick={handleCancelEdit} className="underline">Cancel</button></div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">phone</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">department</label>
            <input
              name="department"
              value={form.department}
              onChange={handleChange}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Employee Type</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100"
            >
              <option value="employee">Normal Employee</option>
              <option value="lead">Team Lead</option>
            </select>
          </div>

          {form.role === 'lead' && (
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Team Name (for new lead)</label>
              <input
                name="teamName"
                value={form.teamName}
                onChange={handleChange}
                placeholder="Example: Alpha Team"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          )}

          {form.role === 'employee' && (
            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-400 mb-1">Select Existing Team</label>
              <select
                name="teamName"
                value={form.teamName}
                onChange={handleChange}
                required
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100"
              >
                <option value="">Choose team</option>
                {teamOptions.map((team) => (
                  <option key={team.teamName} value={team.teamName}>
                    {team.teamName} ({team.teamLeadEmail || 'Lead not set'})
                  </option>
                ))}
              </select>
              {teamOptions.length === 0 && (
                <p className="mt-1 text-[11px] text-amber-300">
                  No existing teams found. Create a Team Lead first.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-slate-100"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading || (!editingId && form.role === 'employee' && teamOptions.length === 0)}
            className={`inline-flex items-center justify-center rounded-lg text-xs font-medium text-white px-4 py-1.5 ${loading ? 'bg-primary-400' : 'bg-primary-600 hover:bg-primary-500'}`}
          >
            {loading ? (editingId ? 'Saving...' : 'Adding...') : (editingId ? 'Save changes' : 'Add member')}
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
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Department</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Team</th>
              <th className="px-3 py-2 font-medium">Team Lead</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr
                key={emp._id}
                className="border-t border-slate-800/80 text-slate-200"
              >
                <td className="px-3 py-2">{emp.name}</td>
                <td className="px-3 py-2">{emp.email}</td>
                <td className="px-3 py-2">{emp.department}</td>
                <td className="px-3 py-2">{emp.role}</td>
                <td className="px-3 py-2">{emp.teamName || '-'}</td>
                <td className="px-3 py-2">{emp.teamLeadEmail || '-'}</td>
                <td className="px-3 py-2 capitalize">{emp.status}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(emp)} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-200">Edit</button>
                    {!isLead && <button onClick={() => handleDelete(emp._id)} className="text-xs px-2 py-1 rounded bg-rose-700 text-white">Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td
                  colSpan="8"
                  className="px-3 py-4 text-center text-slate-500 text-xs"
                >
                  No records yet. Add your first employee or lead above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Employees;

