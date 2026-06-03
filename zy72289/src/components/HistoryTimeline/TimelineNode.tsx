import { motion } from 'framer-motion';
import { FileText, Search, Edit3, RefreshCw, AlertTriangle, Eye } from 'lucide-react';
import type { HistoryRecord } from '@/types';
import { statusColors } from '@/types';

interface TimelineNodeProps {
  record: HistoryRecord;
  isLatest: boolean;
}

const actionConfig: Record<
  string,
  { icon: typeof FileText; label: string; color: string }
> = {
  import_log: {
    icon: FileText,
    label: '导入日志',
    color: statusColors.normal,
  },
  check_radius: {
    icon: Search,
    label: '核对半径表',
    color: '#60a5fa',
  },
  update_annotation: {
    icon: Eye,
    label: '更新标注',
    color: '#a78bfa',
  },
  manual_correct: {
    icon: Edit3,
    label: '人工修正',
    color: statusColors.corrected,
  },
  re_run: {
    icon: RefreshCw,
    label: '重跑分析',
    color: statusColors.normal,
  },
  mark_review: {
    icon: AlertTriangle,
    label: '标记待复核',
    color: statusColors.pending_review,
  },
};

export function TimelineNode({ record, isLatest }: TimelineNodeProps) {
  const config = actionConfig[record.actionType] || actionConfig.import_log;
  const IconComponent = config.icon;

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative pl-6 pb-4 last:pb-0"
    >
      <div className="absolute left-0 top-0 bottom-0 w-px bg-primary-700/50" />

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="absolute left-0 top-1 -translate-x-1/2 z-10"
      >
        <div
          className={`
            w-3 h-3 rounded-full border-2 border-primary-900
            ${isLatest ? 'animate-pulse' : ''}
          `}
          style={{ backgroundColor: config.color }}
        />
      </motion.div>

      <div
        className={`
          bg-primary-800/50 rounded-lg p-3 backdrop-blur-sm
          border border-primary-700/30
          ${isLatest ? 'ring-1 ring-primary-500/30' : ''}
        `}
      >
        <div className="flex items-start gap-2">
          <div
            className="p-1.5 rounded-md flex-shrink-0"
            style={{ backgroundColor: config.color + '30' }}
          >
            <IconComponent size={14} style={{ color: config.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white">
                {config.label}
              </span>
              <span className="text-[10px] text-gray-500 font-mono flex-shrink-0">
                {formatTime(record.timestamp)}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
              {record.description}
            </p>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[10px] text-gray-500">操作人:</span>
              <span className="text-[10px] text-primary-300">{record.operator}</span>
            </div>
            {record.affectedObstacleIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {record.affectedObstacleIds.map((id) => (
                  <span
                    key={id}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-primary-700/50 text-gray-400 font-mono"
                  >
                    {id}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
