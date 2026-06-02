import { useBusStopStats } from '@/store/useStore';
import { MapPin, Clock, CheckCircle, AlertTriangle, GitMerge, AlertCircle } from 'lucide-react';

export default function StatsBar() {
  const stats = useBusStopStats();

  const statItems = [
    { label: '总点位', value: stats.total, icon: MapPin, color: 'text-slate-700', bg: 'bg-slate-100' },
    { label: '待处理', value: stats.pending, icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100' },
    { label: '已确认', value: stats.confirmed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '待审核', value: stats.needsReview, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: '例外', value: stats.exception, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: '已归并', value: stats.merged, icon: GitMerge, color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-slate-700" />
          <h1 className="text-lg font-bold text-slate-800">公交站点迁移评估</h1>
        </div>
        <div className="flex-1" />
        <div className="flex gap-4">
          {statItems.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${item.bg}`}
            >
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <span className="text-sm text-slate-600">{item.label}:</span>
              <span className={`font-bold ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
