import { useMemo } from 'react';
import { ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import type { PrintBatch } from '../../types';
import { getMaterialName } from '../../data/materials';

interface CompareTableProps {
  batches: PrintBatch[];
}

export const CompareTable = ({ batches }: CompareTableProps) => {
  const avgBedTemp = batches.length > 0 
    ? Math.round(batches.reduce((sum, b) => sum + b.bedTemp, 0) / batches.length) 
    : 0;
  const avgNozzleTemp = batches.length > 0 
    ? Math.round(batches.reduce((sum, b) => sum + b.nozzleTemp, 0) / batches.length) 
    : 0;
  const avgCooling = batches.length > 0 
    ? Math.round(batches.reduce((sum, b) => sum + b.coolingFanSpeed, 0) / batches.length) 
    : 0;

  const getStatusBadge = (status: string) => {
    const configs: Record<string, string> = {
      draft: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
      analyzed: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      confirmed: 'bg-green-500/20 text-green-400 border-green-500/50',
    };
    const labels: Record<string, string> = {
      draft: '草稿',
      analyzed: '已分析',
      confirmed: '已确认',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs border ${configs[status] || configs.draft}`}>
        {labels[status] || labels.draft}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    });
  };

  const getDiffClass = (value: number, avg: number) => {
    if (value > avg) return 'text-orange-400';
    if (value < avg) return 'text-blue-400';
    return 'text-gray-400';
  };

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden h-full">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <h3 className="font-medium text-gray-200">批次参数对比</h3>
          </div>
          <div className="text-sm text-gray-400">
            共 <span className="text-blue-400 font-medium">{batches.length}</span> 个批次
          </div>
        </div>
      </div>

      {batches.length > 0 && (
        <div className="p-4 border-b border-slate-700 bg-slate-700/20">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500">平均床温</div>
              <div className="text-lg font-bold text-orange-400">{avgBedTemp}°C</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">平均喷嘴</div>
              <div className="text-lg font-bold text-red-400">{avgNozzleTemp}°C</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">平均冷却</div>
              <div className="text-lg font-bold text-blue-400">{avgCooling}%</div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 sticky top-0 z-10">
            <tr className="text-gray-400 border-b border-slate-700">
              <th className="text-left py-3 px-4">批次</th>
              <th className="text-left py-3 px-4">材料</th>
              <th className="text-right py-3 px-4">床温</th>
              <th className="text-right py-3 px-4">喷嘴</th>
              <th className="text-right py-3 px-4">冷却</th>
              <th className="text-right py-3 px-4">尺寸</th>
              <th className="text-center py-3 px-4">状态</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch, idx) => (
              <tr
                key={batch.id}
                className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
              >
                <td className="py-3 px-4">
                  <div className="font-mono text-gray-300 text-xs">#{batch.id.slice(-6)}</div>
                  <div className="text-xs text-gray-500">{formatDate(batch.createdAt)}</div>
                </td>
                <td className="py-3 px-4 text-gray-300">{getMaterialName(batch.materialId)}</td>
                <td className={`py-3 px-4 text-right font-mono ${getDiffClass(batch.bedTemp, avgBedTemp)}`}>
                  {batch.bedTemp}°C
                </td>
                <td className={`py-3 px-4 text-right font-mono ${getDiffClass(batch.nozzleTemp, avgNozzleTemp)}`}>
                  {batch.nozzleTemp}°C
                </td>
                <td className={`py-3 px-4 text-right font-mono ${getDiffClass(batch.coolingFanSpeed, avgCooling)}`}>
                  {batch.coolingFanSpeed}%
                </td>
                <td className="py-3 px-4 text-right font-mono text-gray-400 text-xs">
                  {batch.modelWidth}×{batch.modelHeight}
                </td>
                <td className="py-3 px-4 text-center">
                  {getStatusBadge(batch.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
