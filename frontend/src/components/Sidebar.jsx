import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Squares2X2Icon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  FolderIcon,
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../state/AuthContext';
import { useTheme } from '../state/ThemeContext';
import logo from '../../logo.png';

const links = [
  { to: '/', label: 'Dashboard', icon: Squares2X2Icon },
  { to: '/employees', label: 'Employees', icon: UserGroupIcon },
  { to: '/leads', label: 'Leads', icon: ArrowTrendingUpIcon },
  { to: '/projects', label: 'Projects', icon: FolderIcon },
  { to: '/tasks', label: 'Tasks', icon: ClipboardDocumentListIcon },
  { to: '/chat', label: 'Chat', icon: ChatBubbleLeftRightIcon },
  { to: '/reports', label: 'Analytics', icon: ChartBarIcon },
  { to: '/profile', label: 'Profile', icon: UserCircleIcon }
];

function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const { user } = useAuth();
  const { isLight } = useTheme();
  const role = user?.role;
  const visibleLinks = role === 'employee'
    ? links.filter((item) => ['/', '/projects', '/tasks', '/chat', '/profile'].includes(item.to))
    : role === 'lead'
      ? links.filter((item) => ['/', '/employees', '/tasks', '/projects', '/chat', '/reports', '/profile'].includes(item.to))
      : role === 'customer'
        ? links.filter((item) => ['/', '/projects', '/chat', '/profile'].includes(item.to))
      : links;

  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed md:static z-40 top-0 left-0 h-full md:h-auto w-60 border-r px-4 py-6 transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
      <div className="mb-8">
        <div className="flex items-center gap-2 text-primary-400 font-semibold text-lg">
          <img src={logo} alt="CRM Pro logo" className="h-8 w-8 rounded-xl object-cover" />
          <span>CRM Pro</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">Team & customer insights</p>
      </div>
      <nav className="space-y-1">
        {visibleLinks.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                isActive
                  ? 'bg-primary-500/10 text-primary-100'
                  : isLight
                    ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      </aside>
    </>
  );
}

export default Sidebar;

