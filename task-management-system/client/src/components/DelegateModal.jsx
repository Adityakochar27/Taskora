import { useState } from 'react';
import { Shuffle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal.jsx';
import ContactPicker from './ContactPicker.jsx';
import { taskService } from '../services/taskService.js';

/**
 * DelegateModal — opened from the task detail page.
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   task: the task object (uses _id, title, current assignee)
 *   currentAssigneeId: string  (to exclude from picker)
 *   onDelegated: (updatedTask) => void
 */
export default function DelegateModal({ open, onClose, task, currentAssigneeId, onDelegated }) {
  const [toUserId, setToUserId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setToUserId('');
    setReason('');
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose?.();
  };

  const submit = async () => {
    if (!toUserId) return toast.error('Please select a person to delegate to');
    if (!reason.trim()) return toast.error('Please add a reason for the delegation');
    if (reason.trim().length < 5) return toast.error('Reason should be a bit more descriptive');

    setSubmitting(true);
    try {
      const res = await taskService.delegate(task._id, toUserId, reason.trim());
      toast.success('Task delegated. Everyone has been notified.');
      onDelegated?.(res.task);
      reset();
      onClose?.();
    } catch {
      // Error toast handled by api interceptor.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Delegate task">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
          <div className="font-medium flex items-center gap-1.5">
            <Shuffle size={14} /> About to reassign:
          </div>
          <div className="text-slate-800 mt-1 truncate">"{task?.title}"</div>
          <div className="text-xs text-amber-800 mt-2">
            The original assigner, admins, and the previous assignee will all be notified.
          </div>
        </div>

        <div>
          <label className="label">Delegate to</label>
          <ContactPicker
            value={toUserId}
            onChange={setToUserId}
            placeholder="Select a person…"
            excludeIds={currentAssigneeId ? [currentAssigneeId] : []}
            disabled={submitting}
          />
        </div>

        <div>
          <label className="label">Reason <span className="text-red-500">*</span></label>
          <textarea
            className="input min-h-[90px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you reassigning this task? (e.g. on leave, better expertise, workload balance…)"
            disabled={submitting}
          />
          <div className="text-xs text-slate-500 mt-1">
            This will be saved on the task and shown to everyone notified.
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? (
              <><Loader2 size={14} className="animate-spin" /> Delegating…</>
            ) : (
              <><Shuffle size={14} /> Delegate task</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
