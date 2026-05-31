import { useNavigate } from 'react-router-dom';
import type { InspectionRecord } from '../../../shared/types';
import { formatDateTime, getStatusColor } from '../utils/format';
import StatusBadge from './StatusBadge';
import ChangeTypeBadge from './ChangeTypeBadge';
import { Eye, CheckSquare, Square } from 'lucide-react';

interface DataTableProps {
  inspections: InspectionRecord[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
}

export default function DataTable({
  inspections,
  selectedIds,
  onToggleSelect,
  onSelectAll,
}: DataTableProps) {
  const navigate = useNavigate();
  const allSelected = inspections.length > 0 && selectedIds.length === inspections.length;

  return (
    <div className="bg-white border-2 border-slate-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b-2 border-slate-200">
              <th className="px-4 py-3 text-left">
                <button
                  onClick={onSelectAll}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {allSelected ? (
                    <CheckSquare size={18} className="text-primary-600" />
                  ) : (
                    <Square size={18} />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                检查名称
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                坡道编号
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                状态
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                最近变更
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                点位数
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                更新时间
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inspections.map((inspection) => {
              const isSelected = selectedIds.includes(inspection.id);
              const lastChange = inspection.changeHistory[inspection.changeHistory.length - 1];
              const hasFlipDeviation = inspection.flipDeviation !== undefined && inspection.flipDeviation > 0;

              return (
                <tr
                  key={inspection.id}
                  className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-primary-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onToggleSelect(inspection.id)}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {isSelected ? (
                        <CheckSquare size={18} className="text-primary-600" />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{inspection.name}</div>
                    <div className="text-xs text-slate-500">{inspection.parkingLot}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-slate-700">
                    {inspection.rampNumber}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inspection.status} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    {lastChange ? (
                      <div className="space-y-1">
                        <ChangeTypeBadge
                          type={lastChange.type}
                          affectsConclusion={lastChange.affectsConclusion}
                          size="sm"
                        />
                        {hasFlipDeviation && (
                          <div
                            className="text-xs font-medium"
                            style={{ color: getStatusColor('exception') }}
                          >
                            翻转偏差: {(inspection.flipDeviation! * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">暂无变更</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-bold text-slate-700">
                      {inspection.coordinates.points.length}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                    {formatDateTime(inspection.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => navigate(`/inspection/${inspection.id}`)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded border-2 border-primary-200 hover:bg-primary-100 transition-colors text-sm font-medium"
                    >
                      <Eye size={14} />
                      查看
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {inspections.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>暂无检查记录</p>
        </div>
      )}
    </div>
  );
}
