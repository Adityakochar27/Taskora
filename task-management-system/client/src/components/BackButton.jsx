import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * BackButton — smart back navigation.
 *
 * If browser history has entries, goes back. Otherwise falls back to
 * `fallbackTo` (default: /dashboard) so deep-linked users aren't stranded.
 */
export default function BackButton({ fallbackTo = '/dashboard', label = 'Back', className = '' }) {
  const navigate = useNavigate();
  const location = useLocation();

  const onClick = () => {
    const hasHistory = window.history.length > 1 && location.key !== 'default';
    if (hasHistory) {
      navigate(-1);
    } else {
      navigate(fallbackTo);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition ${className}`}
      aria-label={label}
    >
      <ArrowLeft size={16} /> {label}
    </button>
  );
}
