import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Trash2, Calendar, AlertCircle, Download, X,
  Shuffle, FileText, FileImage, FileArchive, FileCog, File as FileIcon,
} from 'lucide-react';
import { taskService } from '../services/taskService.js';
import Loader from '../components/Loader.jsx';
import AttachmentUploader from '../components/AttachmentUploader.jsx';
import DelegateModal from '../components/DelegateModal.jsx';
import ActivityTimeline from '../components/ActivityTimeline.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';

const STATUSES = ['Pending', 'In Progress', 'Completed'];
const STATUS_INDEX = Object.fromEntries(STATUSES.map((s, i) => [s, i]));
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
  const [delegateOpen, setDelegateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await taskService.get(id);
      setTask(res.task);
    } catch { /* toasted */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <Loader />;
  if (!task) return <div className="text-center py-12 text-slate-500">Task not found.</div>;

  const isAdmin = user?.role === 'Admin';
  const assignerId = String(task.assignedBy?._id || task.assignedBy || '');
  const assigneeId = String(task.assignedToUser?._id || task.assignedToUser || '');
  const originalAssigneeId = String(task.originalAssignedTo?._id || task.originalAssignedTo || '');
  const myId = String(user?._id || '');
  const isAssigner = assignerId === myId;
  const isAssignee = assigneeId === myId;
  const isOriginalAssignee = originalAssigneeId === myId;

  const canMoveForward = isAssignee || isAdmin;
  const canMoveBackward = isAssigner || isAdmin;
  const canDelegate =
    !!task.assignedToUser &&
    (isAssignee || isOriginalAssignee || isAssigner || isAdmin);
  const canDelete = isAdmin || isAssigner;

  const updateStatus = async (status) => {
    if (status === task.status) return;
    setSavingStatus(true);
    try {
      const res = await taskService.update(id, { status });
      setTask(res.task);
      toast.success(`Marked as ${status}`);
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

  const onDeleteAttachment = async (attachmentId) => {
    if (!confirm('Remove this file? This cannot be undone.')) return;
    try {
      await taskService.removeAttachment(id, attachmentId);
      setTask((t) => ({
        ...t,
        attachments: t.attachments.filter((a) => a._id !== attachmentId),
      }));
      toast.success('File removed');
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

  const overdue =
    task.deadline && task.status !== 'Completed' &&
    new Date(task.deadline) < new Date();

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link to="/tasks" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={14} /> Back to tasks
      </Link>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
              <span className="badge bg-slate-100 text-slate-700">{task.status}</span>
              {task.department?.name && (
                <span className="badge bg-brand-50 text-brand-700">{task.department.name}</span>
              )}
              {task.delegationHistory?.length > 0 && (
                <span className="badge bg-amber-50 text-amber-700 inline-flex items-center gap-1">
                  <Shuffle size={11} /> Delegated {task.delegationHistory.length}×
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 break-words">{task.title}</h1>
          </div>
          <div className="flex gap-1 shrink-0">
            {canDelegate && (
              <button
                onClick={() => setDelegateOpen(true)}
                className="text-amber-600 hover:bg-amber-50 p-2 rounded-lg"
                title="Delegate task"
              >
                <Shuffle size={18} />
              </button>
            )}
            {canDelete && (
              <button
                onClick={onDelete}
                className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                title="Delete task"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>

        {task.description && (
          <p className="text-sm text-slate-700 whitespace-pre-wrap mb-4 break-words">{task.description}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm border-t border-slate-100 pt-4">
          <Field label="Assigned by" value={task.assignedBy?.name} />
          <Field
            label="Assigned to"
            value={task.assignedToUser?.name ||
              (task.assignedToTeam?.name && `${task.assignedToTeam.name} (team)`)}
          />
          {task.originalAssignedTo &&
            String(task.originalAssignedTo._id) !== String(task.assignedToUser?._id) && (
            <Field
              label="Originally assigned to"
              value={task.originalAssignedTo.name}
            />
          )}
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

        <div className="mt-5">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => {
              const here = task.status === s;
              const oldIdx = STATUS_INDEX[task.status];
              const newIdx = STATUS_INDEX[s];
              const moveForward = newIdx > oldIdx;
              const moveBackward = newIdx < oldIdx;
              const allowed =
                here || (moveForward && canMoveForward) ||
                (moveBackward && canMoveBackward);
              return (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  disabled={savingStatus || here || !allowed}
                  title={!allowed ? whyDisabled(moveForward, isAssignee, isAssigner, isAdmin) : ''}
                  className={`btn transition ${
                    here
                      ? 'bg-brand-600 text-white'
                      : allowed
                        ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                        : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {!canMoveForward && !isAssignee && (
            <p className="text-xs text-slate-500 mt-2">
              Only the assigned employee can advance this task.
              {isAdmin && ' (You have admin override.)'}
            </p>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-3">Attachments</h2>

        <AttachmentUploader taskId={id} onUploaded={(updated) => setTask(updated)} />

        {task.attachments?.length > 0 && (
          <ul className="space-y-2 mt-4">
            {task.attachments.map((a) => {
              const canRemove =
                isAdmin || isAssigner ||
                String(a.uploadedBy?._id || a.uploadedBy) === myId;
              const fullUrl = a.url?.startsWith('http')
                ? a.url
                : `${import.meta.env.VITE_API_BASE?.replace(/\/api$/, '') || ''}${a.url}`;
              return (
                <li key={a._id || a.url} className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-lg">
                  {iconForName(a.filename)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-900 truncate">{a.filename}</div>
                    <div className="text-xs text-slate-500">{prettySize(a.size)}</div>
                  </div>
                  
                    href={fullUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={a.filename}
                    className="text-brand-600 hover:bg-brand-50 px-2 py-1 rounded inline-flex items-center gap-1 text-sm"
                  >
                    <Download size={14} /> Download
                  </a>
                  {canRemove && (
                    <button
                      onClick={() => onDeleteAttachment(a._id)}
                      className="text-red-500 hover:bg-red-50 p-1 rounded"
                      title="Remove file"
                    >
                      <X size={16} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-3">Activity</h2>
        <ActivityTimeline task={task} />

        <form onSubmit={addComment} className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
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

      <DelegateModal
        open={delegateOpen}
        onClose={() => setDelegateOpen(false)}
        task={task}
        currentAssigneeId={assigneeId}
        onDelegated={(updated) => setTask(updated)}
      />
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

function whyDisabled(forward, isAssignee, isAssigner, isAdmin) {
  if (forward) {
    if (!isAssignee && !isAdmin) return 'Only the assigned employee can advance this task';
  } else {
    if (!isAssigner && !isAdmin) return 'Only the assigner can revert this task';
  }
  return '';
}

function iconForName(filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase();
  const cls = 'shrink-0';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext))
    return <FileImage size={18} className={`${cls} text-purple-500`} />;
  if (ext === 'pdf')
    return <FileText size={18} className={`${cls} text-red-500`} />;
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext))
    return <FileText size={18} className={`${cls} text-blue-500`} />;
  if (['xls', 'xlsx', 'csv'].includes(ext))
    return <FileText size={18} className={`${cls} text-green-600`} />;
  if (['ppt', 'pptx'].includes(ext))
    return <FileText size={18} className={`${cls} text-orange-500`} />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
    return <FileArchive size={18} className={`${cls} text-amber-600`} />;
  if (['dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'stl'].includes(ext))
    return <FileCog size={18} className={`${cls} text-cyan-600`} />;
  return <FileIcon size={18} className={`${cls} text-slate-500`} />;
}

function prettySize(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
