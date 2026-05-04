import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';

export default function Signup() {
  const { user, signup } = useAuth();
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', role: 'Employee', adminKey: '',
  });
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        role: form.role,
      };
      if (form.role === 'Admin' && form.adminKey) payload.adminKey = form.adminKey;
      await signup(payload);
      toast.success('Account created');
    } catch {
      /* toasted */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Create account</h1>
        <p className="text-sm text-slate-500 mb-6">
          Sign up to start managing tasks.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" name="name" required value={form.name} onChange={onChange} />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={onChange}
            />
          </div>
          <div>
            <label className="label">Phone (E.164, e.g. +91…)</label>
            <input
              className="input"
              name="phone"
              placeholder="+919876543210"
              value={form.phone}
              onChange={onChange}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              name="password"
              type="password"
              minLength={8}
              required
              value={form.password}
              onChange={onChange}
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" name="role" value={form.role} onChange={onChange}>
              <option>Employee</option>
              <option>Admin</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              HOD accounts must be created by an Admin.
            </p>
          </div>
          {form.role === 'Admin' && (
            <div>
              <label className="label">Admin signup key</label>
              <input
                className="input"
                name="adminKey"
                value={form.adminKey}
                onChange={onChange}
                placeholder="Set in server .env (ADMIN_SIGNUP_KEY)"
              />
            </div>
          )}
          <button className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="text-sm text-slate-500 mt-6 text-center">
          Already have an account?{' '}
          <Link className="text-brand-600 font-medium hover:underline" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
