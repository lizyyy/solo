import { CheckCircle, AlertTriangle, Edit3 } from 'lucide-react';
import { SunshineRecord } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';

interface CategoryCardProps {
  title: string;
  description: string;
  records: SunshineRecord[];
  icon: 'confirmed' | 'supplement' | 'modified';
  color: string;
}

export function CategoryCard({ title, description, records, icon, color }: CategoryCardProps) {
  const IconComponent = icon === 'confirmed' ? CheckCircle : icon === 'supplement' ? AlertTriangle : Edit3;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className={`${color} p-4 text-white`}>
        <div className="flex items-center gap-3">
          <IconComponent className="w-6 h-6" />
          <div>
            <h3 className="font-bold text-lg">{title}</h3>
            <p className="text-sm opacity-90">{description}</p>
          </div>
          <div className="ml-auto text-3xl font-bold">{records.length}</div>
        </div>
      </div>

      <div className="p-4 max-h-80 overflow-auto">
        {records.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p>暂无记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {records.map((record) => (
              <div
                key={record.id}
                className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-700">
                    {record.buildingName} {record.floor}层{record.roomNumber}
                  </span>
                  <StatusBadge status={record.status} />
                </div>
                <div className="text-xs text-slate-500 mb-1">
                  来源: {record.source} | 处理人: {record.currentHandler}
                </div>
                {record.pendingReason && (
                  <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded mt-1">
                    {record.pendingReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
