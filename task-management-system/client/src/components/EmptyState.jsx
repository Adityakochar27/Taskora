export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="card p-10 text-center">
      {Icon && (
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 grid place-items-center text-slate-400">
          <Icon size={22} />
        </div>
      )}
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {message && <p className="text-sm text-slate-500 mt-1">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
