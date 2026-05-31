import { Threshold } from '../../types';
import { Clock, AlertTriangle, CheckCircle, FileText } from 'lucide-react';

interface ThresholdTableProps {
  thresholds: Threshold[];
}

export default function ThresholdTable({ thresholds }: ThresholdTableProps) {
  const isOutOfRange = (t: Threshold) =>
    t.actualValue < t.minValue || t.actualValue > t.maxValue;

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatValue = (value: number) => value.toFixed(2);

  return (
    <div className="bg-[#1a1f2e] border border-gray-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-medium">阈值表对比</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              灰色背景为补材料记录，不影响结论判断
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-700/50 border border-gray-600" />
              <span className="text-gray-400">补材料</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-orange-400" />
              <span className="text-gray-400">超出范围</span>
            </div>
          </div>
        </div>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900/50">
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              指标
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              最小值
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              最大值
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              实际值
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              状态
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              提交时间
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
              补材料
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {thresholds.map((threshold, index) => {
            const outOfRange = isOutOfRange(threshold);
            return (
              <tr
                key={threshold.id}
                className={`transition-colors ${
                  threshold.isBackfilled ? 'bg-gray-800/30' : 'hover:bg-gray-800/20'
                }`}
                style={{
                  animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`,
                }}
              >
                <td className="px-4 py-3">
                  <span className="text-white font-medium">{threshold.metric}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-mono text-gray-400">
                    {formatValue(threshold.minValue)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-mono text-gray-400">
                    {formatValue(threshold.maxValue)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`font-mono font-medium ${
                      outOfRange ? 'text-red-400' : 'text-green-400'
                    }`}
                  >
                    {formatValue(threshold.actualValue)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {outOfRange ? (
                    <div className="flex items-center justify-center gap-1 text-orange-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs">超限</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs">正常</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-gray-400 text-xs">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(threshold.submittedAt)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  {threshold.isBackfilled ? (
                    <div className="flex items-center justify-center gap-1 text-gray-400">
                      <FileText className="w-4 h-4" />
                      <span className="text-xs">是</span>
                    </div>
                  ) : (
                    <span className="text-gray-500 text-xs">否</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

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
