import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, RotateCcw, Clock } from 'lucide-react';
import { Batch, BatchRun, BatchStatus, useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

interface BatchListProps {
  batches: Batch[];
  runs: BatchRun[];
}

const statusConfig: Record<BatchStatus, { label: string; dotColor: string; bgColor: string; textColor: string }> = {
  pending: {
    label: '待处理',
    dotColor: 'bg-concrete-gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-concrete-gray',
  },
  running: {
    label: '进行中',
    dotColor: 'bg-engineering-blue',
    bgColor: 'bg-blue-50',
    textColor: 'text-engineering-blue',
  },
  reviewed: {
    label: '已复核',
    dotColor: 'bg-pass-green',
    bgColor: 'bg-green-50',
    textColor: 'text-pass-green',
  },
  abnormal: {
    label: '异常',
    dotColor: 'bg-warning-orange',
    bgColor: 'bg-orange-50',
    textColor: 'text-warning-orange',
  },
};

export default function BatchList({ batches, runs }: BatchListProps) {
  const navigate = useNavigate();
  const rerunBatch = useAppStore((state) => state.rerunBatch);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showRerunInput, setShowRerunInput] = useState<string | null>(null);
  const [rerunRemark, setRerunRemark] = useState('');

  const getBatchRuns = (batchId: string) => {
    return runs.filter((r) => r.batchId === batchId);
  };

  const handleEnterWorkbench = (batchId: string) => {
    navigate('/tracker', { state: { batchId } });
  };

  const handleRerun = (batchId: string) => {
    if (showRerunInput === batchId) {
      if (rerunRemark.trim()) {
        rerunBatch(batchId, rerunRemark.trim());
        setRerunRemark('');
        setShowRerunInput(null);
      }
    } else {
      setShowRerunInput(batchId);
    }
  };

  const cancelRerun = () => {
    setShowRerunInput(null);
    setRerunRemark('');
  };

  if (batches.length === 0) {
    return (
      <div className="bg-white rounded-xl card-shadow p-10">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-4">
            <Clock className="w-7 h-7 text-concrete-gray" strokeWidth={1.5} />
          </div>
          <h4 className="text-base font-medium text-roof-slate mb-1.5">暂无批次记录</h4>
          <p className="text-sm text-concrete-gray">加载样例包后，批次将在此处显示</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {batches.map((batch) => {
        const config = statusConfig[batch.status];
        const batchRuns = getBatchRuns(batch.id);
        const latestRun = batchRuns[0];
        const isHovered = hoveredId === batch.id;
        const isRerunMode = showRerunInput === batch.id;

        return (
          <div
            key={batch.id}
            className="bg-white rounded-xl card-shadow transition-all duration-300 overflow-hidden group"
            onMouseEnter={() => setHoveredId(batch.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="p-4.5">
              <div className="flex items-start justify-between gap-3 mb-2.5" style={{ padding: '18px 18px 0 18px' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-[15px] font-semibold text-roof-slate truncate">{batch.name}</h3>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
                        config.bgColor,
                        config.textColor
                      )}
                    >
                      <span className={cn('pulse-dot', config.dotColor)} />
                      {config.label}
                    </span>
                  </div>
                  <p className="text-xs text-concrete-gray leading-relaxed line-clamp-1">{batch.description}</p>
                </div>
              </div>

              <div className="px-[18px] pt-3">
                <div className="flex items-center justify-between text-xs text-concrete-gray mb-3">
                  <span>创建于 {batch.createdAt.slice(5, 16)}</span>
                  <span>更新 {batch.updatedAt.slice(5, 16)}</span>
                </div>

                <div
                  className={cn(
                    'overflow-hidden transition-all duration-300 ease-in-out',
                    isHovered || isRerunMode ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                  )}
                >
                  <div className="py-3 border-t border-gray-100 flex items-center gap-6 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-concrete-gray">执行次数</span>
                      <span className="font-mono font-semibold text-engineering-blue text-sm">{batch.runCount}</span>
                      <span className="text-xs text-gray-300">次</span>
                    </div>
                    {latestRun && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-concrete-gray">最新执行</span>
                        <span className="text-xs font-medium text-roof-slate">{latestRun.runAt.slice(5, 16)}</span>
                      </div>
                    )}
                    {latestRun && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-concrete-gray">版本</span>
                        <span className="font-mono text-xs font-medium text-roof-slate">{latestRun.version}</span>
                      </div>
                    )}
                  </div>
                </div>

                {isRerunMode && (
                  <div className="mb-4 bg-orange-50/50 rounded-lg p-3 border border-orange-100">
                    <p className="text-xs text-warning-orange mb-2 font-medium">请输入补备注说明：</p>
                    <input
                      type="text"
                      value={rerunRemark}
                      onChange={(e) => setRerunRemark(e.target.value)}
                      placeholder="例：调整雨水斗间距参数后重新校验"
                      className="w-full px-3 py-2 text-sm border border-orange-200 rounded-md bg-white outline-none focus:ring-2 focus:ring-warning-orange/30 focus:border-warning-orange transition-all placeholder:text-gray-400"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-2.5">
                      <button
                        onClick={cancelRerun}
                        className="px-3 py-1.5 text-xs text-concrete-gray hover:text-roof-slate transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleRerun(batch.id)}
                        disabled={!rerunRemark.trim()}
                        className={cn(
                          'px-3.5 py-1.5 text-xs rounded-md font-medium transition-all',
                          rerunRemark.trim()
                            ? 'bg-warning-orange text-white hover:bg-warning-orange/90'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        )}
                      >
                        确认补跑
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2.5 pb-[18px]">
                  <button
                    onClick={() => handleEnterWorkbench(batch.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-engineering-blue text-white text-sm font-medium rounded-lg hover:bg-engineering-blue/90 transition-all duration-200 shadow-sm"
                  >
                    <ArrowRight className="w-4 h-4" strokeWidth={2} />
                    进入工作台
                  </button>
                  <button
                    onClick={() => handleRerun(batch.id)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all duration-200',
                      isRerunMode
                        ? 'border-warning-orange bg-warning-orange/10 text-warning-orange'
                        : 'border-gray-200 bg-white text-roof-slate hover:border-warning-orange/40 hover:text-warning-orange hover:bg-orange-50'
                    )}
                  >
                    <RotateCcw className={cn('w-4 h-4', isRerunMode && 'animate-spin')} strokeWidth={2} />
                    补备注重跑
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
