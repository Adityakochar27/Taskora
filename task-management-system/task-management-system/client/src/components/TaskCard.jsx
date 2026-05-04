import { Link } from 'react-router-dom';
import { Calendar, User, Users as UsersIcon, AlertCircle } from 'lucide-react';

const STATUS_STYLES = {
  Pending: 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-100 text-emerald-700',
};
const PRIORITY_STYLES = {
  Low: 'bg-slate-100 text-slate-600',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-red-100 text-red-700',
};

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : '—';

const isOverdue = (t) =>
  t.deadline && t.status !== 'Completed' && new Date(t.deadline) < new Date();

export default function TaskCard({ task }) {
  const overdue = isOverdue(task);
  return (
    <Link
      to={`/tasks/${task._id}`}
      className="card p-4 block hover:shadow-md hover:border-brand-300 transition group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-brand-700">
          {task.title}
        </h3>
        <span className={`badge ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
      </div>

      {task.description && (
        <p className="text-xs text-slate-600 line-clamp-2 mb-3">{task.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className={`badge ${STATUS_STYLES[task.status]}`}>{task.status}</span>

        {task.assignedToUser && (
          <span className="inline-flex items-center gap-1">
            <User size={12} />
            {task.assignedToUser.name}
          </span>
        )}
        {task.assignedToTeam && (
          <span className="inline-flex items-center gap-1">
            <UsersIcon size={12} />
            {task.assignedToTeam.name}
          </span>
        )}

        {task.deadline && (
          <span
            className={`inline-flex items-center gap-1 ${
              overdue ? 'text-red-600 font-medium' : ''
            }`}
          >
            {overdue ? <AlertCircle size={12} /> : <Calendar size={12} />}
            {fmt(task.deadline)}
          </span>
        )}
      </div>
    </Link>
  );
}
