import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Building2, Users as UsersIcon } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Loader from '../components/Loader.jsx';
import { departmentService, userService } from '../services/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';

export default function Departments() {
  const { hasRole } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await departmentService.list();
      const depts = res.data || [];
      const withCounts = await Promise.all(
        depts.map(async (d) => {
          try {
            const detail = await departmentService.get(d._id);
            return { ...d, memberCount: detail.employees?.length || 0 };
          } catch {
            return { ...d, memberCount: 0 };
          }
        })
      );
      setItems(withCounts);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500">{items.length} department{items.length === 1 ? '' : 's'}</p>
        </div>
        {hasRole('Admin') && (<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={16} /> New department</button>)}
      </div>

      {loading ? (
        <Loader />
      ) : items.length === 0 ? (
        <EmptyState icon={Building2} title="No departments yet" message="Create your first department to start grouping people." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((d) => (
            <Link key={d._id} to={`/departments/${d._id}`} className="card p-5 hover:shadow-md hover:border-brand-200 transition cursor-pointer block">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-700 grid place-items-center"><Building2 size={18} /></div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{d.name}</h3>
                  <div className="text-xs text-slate-500">HOD: <span className="text-slate-700">{d.hod?.name || '-'}</span></div>
                </div>
              </div>
              {d.description && <p className="text-sm text-slate-600 mb-2 line-clamp-2">{d.description}</p>}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                <UsersIcon size={12} />
                <span>{d.memberCount} {d.memberCount === 1 ? 'member' : 'members'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateDeptModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
    </div>
  );
}

function CreateDeptModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', hod: '' });
  const [hods, setHods] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    userService.list({ role: 'HOD', limit: 200 }).then((r) => setHods(r.data || [])).catch(() => setHods([]));
  }, [open]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    setSubmitting(true);
    try {
      await departmentService.create({ name: form.name, description: form.description, hod: form.hod || null });
      toast.success('Department created');
      onCreated?.();
    } catch {} finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New department">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input className="input" name="name" required value={form.name} onChange={onChange} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[60px]" name="description" value={form.description} onChange={onChange} />
        </div>
        <div>
          <label className="label">HOD (optional)</label>
          <select className="input" name="hod" value={form.hod} onChange={onChange}>
            <option value="">-</option>
            {hods.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
          {hods.length === 0 && (<p className="text-xs text-slate-500 mt-1">No HODs available - create users with role "HOD" in the Users panel first.</p>)}
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={submitting}>{submitting ? 'Creating...' : 'Create department'}</button>
        </div>
      </form>
    </Modal>
  );
}
