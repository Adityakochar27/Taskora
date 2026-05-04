import { useRef, useState } from 'react';
import {
  Upload, Paperclip, X, FileText, FileImage, FileArchive,
  FileCog, File as FileIcon, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { taskService } from '../services/taskService.js';

/**
 * AttachmentUploader — drag-and-drop + multi-file picker.
 *
 * Props:
 *   taskId: string
 *   onUploaded: (updatedTask) => void
 */
export default function AttachmentUploader({ taskId, onUploaded, disabled }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [queue, setQueue] = useState([]); // staged files before sending

  const onPick = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) addToQueue(files);
    e.target.value = ''; // reset so the same file can be re-picked
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) addToQueue(files);
  };

  const addToQueue = (files) => {
    const next = [];
    for (const f of files) {
      if (f.size > 50 * 1024 * 1024) {
        toast.error(`${f.name} exceeds 50 MB limit`);
        continue;
      }
      next.push(f);
    }
    setQueue((q) => [...q, ...next]);
  };

  const removeFromQueue = (idx) =>
    setQueue((q) => q.filter((_, i) => i !== idx));

  const send = async () => {
    if (!queue.length) return;
    setUploading(true);
    setProgress(0);
    try {
      const res = await taskService.uploadAttachments(taskId, queue, (p) => {
        setProgress(p);
      });
      toast.success(`${queue.length} file${queue.length > 1 ? 's' : ''} uploaded`);
      setQueue([]);
      onUploaded?.(res.task);
    } catch (err) {
      // Error toast is shown by the api interceptor.
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); !disabled && setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 text-center transition cursor-pointer
          ${disabled ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60' : ''}
          ${dragOver
            ? 'border-brand-400 bg-brand-50'
            : 'border-slate-300 hover:border-brand-300 hover:bg-slate-50'}`}
      >
        <Upload className="mx-auto text-slate-400 mb-2" size={24} />
        <div className="text-sm text-slate-700">
          <span className="font-medium text-brand-600">Click to upload</span> or drag and drop
        </div>
        <div className="text-xs text-slate-500 mt-1">
          PDF, DOCX, XLSX, DWG, DXF, STEP, images — up to 50 MB each
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          disabled={disabled || uploading}
          onChange={onPick}
        />
      </div>

      {queue.length > 0 && (
        <div className="space-y-2">
          {queue.map((f, idx) => (
            <div key={`${f.name}-${idx}`} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
              {iconFor(f.name)}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{f.name}</div>
                <div className="text-xs text-slate-500">{prettySize(f.size)}</div>
              </div>
              {!uploading && (
                <button
                  onClick={() => removeFromQueue(idx)}
                  className="text-slate-400 hover:text-red-500"
                  aria-label="Remove"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}

          {uploading && (
            <div className="space-y-1.5">
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-slate-500 text-center">
                Uploading… {progress}%
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            {!uploading && (
              <button onClick={() => setQueue([])} className="btn-secondary">
                Clear
              </button>
            )}
            <button
              onClick={send}
              disabled={uploading || disabled}
              className="btn-primary"
            >
              {uploading ? (
                <><Loader2 size={14} className="animate-spin" /> Uploading…</>
              ) : (
                <><Paperclip size={14} /> Upload {queue.length} file{queue.length > 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function iconFor(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const props = { size: 18, className: 'shrink-0' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext))
    return <FileImage {...props} className="text-purple-500 shrink-0" />;
  if (['pdf'].includes(ext))
    return <FileText {...props} className="text-red-500 shrink-0" />;
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext))
    return <FileText {...props} className="text-blue-500 shrink-0" />;
  if (['xls', 'xlsx', 'csv'].includes(ext))
    return <FileText {...props} className="text-green-600 shrink-0" />;
  if (['ppt', 'pptx'].includes(ext))
    return <FileText {...props} className="text-orange-500 shrink-0" />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
    return <FileArchive {...props} className="text-amber-600 shrink-0" />;
  if (['dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'stl'].includes(ext))
    return <FileCog {...props} className="text-cyan-600 shrink-0" />;
  return <FileIcon {...props} className="text-slate-500 shrink-0" />;
}

function prettySize(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
