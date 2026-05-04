import { Bell, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function Notifications() {
  const { items, unread, markRead, markAllRead } = useNotifications();

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">
            {unread > 0 ? `${unread} unread` : 'All caught up'}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="btn-secondary">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" message="You'll see task assignments and updates here." />
      ) : (
        <ul className="card divide-y divide-slate-100">
          {items.map((n) => (
            <li
              key={n._id}
              className={`p-4 ${n.read ? '' : 'bg-brand-50/40'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-2.5 h-2.5 rounded-full mt-2 ${n.read ? 'bg-slate-300' : 'bg-brand-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{n.title}</h3>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">{n.message}</p>
                  <div className="flex gap-3 mt-2 text-xs">
                    {n.task?._id && (
                      <Link to={`/tasks/${n.task._id}`} className="text-brand-600 hover:underline">
                        Open task →
                      </Link>
                    )}
                    {!n.read && (
                      <button onClick={() => markRead(n._id)} className="text-slate-500 hover:text-slate-700">
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
