import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useTheme } from '../state/ThemeContext';

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isLight } = useTheme();

  return (
    <div className={`min-h-screen flex ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-50'}`}>
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col">
        <Navbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className={`flex-1 p-4 md:p-6 shadow-inner ${isLight ? 'bg-white md:rounded-tl-3xl' : 'bg-slate-900 md:rounded-tl-3xl'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;

