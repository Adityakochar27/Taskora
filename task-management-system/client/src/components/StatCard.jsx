export default function StatCard({ label, value, accent = 'brand', icon: Icon, hint }) {
  const accents = {
    brand: 'bg-brand-50 text-brand-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </span>
        {Icon && (
          <span className={`w-9 h-9 rounded-lg grid place-items-center ${accents[accent]}`}>
            <Icon size={18} />
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value ?? '—'}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
