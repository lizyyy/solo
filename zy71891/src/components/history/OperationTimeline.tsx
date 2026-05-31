import { OperationLog } from '../../types';
import OperationTypeBadge from './OperationTypeBadge';
import { Clock, User, ArrowRight } from 'lucide-react';

interface OperationTimelineProps {
  logs: OperationLog[];
}

export default function OperationTimeline({ logs }: OperationTimelineProps) {
  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.operatedAt).getTime() - new Date(b.operatedAt).getTime()
  );

  const nonAffectingCount = logs.filter(l => !l.affectsConclusion).length;
  const affectingCount = logs.filter(l => l.affectsConclusion).length;

  return (
    <div className="bg-[#1a1f2e] border border-gray-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white font-medium">操作时间线</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            区分补材料和结论变更，清晰展示操作历史
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-gray-400">仅补材料: {nonAffectingCount} 条</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-gray-400">影响结论: {affectingCount} 条</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-700" />

        <ul className="space-y-6">
          {sortedLogs.map((log, index) => (
            <li
              key={log.id}
              className="relative pl-16"
              style={{
                animation: `fadeInUp 0.3s ease-out ${index * 0.1}s both`,
              }}
            >
              <div
                className={`absolute left-4 w-5 h-5 rounded-full border-2 ${
                  log.affectsConclusion
                    ? 'bg-orange-500 border-orange-300'
                    : 'bg-gray-700 border-gray-500'
                }`}
                style={{ transform: 'translateX(-50%)' }}
              />

              <div
                className={`p-4 rounded-lg border transition-all duration-200 hover:shadow-lg ${
                  log.affectsConclusion
                    ? 'bg-orange-900/10 border-orange-700/30 hover:border-orange-600/50'
                    : 'bg-gray-900/50 border-gray-700/30 hover:border-gray-600/50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <OperationTypeBadge
                    type={log.type}
                    affectsConclusion={log.affectsConclusion}
                  />
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(log.operatedAt)}</span>
                  </div>
                </div>

                <p className="text-gray-300 text-sm mb-3">{log.description}</p>

                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <User className="w-3 h-3" />
                  <span>操作人: {log.operator}</span>
                </div>

                {log.beforeChange && log.afterChange && (
                  <div className="flex items-center gap-3 mt-3 p-2 bg-gray-900/50 rounded">
                    <span className="text-xs text-gray-500">变更前:</span>
                    <span className="text-xs text-red-400 font-mono">
                      {log.beforeChange}
                    </span>
                    <ArrowRight className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-green-400 font-mono">
                      {log.afterChange}
                    </span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {logs.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          <p>暂无操作记录</p>
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
