import { useEffect, useState } from 'react';
import { Plus, Users as UsersIcon } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Loader from '../components/Loader.jsx';
import {
  teamService, userService, departmentService,
} from '../services/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';

export default function Teams() {
  const { hasRole } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await teamService.list();
      setTeams(res.data || []);
    } catch { /* toasted */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teams</h1>
          <p className="text-sm text-slate-500">{teams.length} team{teams.length === 1 ? '' : 's'}</p>
        </div>
        {hasRole('Admin', 'HOD') && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={16} /> New team
          </button>
        )}
      </div>

      {loading ? (
        <Loader />
      ) : teams.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No teams yet" message="Create a team to start assigning tasks to groups." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t) => (
            <div key={t._id} className="card p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-slate-900">{t.name}</h3>
                <span className="badge bg-brand-50 text-brand-700">{t.department?.name || 'No dept.'}</span>
              </div>
              {t.description && (
                <p className="text-sm text-slate-500 mb-3">{t.description}</p>
              )}
              <div className="text-xs text-slate-500 mb-2">
                Lead: <span className="text-slate-700">{t.lead?.name || '—'}</span>
              </div>
              <div className="text-xs text-slate-500">
                Members: <span className="text-slate-700">{t.members?.length || 0}</span>
              </div>
              {t.members?.length > 0 && (
                <div className="mt-3 flex -space-x-2">
                  {t.members.slice(0, 6).map((m) => (
                    <div
                      key={m._id}
                      title={m.name}
                      className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-xs grid place-items-center font-semibold border-2 border-white"
                    >
                      {m.name?.[0]?.toUpperCase()}
                    </div>
                  ))}
                  {t.members.length > 6 && (
                    <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs grid place-items-center border-2 border-white">
                      +{t.members.length - 6}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateTeamModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); load(); }}
      />
    </div>
  );
}

function CreateTeamModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', department: '', lead: '', members: [] });
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      userService.list({ limit: 200 }).catch(() => ({ data: [] })),
      departmentService.list().catch(() => ({ data: [] })),
    ]).then(([u, d]) => {
      setUsers(u.data || []);
      setDepartments(d.data || []);
    });
  }, [open]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const toggleMember = (id) =>
    setForm((f) => ({
      ...f,
      members: f.members.includes(id) ? f.members.filter((x) => x !== id) : [...f.members, id],
    }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.department) return toast.error('Name and department are required');
    setSubmitting(true);
    try {
      await teamService.create({
        name: form.name,
        description: form.description,
        department: form.department,
        lead: form.lead || null,
        members: form.members,
      });
      toast.success('Team created');
      onCreated?.();
    } catch { /* toasted */ }
    finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New team">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input className="input" name="name" required value={form.name} onChange={onChange} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[60px]" name="description" value={form.description} onChange={onChange} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Department</label>
            <select className="input" name="department" required value={form.department} onChange={onChange}>
              <option value="">— select —</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Lead (optional)</label>
            <select className="input" name="lead" value={form.lead} onChange={onChange}>
              <option value="">—</option>
              {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Members</label>
          <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
            {users.map((u) => (
              <label key={u._id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={form.members.includes(u._id)}
                  onChange={() => toggleMember(u._id)}
                />
                <span className="font-medium">{u.name}</span>
                <span className="text-xs text-slate-500 ml-auto">{u.role}</span>
              </label>
            ))}
            {users.length === 0 && (
              <div className="px-3 py-4 text-sm text-slate-500">No users available.</div>
            )}
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create team'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
