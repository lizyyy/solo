import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Play, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ParameterForm } from '@/components/forms/ParameterForm';
import { SampleTable } from '@/components/forms/SampleTable';
import { ValidationPanel } from '@/components/forms/ValidationPanel';
import { useBatchStore } from '@/store/useBatchStore';
import { useValidation } from '@/hooks/useValidation';
import type { Batch, SamplePoint } from '@/types';
import { cn } from '@/lib/utils';

export default function DataEntryPage() {
  const { id } = useParams<{ id: string }>();
  const currentBatch = useBatchStore((state) => state.currentBatch);
  const samplePoints = useBatchStore((state) => state.samplePoints);
  const validationErrors = useBatchStore((state) => state.validationErrors);
  const updateBatch = useBatchStore((state) => state.updateBatch);
  const addSamplePoints = useBatchStore((state) => state.addSamplePoints);
  const updateSamplePoint = useBatchStore((state) => state.updateSamplePoint);
  const deleteSamplePoint = useBatchStore((state) => state.deleteSamplePoint);
  const runFit = useBatchStore((state) => state.runFit);
  const runValidation = useBatchStore((state) => state.runValidation);
  const loading = useBatchStore((state) => state.loading);
  const setCurrentBatch = useBatchStore((state) => state.setCurrentBatch);
  const { hasErrors, criticalErrors, warnings } = useValidation(validationErrors);
  const needsReanalysis = currentBatch?.needsReanalysis ?? false;

  useEffect(() => {
    if (id) {
      setCurrentBatch(id);
    }
    return () => setCurrentBatch(null);
  }, [id, setCurrentBatch]);

  useEffect(() => {
    if (currentBatch) {
      runValidation();
    }
  }, [currentBatch, samplePoints.length, runValidation]);

  const progress = useMemo(() => {
    if (!currentBatch) return { completed: 0, total: 10, percentage: 0 };
    const paramFields = ['studentName', 'experimentDate', 'resistance', 'capacitance', 'initialVoltage', 'supplyVoltage'];
    const completedParams = paramFields.filter(f => currentBatch[f as keyof Batch] !== null && currentBatch[f as keyof Batch] !== '').length;
    const hasSamples = samplePoints.length >= 3;
    const completed = completedParams + (hasSamples ? 2 : 0);
    return {
      completed,
      total: 8,
      percentage: Math.round((completed / 8) * 100),
    };
  }, [currentBatch, samplePoints.length]);

  const handleUpdateBatch = (updates: Partial<Batch>) => {
    updateBatch(updates, true);
  };

  const handleAddPoints = (points: Omit<SamplePoint, 'id' | 'batchId' | 'sequence'>[]) => {
    const pointsWithBatchId = points.map((p) => ({
      ...p,
      batchId: currentBatch!.id,
      sequence: 0,
    }));
    addSamplePoints(pointsWithBatchId);
  };

  const handleUpdatePoint = (pointId: string, updates: Partial<SamplePoint>) => {
    updateSamplePoint(pointId, updates);
  };

  const handleDeletePoint = (pointId: string) => {
    deleteSamplePoint(pointId);
  };

  const handleStartAnalysis = () => {
    runFit();
  };

  if (!currentBatch) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">补录进度</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {progress.completed}/{progress.total} 项已完成
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {needsReanalysis && !loading && (
              <button
                onClick={handleStartAnalysis}
                disabled={hasErrors || samplePoints.length < 3}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  hasErrors || samplePoints.length < 3
                    ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                )}
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                重新分析
              </button>
            )}
            {!needsReanalysis && (
              <button
                onClick={handleStartAnalysis}
                disabled={hasErrors || samplePoints.length < 3 || loading}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm',
                  hasErrors || samplePoints.length < 3
                    ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                )}
              >
                <Play className="w-4 h-4" />
                开始分析
              </button>
            )}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                正在计算...
              </div>
            )}
          </div>
        </div>
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              progress.percentage === 100 ? 'bg-emerald-500' : 'bg-blue-500'
            )}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-3">
          {hasErrors && (
            <div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span>{criticalErrors.length} 个错误需要处理</span>
            </div>
          )}
          {!hasErrors && warnings.length > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <span>{warnings.length} 个警告</span>
            </div>
          )}
          {!hasErrors && warnings.length === 0 && progress.completed > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>数据校验通过</span>
            </div>
          )}
          {samplePoints.length > 0 && (
            <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto">
              已录入 {samplePoints.length} 个采样点
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 h-full">
            <ParameterForm batch={currentBatch} onUpdate={handleUpdateBatch} />
          </div>
        </div>

        <div className="xl:col-span-5">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 h-full">
            <SampleTable
              points={samplePoints}
              onUpdate={handleUpdatePoint}
              onDelete={handleDeletePoint}
              onAdd={handleAddPoints}
            />
          </div>
        </div>

        <div className="xl:col-span-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 h-full">
            <ValidationPanel errors={validationErrors} />
          </div>
        </div>
      </div>
    </div>
  );
}
