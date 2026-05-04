import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Paperclip, Trash2, Calendar, AlertCircle, Download,
} from 'lucide-react';
import { taskService } from '../services/taskService.js';
import Loader from '../components/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';

const STATUSES = ['Pending', 'In Progress', 'Completed'];
const PRIORITY_STYLES = {
  Low: 'bg-slate-100 text-slate-700',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-red-100 text-red-700',
};

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const fileInput = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await taskService.get(id);
      setTask(res.task);
    } catch { /* toasted */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const updateStatus = async (status) => {
    setSavingStatus(true);
    try {
      const res = await taskService.update(id, { status });
      setTask(res.task);
      toast.success('Status updated');
    } catch { /* toasted */ }
    finally { setSavingStatus(false); }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      const res = await taskService.comment(id, comment.trim());
      setTask(res.task);
      setComment('');
    } catch { /* toasted */ }
  };

  const uploadFile = async (file) => {
    if (!file) return;
    try {
      const res = await taskService.uploadAttachment(id, file);
      setTask(res.task);
      toast.success('File uploaded');
    } catch { /* toasted */ }
  };

  const onDelete = async () => {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    try {
      await taskService.remove(id);
      toast.success('Task deleted');
      navigate('/tasks');
    } catch { /* toasted */ }
  };

  if (loading) return <Loader />;
  if (!task) return <div className="text-center py-12 text-slate-500">Task not found.</div>;

  const overdue =
    task.deadline && task.status !== 'Completed' && new Date(task.deadline) < new Date();
  const canDelete =
    user?.role === 'Admin' || String(task.assignedBy?._id || task.assignedBy) === String(user?._id);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link to="/tasks" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={14} /> Back to tasks
      </Link>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
              <span className="badge bg-slate-100 text-slate-700">{task.status}</span>
              {task.department?.name && (
                <span className="badge bg-brand-50 text-brand-700">{task.department.name}</span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">{task.title}</h1>
          </div>
          {canDelete && (
            <button onClick={onDelete} className="text-red-500 hover:text-red-700 p-2">
              <Trash2 size={18} />
            </button>
          )}
        </div>

        {task.description && (
          <p className="text-sm text-slate-700 whitespace-pre-wrap mb-4">{task.description}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm border-t border-slate-100 pt-4">
          <Field label="Assigned by" value={task.assignedBy?.name} />
          <Field
            label="Assigned to"
            value={task.assignedToUser?.name || task.assignedToTeam?.name + ' (team)'}
          />
          <Field
            label="Deadline"
            value={
              task.deadline ? (
                <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}>
                  {overdue ? <AlertCircle size={12} /> : <Calendar size={12} />}
                  {new Date(task.deadline).toLocaleString()}
                </span>
              ) : '—'
            }
          />
          <Field label="Created" value={new Date(task.createdAt).toLocaleString()} />
        </div>

        {/* Status changer */}
        <div className="mt-5 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              disabled={savingStatus || task.status === s}
              className={`btn ${
                task.status === s
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Attachments */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">Attachments</h2>
          <button onClick={() => fileInput.current?.click()} className="btn-secondary">
            <Paperclip size={14} /> Upload
          </button>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => uploadFile(e.target.files?.[0])}
          />
        </div>
        {task.attachments?.length > 0 ? (
          <ul className="space-y-2">
            {task.attachments.map((a) => (
              <li key={a._id || a.url} className="flex items-center justify-between text-sm bg-slate-50 px-3 py-2 rounded-lg">
                <span className="truncate">{a.filename}</span>
                <a href={a.url} target="_blank" rel="noreferrer" className="text-brand-600 inline-flex items-center gap-1">
                  <Download size={14} /> Open
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No attachments yet.</p>
        )}
      </div>

      {/* Comments */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-3">Comments</h2>
        {task.comments?.length > 0 ? (
          <ul className="space-y-3 mb-4">
            {task.comments.map((c) => (
              <li key={c._id} className="border-l-2 border-brand-200 pl-3">
                <div className="text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    {c.user?.name || 'Someone'}
                  </span>{' '}
                  · {new Date(c.createdAt).toLocaleString()}
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap mt-0.5">{c.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 mb-4">No comments yet.</p>
        )}

        <form onSubmit={addComment} className="flex gap-2">
          <input
            className="input"
            placeholder="Write a comment…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button className="btn-primary" disabled={!comment.trim()}>
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-slate-800 mt-0.5">{value || '—'}</div>
    </div>
  );
}
