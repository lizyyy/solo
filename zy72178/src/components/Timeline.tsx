import { motion } from 'framer-motion';
import { CheckCircle, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatDateTime, formatRelativeTime } from '../utils/date';
import type { CheckupRun } from '../types';
import { useNavigate } from 'react-router-dom';

interface TimelineProps {
  runs: CheckupRun[];
  activeRunId?: string;
  onSelect?: (run: CheckupRun) => void;
}

export function Timeline({ runs, activeRunId, onSelect }: TimelineProps) {
  const navigate = useNavigate();

  if (runs.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>暂无体检记录</p>
        <p className="text-sm mt-1">上传样本后运行首次体检</p>
      </div>
    );
  }

  const getStatusIcon = (status: CheckupRun['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-accent-emerald-500" />;
      case 'running':
        return <Clock className="w-4 h-4 text-accent-amber-500 animate-pulse" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-accent-rose-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: CheckupRun['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-accent-emerald-500';
      case 'running':
        return 'bg-accent-amber-500';
      case 'failed':
        return 'bg-accent-rose-500';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-200 via-slate-200 to-slate-100" />
      <div className="space-y-4">
        {runs.map((run, index) => (
          <motion.div
            key={run.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            onClick={() => {
              if (onSelect) onSelect(run);
              navigate(`/checkup/${run.id}`);
            }}
            className={cn(
              "relative pl-14 cursor-pointer group",
              activeRunId === run.id && "z-10"
            )}
          >
            <div className={cn(
              "absolute left-3 w-5 h-5 rounded-full border-4 border-white shadow-md",
              getStatusColor(run.status),
              activeRunId === run.id && "ring-4 ring-primary-100"
            )} />

            <div className={cn(
              "card p-4 transition-all duration-200",
              activeRunId === run.id
                ? "border-primary-300 bg-primary-50/50 shadow-md"
                : "hover:border-primary-200 hover:shadow-card-hover"
            )}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(run.status)}
                    <h4 className="font-semibold text-slate-800 truncate">{run.name}</h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{formatRelativeTime(run.startedAt)}</span>
                    <span className="text-slate-300">|</span>
                    <span>准确率 {(run.metrics.accuracy * 100).toFixed(1)}%</span>
                    <span className="text-slate-300">|</span>
                    <span>{run.metrics.totalSamples} 条样本</span>
                    {run.metrics.conflictCount > 0 && (
                      <>
                        <span className="text-slate-300">|</span>
                        <span className="text-accent-rose-500 font-medium">
                          {run.metrics.conflictCount} 处冲突
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatDateTime(run.startedAt)} · {run.createdBy}
                  </p>
                </div>
                <ChevronRight className={cn(
                  "w-5 h-5 text-slate-400 flex-shrink-0 transition-transform",
                  "group-hover:text-primary-500 group-hover:translate-x-1"
                )} />
              </div>

              {activeRunId === run.id && (
                <div className="mt-3 pt-3 border-t border-primary-200 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-xl font-bold text-primary-600">
                      {(run.metrics.accuracy * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-slate-500">准确率</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-accent-emerald-600">
                      {(run.metrics.precision * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-slate-500">精确率</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-accent-amber-600">
                      {(run.metrics.recall * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-slate-500">召回率</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-primary-700">
                      {(run.metrics.f1 * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-slate-500">F1</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
