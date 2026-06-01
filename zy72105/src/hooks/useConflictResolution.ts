import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getValidationSummary, getHumanReadableConflictMessage } from '../utils/validator';
import { CONFLICT_TYPE_LABELS, SEVERITY_LABELS } from '../types';
import type { ConflictRecord, ResolutionType } from '../types';

export const useConflictResolution = () => {
  const { batches, currentBatchId, resolveConflict, thresholdConfig } = useAppStore();

  const currentBatch = useMemo(() => {
    return batches.find((b) => b.id === currentBatchId);
  }, [batches, currentBatchId]);

  const unresolvedConflicts = useMemo(() => {
    if (!currentBatch) return [];
    return currentBatch.conflicts.filter((c) => !c.resolution);
  }, [currentBatch]);

  const resolvedConflicts = useMemo(() => {
    if (!currentBatch) return [];
    return currentBatch.conflicts.filter((c) => c.resolution);
  }, [currentBatch]);

  const validationSummary = useMemo(() => {
    if (!currentBatch) return null;
    return getValidationSummary(currentBatch.conflicts, currentBatch.anomalies);
  }, [currentBatch]);

  const getConflictIcon = (type: string): string => {
    const icons: Record<string, string> = {
      unit_mismatch: '⚠️',
      direction_error: '↺',
      timegap_error: '⏱',
      value_conflict: '≠',
    };
    return icons[type] || '❓';
  };

  const getSeverityColor = (severity: string): string => {
    const colors: Record<string, string> = {
      warning: 'text-amber-600 bg-amber-50 border-amber-200',
      error: 'text-orange-600 bg-orange-50 border-orange-200',
      critical: 'text-red-600 bg-red-50 border-red-200',
    };
    return colors[severity] || 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getResolutionLabel = (resolution?: ResolutionType): string => {
    const labels: Record<string, string> = {
      use_sensor: '使用传感器数据',
      use_import: '使用导入数据',
      manual: '手动处理',
    };
    return resolution ? labels[resolution] || resolution : '未处理';
  };

  const resolveConflictById = useCallback(
    (conflictId: string, resolution: ResolutionType, resolvedBy: string = '老岑') => {
      if (!currentBatchId) return;
      resolveConflict(currentBatchId, conflictId, resolution, resolvedBy);
    },
    [currentBatchId, resolveConflict]
  );

  const getConflictSuggestedActions = (conflict: ConflictRecord): { label: string; action: ResolutionType }[] => {
    const baseActions: { label: string; action: ResolutionType }[] = [
      { label: '使用传感器数据', action: 'use_sensor' },
      { label: '使用导入数据', action: 'use_import' },
      { label: '手动处理', action: 'manual' },
    ];

    return baseActions;
  };

  const getConflictExplanation = (conflict: ConflictRecord): string => {
    return getHumanReadableConflictMessage(conflict);
  };

  return {
    currentBatch,
    unresolvedConflicts,
    resolvedConflicts,
    validationSummary,
    resolveConflictById,
    getConflictIcon,
    getSeverityColor,
    getResolutionLabel,
    getConflictSuggestedActions,
    getConflictExplanation,
    thresholdConfig,
  };
};
