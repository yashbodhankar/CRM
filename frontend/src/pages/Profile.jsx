import React, { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthContext';
import api from '../utils/api';

function Profile() {
  const { user, syncUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [profileInfo, setProfileInfo] = useState(null);

  const [detailsForm, setDetailsForm] = useState({ name: '', email: '' });
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsFeedback, setDetailsFeedback] = useState('');

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      setLoading(true);
      setProfileError('');
      try {
        const res = await api.get('/auth/me');
        if (!mounted) return;
        const info = res.data || null;
        setProfileInfo(info);
        setDetailsForm({
          name: String(info?.name || ''),
          email: String(info?.email || '')
        });
        if (info) {
          syncUser(info);
        }
      } catch (error) {
        if (!mounted) return;
        setProfileError(error?.response?.data?.message || 'Failed to load profile details');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [syncUser]);

  if (!user) {
    return null;
  }

  const updateDetails = async (e) => {
    e.preventDefault();
    setDetailsFeedback('');

    const payload = {
      name: detailsForm.name.trim(),
      email: detailsForm.email.trim()
    };

    if (!payload.name || !payload.email) {
      setDetailsFeedback('Name and email are required');
      return;
    }

    setDetailsSaving(true);
    try {
      const res = await api.put('/auth/me', payload);
      const info = res.data || null;
      setProfileInfo(info);
      syncUser(info);
      setDetailsFeedback('Profile details updated successfully');
    } catch (error) {
      setDetailsFeedback(error?.response?.data?.message || 'Failed to update profile details');
    } finally {
      setDetailsSaving(false);
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    setPasswordFeedback('');

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordFeedback('Current password and new password are required');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback('New password and confirmation do not match');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await api.put('/auth/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordFeedback(res.data?.message || 'Password updated successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordFeedback(error?.response?.data?.message || 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const createdAt = profileInfo?.createdAt ? new Date(profileInfo.createdAt).toLocaleString() : '-';
  const updatedAt = profileInfo?.updatedAt ? new Date(profileInfo.updatedAt).toLocaleString() : '-';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-50">Profile</h2>
        <p className="text-xs text-slate-400">
          View full account details from database and manage your own account.
        </p>
      </div>

      {profileError && (
        <div className="text-xs text-rose-300 bg-rose-900/20 border border-rose-800 rounded-lg px-3 py-2">
          {profileError}
        </div>
      )}

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-sm space-y-2">
        <div className="space-y-2">
          <div>
            <p className="text-[11px] text-slate-400">User ID</p>
            <p className="text-slate-100 font-mono break-all">{profileInfo?.id || user.id || '-'}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Name</p>
            <p className="text-slate-100">{profileInfo?.name || user.name || '-'}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Email</p>
            <p className="text-slate-100">{profileInfo?.email || user.email || '-'}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Role</p>
            <p className="text-slate-100 capitalize">{profileInfo?.role || user.role}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Account Source</p>
            <p className="text-slate-100 uppercase tracking-wide">{profileInfo?.source || '-'}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Created At</p>
            <p className="text-slate-100">{createdAt}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Last Updated</p>
            <p className="text-slate-100">{updatedAt}</p>
          </div>
        </div>
      </div>

      <form onSubmit={updateDetails} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-sm space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">Edit Your Details</h3>
        {detailsFeedback && (
          <div className="text-xs text-emerald-200 bg-emerald-900/20 border border-emerald-800 rounded-lg px-3 py-2">
            {detailsFeedback}
          </div>
        )}
        <div>
          <label className="block text-xs text-slate-300 mb-1">Name</label>
          <input
            value={detailsForm.name}
            onChange={(e) => setDetailsForm((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300 mb-1">Email</label>
          <input
            type="email"
            value={detailsForm.email}
            onChange={(e) => setDetailsForm((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <button
          type="submit"
          disabled={detailsSaving || loading}
          className="rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white px-3 py-2 text-xs"
        >
          {detailsSaving ? 'Saving...' : 'Save details'}
        </button>
      </form>

      <form onSubmit={updatePassword} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-sm space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">Change Your Password</h3>
        {passwordFeedback && (
          <div className="text-xs text-emerald-200 bg-emerald-900/20 border border-emerald-800 rounded-lg px-3 py-2">
            {passwordFeedback}
          </div>
        )}
        <div>
          <label className="block text-xs text-slate-300 mb-1">Current Password</label>
          <input
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300 mb-1">New Password</label>
          <input
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300 mb-1">Confirm New Password</label>
          <input
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <button
          type="submit"
          disabled={passwordSaving || loading}
          className="rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white px-3 py-2 text-xs"
        >
          {passwordSaving ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

export default Profile;

