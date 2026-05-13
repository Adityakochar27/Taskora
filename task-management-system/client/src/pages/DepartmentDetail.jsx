import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Mail, Shield, UserCog, User as UserIcon, Users as UsersIcon } from 'lucide-react';
import { departmentService } from '../services/index.js';
import Loader from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function DepartmentDetail() {
  const { id } = useParams();
  const [dept, setDept] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    departmentService.get(id)
      .then((res) => {
        if (cancelled) return;
        setDept(res.department);
        setEmployees(res.employees || []);
      })
      .catch(() => { if (!cancelled) { setDept(null); setEmployees([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <Loader />;
  if (!dept) return <div className="text-center py-12 text-slate-500">Department not found.</div>;

  const byRole = { Admin: [], HOD: [], Employee: [] };
  for (const e of employees) (byRole[e.role] ||= []).push(e);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link to="/departments" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft size={14} /> Back to departments</Link>

      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-brand-50 text-brand-700 grid place-items-center shrink-0"><Building2 size={24} /></div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">{dept.name}</h1>
            {dept.description && <p className="text-sm text-slate-600 mt-1">{dept.description}</p>}
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500">Head of Department</span>
              {dept.hod ? (<span className="text-slate-900 font-medium">{dept.hod.name}</span>) : (<span className="text-slate-400">Not assigned</span>)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-100">
          <Stat label="Members" value={employees.length} />
          <Stat label="HODs" value={byRole.HOD?.length || 0} />
          <Stat label="Employees" value={byRole.Employee?.length || 0} />
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <UsersIcon size={18} className="text-slate-500" />
          <h2 className="font-semibold text-slate-900">Members ({employees.length})</h2>
        </div>

        {employees.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No members yet" message="Nobody has been added to this department yet. New employees can choose this department when signing up, or an admin can assign them via the Users panel." />
        ) : (
          <div className="space-y-5">
            {['HOD', 'Employee', 'Admin'].map((role) => {
              const list = byRole[role] || [];
              if (!list.length) return null;
              return (
                <div key={role}>
                  <h3 className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">{role}s ({list.length})</h3>
                  <ul className="space-y-2">
                    {list.map((e) => (<EmployeeRow key={e._id} user={e} />))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function EmployeeRow({ user }) {
  const RoleIcon = user.role === 'Admin' ? Shield : user.role === 'HOD' ? UserCog : UserIcon;
  const roleStyle = user.role === 'Admin' ? 'text-red-600 bg-red-50' : user.role === 'HOD' ? 'text-amber-600 bg-amber-50' : 'text-slate-600 bg-slate-100';
  return (
    <li className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
      <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-semibold shrink-0">{user.name?.[0]?.toUpperCase() || '?'}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 truncate">{user.name}</div>
        <div className="text-xs text-slate-500 truncate flex items-center gap-1"><Mail size={11} /> {user.email}</div>
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded-md inline-flex items-center gap-1 ${roleStyle}`}><RoleIcon size={11} /> {user.role}</span>
    </li>
  );
}
