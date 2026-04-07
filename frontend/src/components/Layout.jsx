import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useTheme } from '../state/ThemeContext';

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isLight } = useTheme();

  return (
    <div className={`min-h-screen flex relative overflow-hidden ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className={`absolute -top-24 -left-20 h-72 w-72 rounded-full blur-3xl ${isLight ? 'bg-sky-300/35' : 'bg-sky-500/20'}`} />
        <div className={`absolute top-16 -right-20 h-72 w-72 rounded-full blur-3xl ${isLight ? 'bg-emerald-300/30' : 'bg-emerald-500/15'}`} />
      </div>
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col">
        <Navbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className={`flex-1 p-4 md:p-6 md:pt-5 ${isLight ? 'bg-white/78 border border-slate-200/70 md:rounded-tl-3xl md:rounded-bl-3xl backdrop-blur' : 'bg-slate-900/72 border border-slate-700/40 md:rounded-tl-3xl md:rounded-bl-3xl backdrop-blur'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;

