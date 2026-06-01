import { AlertTriangle, CheckCircle, Clock, MapPin, XCircle, AlertCircle } from 'lucide-react';
import { useFilteredBuildings, useBuildings } from '../../store/useSandboxStore';
import { calculateStatistics } from '../../utils/filter';
import { SUNLIGHT_STANDARD } from '../../data/types';

export function StatusBar() {
  const allBuildings = useBuildings();
  const filteredBuildings = useFilteredBuildings();
  const stats = calculateStatistics(filteredBuildings);
  const allStats = calculateStatistics(allBuildings);

  return (
    <div className="absolute top-20 left-4 z-20 flex flex-col gap-2">
      <div className="bg-[#0a1628]/90 backdrop-blur-sm border border-[#2a3a5a] rounded px-3 py-2 min-w-48">
        <div className="text-xs text-[#8a9ab0] mb-1">当前筛选结果</div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-sm text-white">
            <MapPin size={14} className="text-[#4a90d9]" />
            <span className="font-mono">{stats.total}</span>
            <span className="text-[#8a9ab0] text-xs">栋</span>
          </div>
          <div className="text-xs text-[#5a6a80]">
            共 {allStats.total} 栋
          </div>
        </div>
      </div>

      {stats.withAnomalies > 0 && (
        <div className="bg-[#1a0f0f]/90 backdrop-blur-sm border border-[#5a2a2a] rounded px-3 py-2">
          <div className="flex items-center gap-1.5 text-sm text-[#ff6b6b]">
            <AlertTriangle size={14} />
            <span>异常数据</span>
            <span className="font-mono ml-auto">{stats.withAnomalies}</span>
          </div>
        </div>
      )}

      {stats.needsConfirmation > 0 && (
        <div className="bg-[#1a1a0f]/90 backdrop-blur-sm border border-[#5a5a2a] rounded px-3 py-2">
          <div className="flex items-center gap-1.5 text-sm text-[#ffd93d]">
            <AlertCircle size={14} />
            <span>待人工确认</span>
            <span className="font-mono ml-auto">{stats.needsConfirmation}</span>
          </div>
        </div>
      )}

      {stats.emptyValues > 0 && (
        <div className="bg-[#0f1a1a]/90 backdrop-blur-sm border border-[#2a5a5a] rounded px-3 py-2">
          <div className="flex items-center gap-1.5 text-sm text-[#95a5a6]">
            <Clock size={14} />
            <span>待测算</span>
            <span className="font-mono ml-auto">{stats.emptyValues}</span>
          </div>
        </div>
      )}

      {stats.boundaryCases > 0 && (
        <div className="bg-[#1a150f]/90 backdrop-blur-sm border border-[#5a4a2a] rounded px-3 py-2">
          <div className="flex items-center gap-1.5 text-sm text-[#ffb347]">
            <AlertCircle size={14} />
            <span>边界值记录</span>
            <span className="font-mono ml-auto">{stats.boundaryCases}</span>
          </div>
        </div>
      )}

      {stats.duplicates > 0 && (
        <div className="bg-[#151a0f]/90 backdrop-blur-sm border border-[#4a5a2a] rounded px-3 py-2">
          <div className="flex items-center gap-1.5 text-sm text-[#a8d94a]">
            <XCircle size={14} />
            <span>重名设备</span>
            <span className="font-mono ml-auto">{stats.duplicates}</span>
          </div>
        </div>
      )}

      <div className="bg-[#0a1628]/90 backdrop-blur-sm border border-[#2a3a5a] rounded px-3 py-2">
        <div className="text-xs text-[#8a9ab0] mb-1">日照达标情况</div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs">
            <CheckCircle size={12} className="text-[#2ecc71]" />
            <span className="text-[#2ecc71] font-mono">{stats.aboveStandard}</span>
            <span className="text-[#8a9ab0]">达标</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <AlertTriangle size={12} className="text-[#ffb347]" />
            <span className="text-[#ffb347] font-mono">{stats.belowStandard}</span>
            <span className="text-[#8a9ab0]">&lt;{SUNLIGHT_STANDARD}h</span>
          </div>
        </div>
        {stats.avgSunlightHours !== null && (
          <div className="mt-1 pt-1 border-t border-[#1a2a4a]">
            <span className="text-xs text-[#8a9ab0]">平均日照: </span>
            <span className="text-sm text-white font-mono">
              {stats.avgSunlightHours.toFixed(1)}h
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
