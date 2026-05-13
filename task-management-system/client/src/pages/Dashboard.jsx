import { ListTodo, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard.jsx';
import Loader from '../components/Loader.jsx';
import useFetch from '../hooks/useFetch.js';
import { dashboardService } from '../services/index.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading } = useFetch(() => dashboardService.summary(), []);
  const { data: prod } = useFetch(
    () => user?.role !== 'Employee' ? dashboardService.productivity(30) : Promise.resolve({ data: [] }),
    [user?.role]
  );

  if (loading) return <Loader />;
  const s = data?.summary || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          {user?.role === 'Admin' ? 'Organization-wide overview.' : user?.role === 'HOD' ? 'Your department at a glance.' : 'Your tasks summary.'}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total tasks" value={s.total} icon={ListTodo} to="/tasks" />
        <StatCard label="In progress" value={s.byStatus?.['In Progress'] || 0} icon={Clock} accent="amber" to="/tasks?status=In+Progress" />
        <StatCard label="Completed" value={s.byStatus?.Completed || 0} icon={CheckCircle2} accent="emerald" hint={`${s.completionRate ?? 0}% completion`} to="/tasks?status=Completed" />
        <StatCard label="Overdue" value={s.overdue} icon={AlertTriangle} accent="red" to="/tasks?overdue=true" />
      </div>

      {Array.isArray(s.perDepartment) && s.perDepartment.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Tasks per department</h2>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="text-left py-2 pr-4">Department</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-right py-2 px-2">Completed</th>
                  <th className="text-right py-2 pl-2">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {s.perDepartment.map((row) => (
                  <tr key={row._id || 'none'}>
                    <td className="py-2 pr-4 font-medium">
                      {row._id ? (<Link to={`/departments/${row._id}`} className="text-slate-900 hover:text-brand-600 hover:underline">{row.department}</Link>) : (row.department || 'Unassigned')}
                    </td>
                    <td className="py-2 px-2 text-right">{row.total}</td>
                    <td className="py-2 px-2 text-right text-emerald-700">{row.completed}</td>
                    <td className="py-2 pl-2 text-right text-red-600">{row.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {prod?.data?.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-1">Employee productivity</h2>
          <p className="text-xs text-slate-500 mb-4">Last {prod.days} days</p>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="text-left py-2 pr-4">Employee</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-right py-2 px-2">Completed</th>
                  <th className="text-right py-2 px-2">On time</th>
                  <th className="text-right py-2 px-2">Overdue</th>
                  <th className="text-right py-2 pl-2">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prod.data.slice(0, 10).map((row) => (
                  <tr key={row._id}>
                    <td className="py-2 pr-4">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.role}</div>
                    </td>
                    <td className="py-2 px-2 text-right">{row.total}</td>
                    <td className="py-2 px-2 text-right">{row.completed}</td>
                    <td className="py-2 px-2 text-right">{row.onTime}</td>
                    <td className="py-2 px-2 text-right text-red-600">{row.overdue}</td>
                    <td className="py-2 pl-2 text-right font-medium">{Math.round(row.completionRate)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
