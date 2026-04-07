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
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState('');

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
        setLastSyncedAt(new Date());
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
  const initials = String(profileInfo?.name || user.name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
  const avatarUrl = avatarPreview
    || (profileInfo?.avatarUrl
      ? (String(profileInfo.avatarUrl).startsWith('http')
        ? String(profileInfo.avatarUrl)
        : `${String(api.defaults.baseURL || '').replace(/\/api\/?$/, '')}${profileInfo.avatarUrl}`)
      : '');

  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const identityRows = [
    { label: 'User ID', value: profileInfo?.id || user.id || '-', mono: true },
    { label: 'Full Name', value: profileInfo?.name || user.name || '-' },
    { label: 'Email Address', value: profileInfo?.email || user.email || '-' },
    { label: 'Role', value: String(profileInfo?.role || user.role || '-').toUpperCase() },
    { label: 'Account Source', value: String(profileInfo?.source || '-').toUpperCase() },
    { label: 'Password Status', value: profileInfo?.passwordConfigured ? 'Configured' : 'Not configured' },
    { label: 'Created At', value: createdAt },
    { label: 'Last Updated', value: updatedAt },
    {
      label: 'Last Synced',
      value: lastSyncedAt ? lastSyncedAt.toLocaleString() : '-'
    }
  ];

  const uploadAvatar = async (e) => {
    e.preventDefault();
    setAvatarFeedback('');

    if (!avatarFile) {
      setAvatarFeedback('Please choose an image first');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', avatarFile);

    setAvatarUploading(true);
    try {
      const res = await api.post('/auth/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const nextProfile = res.data?.profile;
      if (nextProfile) {
        setProfileInfo((prev) => ({ ...prev, ...nextProfile }));
        syncUser(nextProfile);
      }
      setAvatarFile(null);
      setAvatarPreview('');
      setAvatarFeedback(res.data?.message || 'Avatar updated successfully');
    } catch (error) {
      setAvatarFeedback(error?.response?.data?.message || 'Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Profile</h2>
          <p className="text-xs text-slate-400">
            View your complete account details and manage identity and security settings.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs px-3 py-2"
        >
          Reload Profile
        </button>
      </div>

      {profileError && (
        <div className="text-xs text-rose-300 bg-rose-900/20 border border-rose-800 rounded-lg px-3 py-2">
          {profileError}
        </div>
      )}

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-sm">
        <div className="flex items-center gap-3 mb-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile avatar"
              className="h-12 w-12 rounded-full object-cover border border-sky-400/40"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-200 flex items-center justify-center text-base font-semibold">
              {initials}
            </div>
          )}
          <div>
            <p className="text-slate-100 font-medium">{profileInfo?.name || user.name || 'User'}</p>
            <p className="text-xs text-slate-400">{profileInfo?.email || user.email || '-'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {identityRows.map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
              <p className="text-[11px] text-slate-400 mb-0.5">{item.label}</p>
              <p className={`text-slate-100 ${item.mono ? 'font-mono break-all text-xs' : 'text-sm'}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={uploadAvatar} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-sm space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">Profile Photo</h3>
        {avatarFeedback && (
          <div className={`text-xs rounded-lg px-3 py-2 border ${avatarFeedback.toLowerCase().includes('fail') || avatarFeedback.toLowerCase().includes('please') ? 'text-rose-300 bg-rose-900/20 border-rose-800' : 'text-emerald-200 bg-emerald-900/20 border-emerald-800'}`}>
            {avatarFeedback}
          </div>
        )}
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setAvatarFile(file);
              if (file) {
                setAvatarPreview(URL.createObjectURL(file));
              } else {
                setAvatarPreview('');
              }
            }}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100"
          />
          <button
            type="submit"
            disabled={avatarUploading || !avatarFile}
            className="rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white px-3 py-2 text-xs"
          >
            {avatarUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        <p className="text-[11px] text-slate-500">Accepted format: image files up to 3MB.</p>
      </form>

      <form onSubmit={updateDetails} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-sm space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">Edit Account Details</h3>
        {detailsFeedback && (
          <div className={`text-xs rounded-lg px-3 py-2 border ${detailsFeedback.toLowerCase().includes('fail') || detailsFeedback.toLowerCase().includes('required') || detailsFeedback.toLowerCase().includes('already') ? 'text-rose-300 bg-rose-900/20 border-rose-800' : 'text-emerald-200 bg-emerald-900/20 border-emerald-800'}`}>
            {detailsFeedback}
          </div>
        )}
        <div>
          <label className="block text-xs text-slate-300 mb-1">Name</label>
          <input
            value={detailsForm.name}
            onChange={(e) => setDetailsForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Your full name"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300 mb-1">Email</label>
          <input
            type="email"
            value={detailsForm.email}
            onChange={(e) => setDetailsForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="you@company.com"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">Changes update your account identity everywhere in the app.</p>
          <button
            type="submit"
            disabled={detailsSaving || loading}
            className="rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white px-3 py-2 text-xs"
          >
            {detailsSaving ? 'Saving...' : 'Save details'}
          </button>
        </div>
      </form>

      <form onSubmit={updatePassword} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-sm space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">Change Your Password</h3>
        {passwordFeedback && (
          <div className={`text-xs rounded-lg px-3 py-2 border ${passwordFeedback.toLowerCase().includes('fail') || passwordFeedback.toLowerCase().includes('incorrect') || passwordFeedback.toLowerCase().includes('required') ? 'text-rose-300 bg-rose-900/20 border-rose-800' : 'text-emerald-200 bg-emerald-900/20 border-emerald-800'}`}>
            {passwordFeedback}
          </div>
        )}
        <div>
          <label className="block text-xs text-slate-300 mb-1">Current Password</label>
          <input
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300 mb-1">New Password</label>
          <input
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300 mb-1">Confirm New Password</label>
          <input
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <p className="text-[11px] text-slate-500">Use at least 6 characters and keep passwords unique.</p>
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

