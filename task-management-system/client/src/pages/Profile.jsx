import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { userService } from '../services/index.js';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    password: '',
  });
  const [saving, setSaving] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSave = async (e) => {
    e.preventDefault();
    const payload = { name: form.name, phone: form.phone };
    if (form.password) {
      if (form.password.length < 8) return toast.error('Password must be at least 8 chars');
      payload.password = form.password;
    }
    setSaving(true);
    try {
      const res = await userService.update(user._id, payload);
      setUser(res.user);
      localStorage.setItem('tf_user', JSON.stringify(res.user));
      setForm((f) => ({ ...f, password: '' }));
      toast.success('Profile updated');
    } catch { /* toasted */ }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500">Manage your account details.</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-xl font-semibold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-slate-900">{user?.name}</div>
            <div className="text-sm text-slate-500">{user?.email}</div>
            <span className="badge bg-brand-50 text-brand-700 mt-1">{user?.role}</span>
          </div>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" name="name" value={form.name} onChange={onChange} required />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" name="phone" placeholder="+919876543210" value={form.phone} onChange={onChange} />
            <p className="text-xs text-slate-500 mt-1">Used for WhatsApp notifications and inbound task creation.</p>
          </div>
          <div>
            <label className="label">New password (leave blank to keep current)</label>
            <input className="input" type="password" name="password" value={form.password} onChange={onChange} minLength={8} />
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
