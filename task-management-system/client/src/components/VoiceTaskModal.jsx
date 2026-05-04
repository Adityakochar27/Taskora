import { useEffect, useState } from 'react';
import { Mic, MicOff, Loader2, Sparkles } from 'lucide-react';
import Modal from './Modal.jsx';
import useVoiceInput from '../hooks/useVoiceInput.js';
import { parseVoiceInput, resolveAssignee } from '../services/voiceParser.js';
import toast from 'react-hot-toast';

export default function VoiceTaskModal({ open, onClose, users = [], onResult }) {
  const {
    supported, listening, transcript, finalTranscript, error, start, stop, reset,
  } = useVoiceInput({ lang: 'en-IN', continuous: true });

  const [parsed, setParsed] = useState(null);
  const [resolvedUser, setResolvedUser] = useState(null);

  useEffect(() => {
    if (open) {
      reset();
      setParsed(null);
      setResolvedUser(null);
    }
  }, [open, reset]);

  useEffect(() => {
    if (!finalTranscript) {
      setParsed(null);
      setResolvedUser(null);
      return;
    }
    const p = parseVoiceInput(finalTranscript);
    setParsed(p);
    setResolvedUser(p.assigneeHint ? resolveAssignee(p.assigneeHint, users) : null);
  }, [finalTranscript, users]);

  const useThis = () => {
    if (!parsed?.title) {
      toast.error('Could not detect a task title. Try again.');
      return;
    }
    onResult({
      title: parsed.title,
      deadline: parsed.deadline,
      priority: parsed.priority || 'Medium',
      assignedToUser: resolvedUser?._id || null,
      assigneeHint: parsed.assigneeHint,
      resolvedUser,
    });
    onClose();
  };

  if (!supported) {
    return (
      <Modal open={open} onClose={onClose} title="Voice input">
        <div className="text-sm text-slate-600 space-y-2">
          <p>
            Your browser doesn't support voice input. This works on Chrome,
            Edge, Brave, and Safari (14.5+).
          </p>
          <p>On phones: Android Chrome and iOS Safari work fine.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Speak the task">
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Try saying: <em>"Submit Q1 report by Friday to Asha priority high"</em>
        </p>

        <div className="flex flex-col items-center py-4">
          <button
            type="button"
            onClick={listening ? stop : start}
            className={`w-20 h-20 rounded-full grid place-items-center transition shadow-lg ${
              listening
                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                : 'bg-brand-600 hover:bg-brand-700'
            }`}
            aria-label={listening ? 'Stop listening' : 'Start listening'}
          >
            {listening
              ? <MicOff className="text-white" size={32} />
              : <Mic className="text-white" size={32} />}
          </button>
          <p className="text-xs text-slate-500 mt-2">
            {listening ? 'Listening… tap to stop' : 'Tap to speak'}
          </p>
        </div>

        {transcript && (
          <div className="card p-3 bg-slate-50 text-sm min-h-[60px]">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              You said
            </div>
            <div className="text-slate-800">{transcript}</div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            Microphone error: {error}
            {error === 'not-allowed' && (
              <div className="text-xs mt-1">
                Allow microphone access in your browser settings, then try again.
              </div>
            )}
          </div>
        )}

        {parsed && parsed.title && (
          <div className="card p-4 border-2 border-brand-200">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-brand-700">
              <Sparkles size={14} /> Detected
            </div>
            <dl className="space-y-2 text-sm">
              <Field label="Title" value={parsed.title} />
              <Field
                label="Priority"
                value={
                  <span className={`badge ${PRIORITY_STYLES[parsed.priority]}`}>
                    {parsed.priority}
                  </span>
                }
              />
              <Field
                label="Deadline"
                value={
                  parsed.deadline
                    ? new Date(parsed.deadline).toLocaleString()
                    : <span className="text-slate-400">none — set manually</span>
                }
              />
              <Field
                label="Assignee"
                value={
                  resolvedUser ? (
                    <span>
                      {resolvedUser.name}
                      <span className="text-xs text-slate-500 ml-1">({resolvedUser.role})</span>
                    </span>
                  ) : parsed.assigneeHint ? (
                    <span className="text-amber-600">
                      "{parsed.assigneeHint}" — no match. Pick manually.
                    </span>
                  ) : (
                    <span className="text-slate-400">none — pick manually</span>
                  )
                }
              />
            </dl>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={listening || !parsed?.title}
            onClick={useThis}
          >
            {listening ? <Loader2 className="animate-spin" size={14} /> : null}
            Use this
          </button>
        </div>
      </div>
    </Modal>
  );
}

const PRIORITY_STYLES = {
  Low: 'bg-slate-100 text-slate-700',
  Medium: 'bg-amber-100 text-amber-700',
  High: 'bg-red-100 text-red-700',
};

function Field({ label, value }) {
  return (
    <div className="flex gap-3">
      <dt className="text-xs uppercase tracking-wide text-slate-500 w-20 mt-0.5">
        {label}
      </dt>
      <dd className="text-slate-800 flex-1">{value}</dd>
    </div>
  );
}
