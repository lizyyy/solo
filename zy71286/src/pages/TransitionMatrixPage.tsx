import { useMemo } from 'react';
import { RefreshCw, Filter } from 'lucide-react';
import { useAppStore } from '@/store';
import TransitionMatrixHeatmap from '@/components/TransitionMatrixHeatmap';
import DrillDownDrawer from '@/components/DrillDownDrawer';
import StatusLegend from '@/components/StatusLegend';
import ConfirmationBadge from '@/components/ConfirmationBadge';
import { CONFIRMATION_LABELS } from '@/types';
import type { ConfirmationStatus } from '@/types';

export default function TransitionMatrixPage() {
  const {
    transitionMatrix,
    anomalies,
    selectedCell,
    drillDownRecords,
    confirmationFilter,
    windowSize,
    isLoading,
    setConfirmationFilter,
    setWindowSize,
    setSelectedCell,
    updateRecordConfirmation,
    recalculateMatrix,
  } = useAppStore();

  const totalTransitions = useMemo(() => {
    if (!transitionMatrix) return 0;
    return transitionMatrix.sampleCounts.flat().reduce((a, b) => a + b, 0);
  }, [transitionMatrix]);

  const unresolvedAnomalies = useMemo(
    () => anomalies.filter(a => !a.isResolved).length,
    [anomalies]
  );

  const filterOptions: (ConfirmationStatus | 'ALL')[] = ['ALL', 'CONFIRMED', 'TEMPORARY'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="section-title">转移概率矩阵</h2>
          <p className="section-subtitle">
            基于历史周度数据计算商品状态间的转移概率，点击单元格可钻取原始记录
          </p>
        </div>
        <button
          onClick={recalculateMatrix}
          disabled={isLoading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          重新计算
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="stat-value">{totalTransitions.toLocaleString()}</div>
          <div className="stat-label">总状态转移数</div>
        </div>
        <div className="card p-4">
          <div className="stat-value">{transitionMatrix?.states.length || 0}</div>
          <div className="stat-label">商品状态数</div>
        </div>
        <div className="card p-4">
          <div className="stat-value">{windowSize}</div>
          <div className="stat-label">滑动窗口 (周)</div>
        </div>
        <div className="card p-4">
          <div className="stat-value text-danger-500">{unresolvedAnomalies}</div>
          <div className="stat-label">待处理异常</div>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white rounded-xl shadow-card p-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-navy-500" />
            <span className="text-sm text-navy-600">数据筛选：</span>
            <div className="flex items-center gap-2">
              {filterOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => setConfirmationFilter(opt)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    confirmationFilter === opt
                      ? 'bg-navy-800 text-white'
                      : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
                  }`}
                >
                  {CONFIRMATION_LABELS[opt]}
                </button>
              ))}
            </div>
          </div>

          <div className="h-8 w-px bg-navy-200" />

          <div className="flex items-center gap-3">
            <span className="text-sm text-navy-600">时间窗口：</span>
            <select
              value={windowSize}
              onChange={e => setWindowSize(Number(e.target.value))}
              className="select-field w-auto"
            >
              <option value={1}>1 周</option>
              <option value={2}>2 周</option>
              <option value={4}>4 周</option>
              <option value={8}>8 周</option>
            </select>
          </div>
        </div>

        <StatusLegend />
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-navy-900">
              状态转移概率热力图
            </h3>
            <p className="text-sm text-navy-500 mt-0.5">
              单元格显示：转移概率% (样本量n)，⚠️ 表示存在异常
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ConfirmationBadge status="CONFIRMED" />
            <span className="text-xs text-navy-500">+</span>
            <ConfirmationBadge status="TEMPORARY" />
            <span className="text-xs text-navy-500">数据</span>
          </div>
        </div>
        <div className="card-body">
          <TransitionMatrixHeatmap
            matrix={transitionMatrix}
            anomalies={anomalies}
            selectedCell={selectedCell}
            onCellClick={(from, to) => setSelectedCell({ from, to })}
          />
        </div>
      </div>

      <DrillDownDrawer
        isOpen={!!selectedCell}
        onClose={() => setSelectedCell(null)}
        fromStatus={selectedCell?.from || 'NEW'}
        toStatus={selectedCell?.to || 'NEW'}
        records={drillDownRecords}
        onUpdateConfirmation={updateRecordConfirmation}
      />
    </div>
  );
}
