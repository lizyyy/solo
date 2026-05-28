import { useMemo, useRef, useEffect } from 'react';
import type { StressPoint, RiskLevel } from '../../types';
import { getRiskLevelColor, getRiskLevelLabel } from '../../utils/stressCalculator';
import { usePrintStore } from '../../store/usePrintStore';

interface StressDetailTableProps {
  stressDistribution: StressPoint[][];
}

export const StressDetailTable = ({ stressDistribution }: StressDetailTableProps) => {
  const { selectedRowId, selectDetailRow } = usePrintStore();
  const tableRef = useRef<HTMLDivElement>(null);

  const detailRows = useMemo(() => {
    if (!stressDistribution || stressDistribution.length === 0) return [];

    const rows = [];
    for (let y = 0; y < stressDistribution.length; y++) {
      for (let x = 0; x < stressDistribution[y].length; x++) {
        const point = stressDistribution[y][x];
        const positionLabels = [];
        if (x === 0) positionLabels.push('左');
        if (x === stressDistribution[y].length - 1) positionLabels.push('右');
        if (y === 0) positionLabels.push('前');
        if (y === stressDistribution.length - 1) positionLabels.push('后');
        const position = positionLabels.length > 0 ? positionLabels.join('') : '中心区域';

        rows.push({
          id: point.detailRowId,
          position: `(${x}, ${y}) ${position}`,
          x,
          y,
          stressValue: point.value,
          riskLevel: point.riskLevel,
        });
      }
    }
    return rows.sort((a, b) => b.stressValue - a.stressValue);
  }, [stressDistribution]);

  useEffect(() => {
    if (selectedRowId && tableRef.current) {
      const rowElement = tableRef.current.querySelector(`[data-row-id="${selectedRowId}"]`);
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedRowId]);

  if (!stressDistribution || stressDistribution.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-800/30 rounded-lg border border-slate-700 border-dashed">
        <div className="text-gray-500 text-center">
          <div>请先运行应力分析</div>
        </div>
      </div>
    );
  }

  const getRiskBadgeClass = (level: RiskLevel) => {
    const classes: Record<RiskLevel, string> = {
      low: 'bg-green-500/20 text-green-400 border-green-500/50',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
      critical: 'bg-red-500/20 text-red-400 border-red-500/50',
    };
    return classes[level];
  };

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
      <h4 className="text-sm font-medium text-gray-300 mb-3">应力明细（按风险排序）</h4>
      <div ref={tableRef} className="max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-800 z-10">
            <tr className="text-gray-400 border-b border-slate-700">
              <th className="text-left py-2 px-2">位置</th>
              <th className="text-right py-2 px-2">应力值</th>
              <th className="text-center py-2 px-2">风险等级</th>
            </tr>
          </thead>
          <tbody>
            {detailRows.map((row, idx) => (
              <tr
                key={row.id}
                data-row-id={row.id}
                onClick={() => selectDetailRow(row.id, { x: row.x, y: row.y })}
                className={`border-b border-slate-700/50 cursor-pointer transition-colors ${
                  selectedRowId === row.id
                    ? 'bg-blue-500/20'
                    : 'hover:bg-slate-700/50'
                }`}
              >
                <td className="py-2 px-2 text-gray-300 font-mono">
                  <span className="text-gray-500 mr-1">#{idx + 1}</span>
                  {row.position}
                </td>
                <td
                  className="py-2 px-2 text-right font-mono font-bold"
                  style={{ color: getRiskLevelColor(row.riskLevel) }}
                >
                  {row.stressValue.toFixed(1)}
                </td>
                <td className="py-2 px-2 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs border ${getRiskBadgeClass(
                      row.riskLevel,
                    )}`}
                  >
                    {getRiskLevelLabel(row.riskLevel)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
