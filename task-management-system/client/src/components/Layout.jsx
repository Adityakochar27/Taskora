import { useState } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, ListTodo, Users, Building2, Shield, Bell,
  LogOut, Menu, X, User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';

const NAV = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tasks',       icon: ListTodo,        label: 'Tasks' },
  { to: '/teams',       icon: Users,           label: 'Teams' },
  { to: '/departments', icon: Building2,       label: 'Departments' },
  { to: '/admin',       icon: Shield,          label: 'Admin', adminOnly: true },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { unread } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = NAV.filter((n) => !n.adminOnly || user?.role === 'Admin');

  return (
    <div className="h-full flex bg-slate-50">
      {/* Sidebar — desktop persistent, mobile drawer */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200
          transform transition-transform lg:translate-x-0 flex flex-col
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg text-slate-900">
            <span className="w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center text-sm">TF</span>
            TaskFlow
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1 text-slate-500">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100"
          >
            <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-semibold">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.role}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden p-2 -ml-2 text-slate-600 rounded hover:bg-slate-100"
          >
            <Menu size={22} />
          </button>
          <div className="text-sm text-slate-500 hidden sm:block">
            Welcome back, <span className="font-medium text-slate-800">{user?.name?.split(' ')[0]}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Link
              to="/notifications"
              className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 grid place-items-center text-[10px] font-bold bg-red-500 text-white rounded-full">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
            <Link to="/profile" className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg" aria-label="Profile">
              <UserIcon size={20} />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
