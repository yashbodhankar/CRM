import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Squares2X2Icon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  BuildingOffice2Icon,
  CurrencyDollarIcon,
  FolderIcon,
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../state/AuthContext';
import { useTheme } from '../state/ThemeContext';
import logo from '../../Logo.png';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: Squares2X2Icon },
  { to: '/employees', label: 'Employees', icon: UserGroupIcon },
  { to: '/leads', label: 'Leads', icon: ArrowTrendingUpIcon },
  { to: '/customers', label: 'Customers', icon: BuildingOffice2Icon },
  { to: '/deals', label: 'Deals', icon: CurrencyDollarIcon },
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
    ? links.filter((item) => ['/dashboard', '/projects', '/tasks', '/chat', '/profile'].includes(item.to))
    : role === 'lead'
      ? links.filter((item) => ['/dashboard', '/employees', '/leads', '/customers', '/deals', '/tasks', '/projects', '/chat', '/reports', '/profile'].includes(item.to))
      : role === 'customer'
        ? links.filter((item) => ['/dashboard', '/projects', '/chat', '/profile'].includes(item.to))
      : links;

  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed md:static z-40 top-0 left-0 h-full md:h-auto w-64 border-r px-4 py-6 transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${isLight ? 'bg-white/80 border-slate-200/80 backdrop-blur' : 'bg-slate-950/75 border-slate-700/50 backdrop-blur'}`}>
      <div className="mb-8">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <img src={logo} alt="CRM Pro logo" className="h-9 w-9 rounded-xl object-cover ring-2 ring-sky-400/40" />
          <span className={isLight ? 'text-slate-800' : 'text-slate-100'}>CRM Pro</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">Team and customer command center</p>
      </div>
      <nav className="space-y-1.5">
        {visibleLinks.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all border ${
                isActive
                  ? isLight
                    ? 'bg-sky-100 text-sky-700 border-sky-200 shadow-sm'
                    : 'bg-sky-500/15 text-sky-200 border-sky-400/30'
                  : isLight
                    ? 'text-slate-700 border-transparent hover:bg-slate-100 hover:text-slate-900'
                    : 'text-slate-300 border-transparent hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={`mt-8 rounded-xl border px-3 py-2 text-xs ${isLight ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-slate-700 bg-slate-900/70 text-slate-300'}`}>
        Logged in as <span className="font-semibold capitalize">{role || 'guest'}</span>
      </div>
      </aside>
    </>
  );
}

export default Sidebar;

