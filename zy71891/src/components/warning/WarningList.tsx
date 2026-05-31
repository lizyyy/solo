import { useNavigate } from 'react-router-dom';
import { ChevronRight, Thermometer, Activity, Clock } from 'lucide-react';
import { Warning } from '../../types';
import StatusBadge from '../common/StatusBadge';

interface WarningListProps {
  warnings: Warning[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
}

export default function WarningList({
  warnings,
  selectedIds,
  onToggleSelect,
  onSelectAll,
}: WarningListProps) {
  const navigate = useNavigate();

  const allSelected = warnings.length > 0 && warnings.every(w => selectedIds.includes(w.id));

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-[#1a1f2e] border border-gray-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="w-12 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500"
              />
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              设备信息
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              状态
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              温度
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              振动
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              创建时间
            </th>
            <th className="w-12 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {warnings.map((warning, index) => (
            <tr
              key={warning.id}
              className="hover:bg-gray-800/30 transition-colors cursor-pointer"
              style={{
                animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`,
              }}
              onClick={() => navigate(`/warning/${warning.id}`)}
            >
              <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(warning.id)}
                  onChange={() => onToggleSelect(warning.id)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500"
                />
              </td>
              <td className="px-4 py-4">
                <div>
                  <p className="text-white font-medium">{warning.deviceName}</p>
                  <p className="text-xs text-gray-500">{warning.deviceId}</p>
                </div>
              </td>
              <td className="px-4 py-4">
                <StatusBadge status={warning.status} />
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <Thermometer className={`w-4 h-4 ${warning.temperature > -15 ? 'text-orange-400' : 'text-blue-400'}`} />
                  <span className={`font-mono ${warning.temperature > -15 ? 'text-orange-400' : 'text-gray-300'}`}>
                    {warning.temperature.toFixed(1)}°C
                  </span>
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <Activity className={`w-4 h-4 ${warning.vibration > 8 ? 'text-red-400' : warning.vibration > 5 ? 'text-orange-400' : 'text-green-400'}`} />
                  <span className={`font-mono ${warning.vibration > 8 ? 'text-red-400' : warning.vibration > 5 ? 'text-orange-400' : 'text-gray-300'}`}>
                    {warning.vibration.toFixed(2)} mm/s
                  </span>
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>{formatTime(warning.createdAt)}</span>
                </div>
              </td>
              <td className="px-4 py-4">
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {warnings.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          <p>暂无预警数据</p>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
