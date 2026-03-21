import React, { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthContext';
import { useTheme } from '../state/ThemeContext';
import { Bell, Menu, Moon, Sun } from 'lucide-react';

function Navbar({ sidebarOpen, setSidebarOpen }) {
  const { user, logout } = useAuth();
  const { isLight, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadNotifications() {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/notifications?limit=10`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setNotifications(Array.isArray(data) ? data : []);
      } catch {
        // Silent fail to avoid breaking top nav.
      }
    }

    loadNotifications();
    const timer = setInterval(loadNotifications, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className={`h-16 border-b flex items-center justify-between px-4 md:px-6 backdrop-blur relative ${isLight ? 'border-slate-200 bg-white/90' : 'border-slate-800 bg-slate-900/80'}`}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`md:hidden p-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-200'}`}
        >
          <Menu className="w-4 h-4" />
        </button>
        <h1 className={`text-lg font-semibold ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>Overview</h1>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-200'}`}
          title="Toggle theme"
        >
          {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        <button
          onClick={() => setShowNotifications((prev) => !prev)}
          className={`relative p-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-200'}`}
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] px-1">
              {unreadCount}
            </span>
          )}
        </button>

        {user && (
          <div className="text-right">
            <p className={`text-sm font-medium ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>{user.name}</p>
            <p className="text-xs text-slate-400 capitalize">{user.role}</p>
          </div>
        )}
        <button
          onClick={logout}
          className={`ml-2 text-xs px-3 py-1.5 rounded-full border ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-slate-700 text-slate-200 hover:bg-slate-800'}`}
        >
          Logout
        </button>
      </div>

      {showNotifications && (
        <div className={`absolute right-3 top-14 w-80 max-h-80 overflow-y-auto rounded-xl border shadow-xl z-50 ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}>
          <div className={`px-3 py-2 text-xs border-b ${isLight ? 'border-slate-200 text-slate-700' : 'border-slate-700 text-slate-200'}`}>
            Notifications
          </div>
          <div className="divide-y divide-slate-700/40">
            {notifications.map((item) => (
              <div key={item._id} className="px-3 py-2 text-xs">
                <p className={`font-medium ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>{item.title}</p>
                <p className={isLight ? 'text-slate-600' : 'text-slate-300'}>{item.message}</p>
              </div>
            ))}
            {notifications.length === 0 && (
              <div className={`px-3 py-4 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                No notifications yet.
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;

