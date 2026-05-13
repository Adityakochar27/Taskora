import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { authService } from '../services/authService.js';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [slowLogin, setSlowLogin] = useState(false);
  const slowTimerRef = useRef(null);

  // If login takes >4s, show a "server waking up" message
  // (Render free tier cold start can take 30-60s).
  useEffect(() => {
    return () => { if (slowTimerRef.current) clearTimeout(slowTimerRef.current); };
  }, []);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password) {
      return toast.error('Email and password are required');
    }

    setSubmitting(true);
    setSlowLogin(false);

    // Start the slow-login timer.
    slowTimerRef.current = setTimeout(() => setSlowLogin(true), 4000);

    try {
      const res = await authService.login(form.email.trim(), form.password);
      localStorage.setItem('tf_token', res.token);
      localStorage.setItem('tf_user', JSON.stringify(res.user));
      setUser(res.user);
      toast.success(`Welcome back, ${res.user.name.split(' ')[0]}!`);
      navigate('/dashboard');
    } catch (err) {
      // Error toast is shown by the api interceptor, but customize for cold starts.
      if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
        toast.error('Server is still starting up. Please try again in a moment.');
      }
    } finally {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      setSubmitting(false);
      setSlowLogin(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white text-2xl font-bold shadow-lg shadow-brand-600/20 mb-4">TF</div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to TaskFlow to continue</p>
        </div>

        <form onSubmit={onSubmit} className="card p-6 space-y-4 shadow-xl shadow-slate-200/40">
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" type="email" name="email" value={form.email} onChange={onChange} placeholder="you@company.com" autoComplete="email" required disabled={submitting} />
            </div>
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9 pr-10" type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={onChange} placeholder="Your password" autoComplete="current-password" required disabled={submitting} />
              <button type="button" tabIndex={-1} onClick={() => setShowPassword((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-2.5">
            {submitting ? (<><Loader2 size={16} className="animate-spin" /> Signing in...</>) : (<><LogIn size={16} /> Sign in</>)}
          </button>

          {slowLogin && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 animate-pulse">
              <p className="font-medium">Waking up the server...</p>
              <p className="text-xs text-amber-800 mt-1">First login after a quiet period can take up to a minute. Hang tight!</p>
            </div>
          )}

          <div className="text-center pt-2 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Need an account? <Link to="/signup" className="text-brand-600 font-medium hover:underline">Sign up</Link>
            </p>
          </div>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          TaskFlow by PWS Floors LLP
        </p>
      </div>
    </div>
  );
}
