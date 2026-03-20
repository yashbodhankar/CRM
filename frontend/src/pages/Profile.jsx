import React from 'react';
import { useAuth } from '../state/AuthContext';

function Profile() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-50">Profile</h2>
        <p className="text-xs text-slate-400">
          Your basic account information.
        </p>
      </div>
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-sm">
        <div className="space-y-2">
          <div>
            <p className="text-[11px] text-slate-400">Name</p>
            <p className="text-slate-100">{user.name}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Email</p>
            <p className="text-slate-100">{user.email}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Role</p>
            <p className="text-slate-100 capitalize">{user.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;

