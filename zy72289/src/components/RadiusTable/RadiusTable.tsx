import { motion } from 'framer-motion';
import { Table } from 'lucide-react';
import { RadiusRow } from './RadiusRow';
import { useAppStore } from '@/store/useAppStore';

export function RadiusTable() {
  const { safetyRadiusTable, scenarioType, pointCloudLogs } = useAppStore();

  const highlightedDeviceIds = pointCloudLogs.flatMap((log) =>
    log.detectedObstacles
      .filter((o) => o.status === 'conflict')
      .map((o) => o.deviceId || '')
  );

  const conflictCount = safetyRadiusTable.filter((e) => e.hasConflict || e.oldRadius !== e.newRadius).length;

  return (
    <div className="h-full flex flex-col bg-primary-900/40 backdrop-blur-sm">
      <div className="p-4 border-b border-primary-700/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-700/50">
              <Table size={18} className="text-primary-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">安全半径表</h2>
              <p className="text-xs text-gray-400">
                共 {safetyRadiusTable.length} 条记录
                {conflictCount > 0 && (
                  <span className="ml-2 text-status-pending">
                    ({conflictCount} 条口径更新)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-primary-800/90 backdrop-blur-sm">
            <tr className="text-left text-gray-400 text-[10px] uppercase tracking-wider">
              <th className="px-3 py-2 font-medium">设备ID</th>
              <th className="px-3 py-2 font-medium">设备名称</th>
              <th className="px-3 py-2 font-medium">电压</th>
              <th className="px-3 py-2 font-medium">旧口径</th>
              <th className="px-3 py-2 font-medium">新口径</th>
              <th className="px-3 py-2 font-medium">版本</th>
              <th className="px-3 py-2 font-medium">生效日期</th>
            </tr>
          </thead>
          <tbody>
            {safetyRadiusTable.map((entry, index) => (
              <RadiusRow
                key={entry.id}
                entry={entry}
                isHighlighted={highlightedDeviceIds.includes(entry.deviceId)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-3 border-t border-primary-700/30 bg-primary-900/60">
        <div className="text-[10px] text-gray-500 space-y-1">
          <p>
          <span className="text-gray-400">📋 小陶说：</span>安全半径表是变电站的"标准度量衡"，所有标注必须以这里的新口径为准。</p>
          <p>
          <span className="text-gray-400">⚠️ 注意：</span>带删除线的是旧口径，箭头指向的才是现行标准。</p>
        </div>
      </div>
      </div>
  );
}
