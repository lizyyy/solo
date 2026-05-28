import { AuditTrail } from '@/types';
import { ACTION_LABELS } from '@/constants/purposeCodes';
import { Clock, User } from 'lucide-react';

interface TimelineProps {
  trails: AuditTrail[];
}

export const Timeline = ({ trails }: TimelineProps) => {
  const sortedTrails = [...trails].sort(
    (a, b) => new Date(b.operateTime).getTime() - new Date(a.operateTime).getTime()
  );

  const formatTime = (time: string) => {
    const d = new Date(time);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getActionColor = (action: string) => {
    if (action.includes('reject') || action.includes('withdraw')) return 'bg-red-500';
    if (action.includes('pass') || action.includes('confirm')) return 'bg-emerald-500';
    if (action.includes('supplement')) return 'bg-amber-500';
    if (action.includes('issue') || action.includes('detect')) return 'bg-rose-500';
    if (action.includes('submit')) return 'bg-blue-500';
    return 'bg-slate-400';
  };

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
      <div className="space-y-6">
        {sortedTrails.map((trail, index) => (
          <div key={trail.id} className="relative pl-10" style={{
            animationDelay: `${index * 50}ms`,
            animation: 'fadeInUp 0.4s ease-out forwards',
            opacity: 0,
          }}>
            <div
              className={`absolute left-2 w-5 h-5 rounded-full border-4 border-white shadow-md ${getActionColor(trail.action)}`}
            />
            <div className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-800">
                  {ACTION_LABELS[trail.action] || trail.action}
                </span>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock size={12} />
                  {formatTime(trail.operateTime)}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2 text-sm text-slate-600">
                <User size={14} />
                <span>{trail.operator}</span>
              </div>
              <p className="text-sm text-slate-600">{trail.remark}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="px-2 py-0.5 bg-slate-100 rounded">状态: {trail.fromStatus} → {trail.toStatus}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
