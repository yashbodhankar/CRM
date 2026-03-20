import React from 'react';
import { useAuth } from '../state/AuthContext';

function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/80 backdrop-blur">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Overview</h1>
        <p className="text-xs text-slate-400">
          Track your team, pipeline, and projects in one place.
        </p>
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <div className="text-right">
            <p className="text-sm font-medium text-slate-100">{user.name}</p>
            <p className="text-xs text-slate-400 capitalize">{user.role}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="ml-2 text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-200 hover:bg-slate-800"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

export default Navbar;

