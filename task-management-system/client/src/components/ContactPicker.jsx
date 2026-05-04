import { useEffect, useMemo, useState } from 'react';
import { Search, Users, UserCheck, ChevronDown } from 'lucide-react';
import { userService } from '../services/index.js';

/**
 * ContactPicker — used wherever you'd otherwise drop in a "select user"
 * dropdown. Defaults to showing only the current user's contacts; user can
 * toggle to "Show everyone" to get the full org.
 *
 * Props:
 *   value: selected userId (string)
 *   onChange: (userId, userObj) => void
 *   placeholder: optional placeholder text
 *   roleFilter: optional 'Admin' | 'HOD' | 'Employee' to restrict choices
 *   excludeIds: optional array of userIds to hide
 */
export default function ContactPicker({
  value,
  onChange,
  placeholder = 'Select a person…',
  roleFilter,
  excludeIds = [],
  disabled = false,
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState('contacts'); // 'contacts' | 'all'
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  // Fetch the picker list whenever scope or role-filter changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = { all: scope === 'all' };
    if (roleFilter) params.role = roleFilter;
    userService.picker(params)
      .then((res) => {
        if (cancelled) return;
        setUsers(res.data || []);
      })
      .catch(() => {
        if (cancelled) return;
        setUsers([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [scope, roleFilter]);

  const filtered = useMemo(() => {
    const exc = new Set(excludeIds.map(String));
    return users
      .filter((u) => !exc.has(String(u._id)))
      .filter((u) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          u.name?.toLowerCase().includes(s) ||
          u.email?.toLowerCase().includes(s) ||
          u.role?.toLowerCase().includes(s)
        );
      });
  }, [users, search, excludeIds]);

  const selected = users.find((u) => String(u._id) === String(value));

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`input flex items-center justify-between text-left w-full ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
          {selected ? `${selected.name} (${selected.role})` : placeholder}
        </span>
        <ChevronDown size={16} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or role…"
                className="input pl-8 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span className="inline-flex items-center gap-1">
                {scope === 'contacts'
                  ? <><UserCheck size={12} /> Your contacts</>
                  : <><Users size={12} /> Everyone</>}
              </span>
              <button
                type="button"
                onClick={() => setScope((s) => s === 'contacts' ? 'all' : 'contacts')}
                className="text-brand-600 hover:underline"
              >
                {scope === 'contacts' ? 'Show everyone →' : '← Just contacts'}
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-sm text-slate-500 text-center">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 text-center">
                {scope === 'contacts'
                  ? 'No contacts yet. Try "Show everyone".'
                  : 'No matches.'}
              </div>
            ) : filtered.map((u) => (
              <button
                key={u._id}
                type="button"
                onClick={() => {
                  onChange?.(u._id, u);
                  setOpen(false);
                  setSearch('');
                }}
                className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition flex items-center justify-between ${String(u._id) === String(value) ? 'bg-brand-50' : ''}`}
              >
                <div>
                  <div className="text-sm font-medium text-slate-900">{u.name}</div>
                  <div className="text-xs text-slate-500">
                    {u.role}{u.department?.name ? ` · ${u.department.name}` : ''}
                  </div>
                </div>
                <div className="text-xs text-slate-400 truncate max-w-[140px]">
                  {u.email}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
