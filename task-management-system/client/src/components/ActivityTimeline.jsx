import { MessageSquare, Shuffle } from 'lucide-react';

/**
 * ActivityTimeline — merges task.comments[] + task.delegationHistory[] into
 * one chronological list. Looks like Slack-on-a-task: each entry is dated,
 * shows who and what.
 *
 * Props:
 *   task: full task object with populated comments + delegationHistory
 */
export default function ActivityTimeline({ task }) {
  const comments = (task?.comments || []).map((c) => ({
    type: 'comment',
    at: new Date(c.createdAt),
    user: c.user,
    text: c.text,
  }));

  const delegations = (task?.delegationHistory || []).map((d) => ({
    type: 'delegation',
    at: new Date(d.createdAt),
    fromUser: d.fromUser,
    toUser: d.toUser,
    reason: d.reason,
  }));

  const items = [...comments, ...delegations].sort((a, b) => a.at - b.at);

  if (!items.length) {
    return (
      <div className="text-sm text-slate-500 italic text-center py-6">
        No activity yet. Be the first to comment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) =>
        item.type === 'comment'
          ? <CommentRow key={idx} item={item} />
          : <DelegationRow key={idx} item={item} />
      )}
    </div>
  );
}

function CommentRow({ item }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0 text-sm font-medium">
        {(item.user?.name || '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900">
            {item.user?.name || 'Someone'}
          </span>
          {item.user?.role && (
            <span className="text-xs text-slate-400">({item.user.role})</span>
          )}
          <span className="text-xs text-slate-400">·</span>
          <time className="text-xs text-slate-500">{formatTime(item.at)}</time>
        </div>
        <div className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap break-words">
          {item.text}
        </div>
      </div>
    </div>
  );
}

function DelegationRow({ item }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
        <Shuffle size={14} />
      </div>
      <div className="flex-1 min-w-0 bg-amber-50/60 border border-amber-100 rounded-lg p-2.5">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900">
            Reassigned
          </span>
          <span className="text-xs text-slate-500">
            {item.fromUser?.name || 'Someone'} → {item.toUser?.name || 'someone'}
          </span>
          <span className="text-xs text-slate-400">·</span>
          <time className="text-xs text-slate-500">{formatTime(item.at)}</time>
        </div>
        <div className="text-sm text-slate-700 mt-1">
          <span className="text-xs text-slate-500">Reason:</span> {item.reason}
        </div>
      </div>
    </div>
  );
}

function formatTime(d) {
  if (!(d instanceof Date) || isNaN(d)) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.round((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'short' }) + ', ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) +
    ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
