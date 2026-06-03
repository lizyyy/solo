import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Clock, User, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import type { PointCloudLog } from '@/types';
import { statusLabels, statusColors } from '@/types';
import { scenarioDescriptions } from '@/data/mockData';

interface LogCardProps {
  log: PointCloudLog;
  isLatest: boolean;
}

const statusIcons = {
  imported: FileText,
  reviewed: AlertTriangle,
  corrected: CheckCircle,
};

export function LogCard({ log, isLatest }: LogCardProps) {
  const [expanded, setExpanded] = useState(isLatest);

  const scenarioInfo = scenarioDescriptions[log.scenarioType];
  const StatusIcon = statusIcons[log.status];

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusBorderColor = () => {
    const hasConflict = log.detectedObstacles.some((o) => o.status === 'conflict');
    const hasPending = log.detectedObstacles.some((o) => o.status === 'pending_review');
    const hasCorrected = log.detectedObstacles.some((o) => o.status === 'corrected');

    if (hasConflict) return 'border-status-conflict';
    if (hasPending) return 'border-status-pending';
    if (hasCorrected) return 'border-status-corrected';
    return 'border-status-normal';
  };

  return (
    <motion.div
      layout
      className={`
        bg-primary-800/60 rounded-lg border-l-4 ${getStatusBorderColor()}
        overflow-hidden backdrop-blur-sm transition-all duration-300
        ${isLatest ? 'ring-2 ring-primary-500/50' : ''}
      `}
    >
      <div
        className="p-3 cursor-pointer hover:bg-primary-700/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded-md"
              style={{ backgroundColor: statusColors.normal + '30' }}
            >
              <FileText size={16} className="text-primary-300" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">{log.deviceName}</h4>
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                <Clock size={10} />
                <span>{formatTime(log.importTime)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-lg">{scenarioInfo?.icon}</span>
            {expanded ? (
              <ChevronUp size={16} className="text-gray-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-400" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <User size={10} />
            <span>{log.operator}</span>
          </div>
          <div className="flex items-center gap-1">
            <StatusIcon size={10} className="text-primary-400" />
            <span
              className="text-xs px-1.5 py-0.5 rounded bg-primary-700/50 text-primary-200"
            >
              {log.status === 'imported'
                ? '已导入'
                : log.status === 'reviewed'
                  ? '已核对'
                  : '已修正'}
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-primary-700/50">
              <div className="mt-3 p-2 bg-primary-900/50 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-yellow-400">
                      {scenarioInfo?.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      {scenarioInfo?.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-2">抽稀参数</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-primary-900/50 p-2 rounded">
                    <p className="text-gray-500">体素大小</p>
                    <p className="text-white font-mono">{log.thinningParams.voxelSize}m</p>
                  </div>
                  <div className="bg-primary-900/50 p-2 rounded">
                    <p className="text-gray-500">最大点数</p>
                    <p className="text-white font-mono">
                      {log.thinningParams.maxPoints.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-primary-900/50 p-2 rounded">
                    <p className="text-gray-500">质量</p>
                    <p className="text-white font-mono capitalize">
                      {log.thinningParams.quality}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-2">检测到的障碍物 ({log.detectedObstacles.length})</p>
                <div className="space-y-1.5">
                  {log.detectedObstacles.map((obs) => (
                    <div
                      key={obs.id}
                      className="flex items-center justify-between bg-primary-900/50 p-2 rounded text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: statusColors[obs.status] }}
                        />
                        <span className="text-white">{obs.name}</span>
                        {obs.alias && (
                          <span className="text-yellow-500 text-[10px]">
                            (别名: {obs.alias})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 font-mono">
                          {obs.detectedRadius}m
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px]"
                          style={{
                            backgroundColor: statusColors[obs.status] + '30',
                            color: statusColors[obs.status],
                          }}
                        >
                          {statusLabels[obs.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
