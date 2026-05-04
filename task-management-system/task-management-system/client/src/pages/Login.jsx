import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';

export default function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
    } catch {
      /* toast is handled in axios interceptor */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex bg-gradient-to-br from-brand-700 to-brand-500 text-white p-12 flex-col justify-between">
        <div className="font-bold text-xl flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg bg-white/20 grid place-items-center">TF</span>
          TaskFlow
        </div>
        <div>
          <h2 className="text-3xl font-bold mb-3 leading-tight">
            Run your organization on tasks, not chaos.
          </h2>
          <p className="text-brand-100 text-base max-w-md">
            Assign, track, and close work across departments and teams — with
            WhatsApp, push, and a mobile-first PWA out of the box.
          </p>
        </div>
        <p className="text-xs text-brand-200">© {new Date().getFullYear()} TaskFlow</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
          <p className="text-sm text-slate-500 mb-8">
            Use your work email and password.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={onChange}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={onChange}
              />
            </div>
            <button className="btn-primary w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-sm text-slate-500 mt-6 text-center">
            New here?{' '}
            <Link className="text-brand-600 hover:underline font-medium" to="/signup">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
