import { useFormationStore } from '@/store/formationStore';
import { useSchemeStore } from '@/store/schemeStore';
import { AlertTriangle, CheckCircle, Clock, AlertCircle, Copy, MapPin } from 'lucide-react';

export function StatusBar() {
  const { drones } = useFormationStore();
  const { getCurrentScheme } = useSchemeStore();

  const currentScheme = getCurrentScheme();

  const statusCounts = {
    normal: drones.filter((d) => d.status === 'NORMAL').length,
    warning: drones.filter((d) => d.status === 'WARNING').length,
    confirm: drones.filter((d) => d.status === 'CONFIRM').length,
    history: drones.filter((d) => d.status === 'HISTORY').length,
    error: drones.filter((d) => d.status === 'ERROR').length,
    duplicate: drones.filter((d) => d.status === 'DUPLICATE').length,
    boundary: drones.filter((d) => d.status === 'BOUNDARY').length,
  };

  const abnormalCount = drones.filter((d) => d.status !== 'NORMAL').length;

  return (
    <div className="h-7 bg-[#0a1628] border-t border-white/10 flex items-center px-4 gap-4 text-[10px]">
      <div className="flex items-center gap-2 text-gray-400">
        {currentScheme ? (
          <>
            <span className="text-blue-400">●</span>
            <span className="text-gray-300">{currentScheme.name}</span>
          </>
        ) : (
          <>
            <span className="text-gray-500">○</span>
            <span>未保存方案</span>
          </>
        )}
      </div>

      <div className="h-4 w-px bg-white/10" />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-green-400">
          <CheckCircle size={12} />
          <span>正常 {statusCounts.normal}</span>
        </div>

        {statusCounts.warning > 0 && (
          <div className="flex items-center gap-1.5 text-orange-400">
            <AlertTriangle size={12} />
            <span>预警 {statusCounts.warning}</span>
          </div>
        )}

        {statusCounts.confirm > 0 && (
          <div className="flex items-center gap-1.5 text-orange-500 animate-pulse">
            <AlertCircle size={12} />
            <span>待确认 {statusCounts.confirm}</span>
          </div>
        )}

        {statusCounts.history > 0 && (
          <div className="flex items-center gap-1.5 text-gray-400">
            <Clock size={12} />
            <span>历史 {statusCounts.history}</span>
          </div>
        )}

        {statusCounts.error > 0 && (
          <div className="flex items-center gap-1.5 text-red-400">
            <AlertCircle size={12} />
            <span>错误 {statusCounts.error}</span>
          </div>
        )}

        {statusCounts.duplicate > 0 && (
          <div className="flex items-center gap-1.5 text-purple-400">
            <Copy size={12} />
            <span>重复 {statusCounts.duplicate}</span>
          </div>
        )}

        {statusCounts.boundary > 0 && (
          <div className="flex items-center gap-1.5 text-red-500">
            <MapPin size={12} />
            <span>边界 {statusCounts.boundary}</span>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <div className="text-gray-500">
        {abnormalCount > 0 ? (
          <span className="text-red-400">共 {abnormalCount} 条异常待处理</span>
        ) : (
          <span className="text-green-400">全部正常</span>
        )}
      </div>

      <div className="text-gray-600">
        无人机编队避障舱 v1.0
      </div>
    </div>
  );
}
