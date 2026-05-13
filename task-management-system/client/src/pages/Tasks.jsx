import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, ListTodo, LayoutGrid, List as ListIcon, Mic } from 'lucide-react';
import TaskCard from '../components/TaskCard.jsx';
import Modal from '../components/Modal.jsx';
import VoiceTaskModal from '../components/VoiceTaskModal.jsx';
import ContactPicker from '../components/ContactPicker.jsx';
import Loader from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { taskService } from '../services/taskService.js';
import { userService, teamService, departmentService } from '../services/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';

const STATUSES = ['Pending', 'In Progress', 'Completed'];

export default function Tasks() {
  const { user, hasRole } = useAuth();
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('board');
  const [filters, setFilters] = useState(() => ({
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    q: searchParams.get('q') || '',
    overdue: searchParams.get('overdue') === 'true' ? 'true' : '',
  }));
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.q) params.q = filters.q;
      if (filters.overdue) params.overdue = 'true';
      const res = await taskService.list(params);
      setTasks(res.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters]);

  const grouped = useMemo(() => {
    const g = { Pending: [], 'In Progress': [], Completed: [] };
    for (const t of tasks) (g[t.status] ||= []).push(t);
    return g;
  }, [tasks]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500">{tasks.length} task{tasks.length === 1 ? '' : 's'} visible</p>
        </div>
        {hasRole('Admin', 'HOD') && (<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={16} /> New task</button>)}
      </div>

      <div className="card p-3 sm:p-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search tasks..." value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
        </div>
        <select className="input w-auto" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All status</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="input w-auto" value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}>
          <option value="">All priority</option>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
        <label className="inline-flex items-center gap-1.5 text-sm text-slate-600 px-2">
          <input type="checkbox" checked={filters.overdue === 'true'} onChange={(e) => setFilters((f) => ({ ...f, overdue: e.target.checked ? 'true' : '' }))} />
          Overdue
        </label>
        <div className="ml-auto flex border border-slate-200 rounded-lg overflow-hidden">
          <button onClick={() => setView('board')} className={`px-3 py-2 text-sm flex items-center gap-1 ${view === 'board' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}><LayoutGrid size={14} /> Board</button>
          <button onClick={() => setView('list')} className={`px-3 py-2 text-sm flex items-center gap-1 ${view === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}><ListIcon size={14} /> List</button>
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : tasks.length === 0 ? (
        <EmptyState icon={ListTodo} title="No tasks yet" message="Create a new task or adjust your filters." />
      ) : view === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STATUSES.map((s) => (
            <div key={s} className="bg-slate-100 rounded-xl p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-semibold text-slate-700">{s}</h3>
                <span className="text-xs text-slate-500">{grouped[s].length}</span>
              </div>
              <div className="space-y-3">
                {grouped[s].map((t) => <TaskCard key={t._id} task={t} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tasks.map((t) => <TaskCard key={t._id} task={t} />)}
        </div>
      )}

      <CreateTaskModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} currentUser={user} />
    </div>
  );
}

function CreateTaskModal({ open, onClose, onCreated, currentUser }) {
  const [form, setForm] = useState({ title: '', description: '', assignTo: 'user', assignedToUser: '', assignedToTeam: '', department: '', priority: 'Medium', deadline: '' });
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showVoice, setShowVoice] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      teamService.list().catch(() => ({ data: [] })),
      departmentService.list().catch(() => ({ data: [] })),
      userService.list({ limit: 200 }).catch(() => ({ data: [] })),
    ]).then(([t, d, u]) => {
      setTeams(t.data || []);
      setDepartments(d.data || []);
      setAllUsers(u.data || []);
    });
  }, [open]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const applyVoiceResult = (v) => {
    setForm((f) => ({
      ...f,
      title: v.title || f.title,
      priority: v.priority || f.priority,
      deadline: v.deadline ? toLocalDatetimeInput(new Date(v.deadline)) : f.deadline,
      assignTo: v.assignedToUser ? 'user' : f.assignTo,
      assignedToUser: v.assignedToUser || f.assignedToUser,
    }));
    if (v.assigneeHint && !v.assignedToUser) {
      toast(`Heard "${v.assigneeHint}" but no matching user - pick from the list.`);
    } else {
      toast.success('Voice input applied');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    const payload = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      deadline: form.deadline || null,
      department: form.department || undefined,
    };
    if (form.assignTo === 'user') {
      if (!form.assignedToUser) return toast.error('Pick an assignee');
      payload.assignedToUser = form.assignedToUser;
    } else {
      if (!form.assignedToTeam) return toast.error('Pick a team');
      payload.assignedToTeam = form.assignedToTeam;
    }
    setSubmitting(true);
    try {
      await taskService.create(payload);
      toast.success('Task created');
      onCreated?.();
    } catch {} finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New task">
      <form onSubmit={onSubmit} className="space-y-4">
        <button type="button" onClick={() => setShowVoice(true)} className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border-2 border-dashed border-brand-200 bg-brand-50/50 text-brand-700 text-sm font-medium hover:bg-brand-50 hover:border-brand-300 transition">
          <Mic size={16} />
          Speak to fill - try "Submit report by Friday to Asha priority high"
        </button>

        <div>
          <label className="label">Title</label>
          <input className="input" name="title" required value={form.title} onChange={onChange} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[80px]" name="description" value={form.description} onChange={onChange} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Assign to</label>
            <select className="input" name="assignTo" value={form.assignTo} onChange={onChange}>
              <option value="user">Person</option>
              <option value="team">Team</option>
            </select>
          </div>
          {form.assignTo === 'user' ? (
            <div>
              <label className="label">User</label>
              <ContactPicker value={form.assignedToUser} onChange={(uid) => setForm((f) => ({ ...f, assignedToUser: uid }))} placeholder="Select a person..." />
            </div>
          ) : (
            <div>
              <label className="label">Team</label>
              <select className="input" name="assignedToTeam" value={form.assignedToTeam} onChange={onChange}>
                <option value="">- select -</option>
                {teams.map((t) => (<option key={t._id} value={t._id}>{t.name}</option>))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Priority</label>
            <select className="input" name="priority" value={form.priority} onChange={onChange}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
          <div>
            <label className="label">Deadline</label>
            <input className="input" type="datetime-local" name="deadline" value={form.deadline} onChange={onChange} />
          </div>
        </div>

        {currentUser?.role === 'Admin' && (
          <div>
            <label className="label">Department (optional override)</label>
            <select className="input" name="department" value={form.department} onChange={onChange}>
              <option value="">- inherit from assignee -</option>
              {departments.map((d) => (<option key={d._id} value={d._id}>{d.name}</option>))}
            </select>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={submitting}>{submitting ? 'Creating...' : 'Create task'}</button>
        </div>
      </form>

      <VoiceTaskModal open={showVoice} onClose={() => setShowVoice(false)} users={allUsers} onResult={applyVoiceResult} />
    </Modal>
  );
}

function toLocalDatetimeInput(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
