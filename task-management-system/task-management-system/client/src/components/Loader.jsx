export default function Loader({ fullScreen, label }) {
  const cls = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-slate-50 z-50'
    : 'flex items-center justify-center py-12';
  return (
    <div className={cls}>
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <div className="w-9 h-9 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        {label && <span className="text-sm">{label}</span>}
      </div>
    </div>
  );
}
