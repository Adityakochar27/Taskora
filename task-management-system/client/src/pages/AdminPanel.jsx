import { useEffect, useState } from 'react';
import { Plus, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import Loader from '../components/Loader.jsx';
import { userService, departmentService } from '../services/index.js';
import toast from 'react-hot-toast';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, d] = await Promise.all([
        userService.list({ q, role: roleFilter, limit: 200 }),
        departmentService.list(),
      ]);
      setUsers(u.data || []);
      setDepartments(d.data || []);
    } catch { /* toasted */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, roleFilter]);

  const toggleActive = async (u) => {
    try {
      await userService.update(u._id, { isActive: !u.isActive });
      toast.success(`${u.name} ${u.isActive ? 'disabled' : 'enabled'}`);
      load();
    } catch { /* toasted */ }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin · Users</h1>
          <p className="text-sm text-slate-500">Manage organisation accounts and roles.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} /> New user
        </button>
      </div>

      <div className="card p-3 sm:p-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search by name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          <option>Admin</option><option>HOD</option><option>Employee</option>
        </select>
      </div>

      {loading ? (
        <Loader />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4">User</th>
                  <th className="text-left py-3 px-4">Role</th>
                  <th className="text-left py-3 px-4">Department</th>
                  <th className="text-left py-3 px-4">Phone</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u._id}>
                    <td className="py-3 px-4">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">{u.role}</td>
                    <td className="py-3 px-4">{u.department?.name || '—'}</td>
                    <td className="py-3 px-4 text-slate-500">{u.phone || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => toggleActive(u)}
                        className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                      >
                        {u.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        {u.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-500">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateUserModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); load(); }}
        departments={departments}
      />
    </div>
  );
}

function CreateUserModal({ open, onClose, onCreated, departments }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', role: 'Employee', department: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error('Password must be at least 8 chars');
    setSubmitting(true);
    try {
      await userService.create({
        ...form,
        department: form.department || undefined,
        phone: form.phone || undefined,
      });
      toast.success('User created');
      onCreated?.();
    } catch { /* toasted */ }
    finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New user">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input className="input" name="name" required value={form.name} onChange={onChange} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" name="email" required value={form.email} onChange={onChange} />
        </div>
        <div>
          <label className="label">Phone (E.164)</label>
          <input className="input" name="phone" placeholder="+919876543210" value={form.phone} onChange={onChange} />
        </div>
        <div>
          <label className="label">Password (min 8)</label>
          <input className="input" type="password" minLength={8} required name="password" value={form.password} onChange={onChange} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Role</label>
            <select className="input" name="role" value={form.role} onChange={onChange}>
              <option>Employee</option><option>HOD</option><option>Admin</option>
            </select>
          </div>
          <div>
            <label className="label">Department</label>
            <select className="input" name="department" value={form.department} onChange={onChange}>
              <option value="">—</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
