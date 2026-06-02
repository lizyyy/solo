import { ValidationStatus, STATUS_LABELS } from '../types';
import { useTrackStore } from '../store/useTrackStore';
import { CheckCircle, Clock, AlertTriangle, CopyX, FileWarning, LayoutGrid } from 'lucide-react';

const statusConfig: Array<{
  status: ValidationStatus | 'all';
  icon: typeof LayoutGrid;
  color: string;
  activeColor: string;
}> = [
  { status: 'all', icon: LayoutGrid, color: 'text-slate-500', activeColor: 'text-slate-900 border-slate-900' },
  { status: 'normal', icon: CheckCircle, color: 'text-emerald-600', activeColor: 'text-emerald-700 border-emerald-600' },
  { status: 'auth_expired', icon: Clock, color: 'text-amber-600', activeColor: 'text-amber-700 border-amber-600' },
  { status: 'tc_mismatch', icon: AlertTriangle, color: 'text-rose-600', activeColor: 'text-rose-700 border-rose-600' },
  { status: 'duplicate', icon: CopyX, color: 'text-purple-600', activeColor: 'text-purple-700 border-purple-600' },
  { status: 'dirty_data', icon: FileWarning, color: 'text-slate-600', activeColor: 'text-slate-700 border-slate-600' },
];

export default function StatusTabs() {
  const filters = useTrackStore((state) => state.filters);
  const setFilters = useTrackStore((state) => state.setFilters);
  const getStats = useTrackStore((state) => state.getStats);
  const stats = getStats();

  const handleStatusChange = (status: ValidationStatus | 'all') => {
    setFilters({ status });
  };

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {statusConfig.map(({ status, icon: Icon, color, activeColor }) => {
        const isActive = filters.status === status;
        const count = stats[status];
        const label = STATUS_LABELS[status];

        return (
          <button
            key={status}
            onClick={() => handleStatusChange(status)}
            className={`group flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all duration-200 ${
              isActive
                ? `bg-white shadow-md border-b-4 ${activeColor}`
                : `bg-white/50 border-transparent hover:bg-white hover:border-slate-200 ${color}`
            }`}
          >
            <Icon
              size={18}
              className={`transition-transform group-hover:scale-110 ${isActive ? 'animate-pulse' : ''}`}
            />
            <span className="font-medium text-sm">{label}</span>
            <span
              className={`min-w-[24px] h-6 px-2 flex items-center justify-center rounded-full text-xs font-bold ${
                isActive
                  ? status === 'all' ? 'bg-slate-900 text-white' :
                    status === 'normal' ? 'bg-emerald-600 text-white' :
                    status === 'auth_expired' ? 'bg-amber-600 text-white' :
                    status === 'tc_mismatch' ? 'bg-rose-600 text-white' :
                    status === 'duplicate' ? 'bg-purple-600 text-white' :
                    'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
