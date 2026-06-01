import { AlertTriangle, Map, Users, Clock } from 'lucide-react';
import type { AnomalyStats } from '../types';
import { useProjectStore } from '../store/projectStore';

const anomalyInfo: Record<string, { label: string; color: string; icon: string }> = {
  coordinate_offset: { label: '坐标偏移', color: 'text-yellow-500', icon: '📍' },
  duplicate_name: { label: '设备重名', color: 'text-purple-500', icon: '🔄' },
  missing_photo: { label: '缺少照片', color: 'text-red-500', icon: '📷' },
  cross_floor: { label: '跨楼层关联', color: 'text-orange-500', icon: '🔗' },
};

export function AnomalyStats() {
  const getAnomalyStats = useProjectStore((state) => state.getAnomalyStats);
  const stats = getAnomalyStats();

  if (!stats) return null;

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="text-yellow-400" size={18} />
        <h3 className="font-bold text-white">异常汇总</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-700/50 rounded p-3 text-center">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-xs text-slate-400">异常点位</div>
        </div>
        {(Object.keys(anomalyInfo) as (keyof AnomalyStats)[]).map((key) => (
          <div key={key} className="bg-slate-700/50 rounded p-3">
            <div className="flex items-center justify-between">
              <span className="text-lg">{anomalyInfo[key].icon}</span>
              <span className={`text-xl font-bold ${anomalyInfo[key].color}`}>
                {stats[key]}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {anomalyInfo[key].label}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-700">
        <div className="text-xs text-slate-500 text-center">
          * 异常未被隐藏，全部计入统计
        </div>
      </div>
    </div>
  );
}
