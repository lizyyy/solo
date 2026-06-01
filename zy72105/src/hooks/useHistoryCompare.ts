import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { compareBatches, compareResults as compareResultsUtil, compareNoteImpact } from '../utils/diffComparator';
import type { ComparisonDiff, NoisePredictionResult } from '../types';

export const useHistoryCompare = () => {
  const {
    batches,
    selectedBatchIds,
    selectBatch,
    deselectBatch,
    clearSelection,
  } = useAppStore();

  const selectedBatches = useMemo(() => {
    return batches.filter((b) => selectedBatchIds.includes(b.id));
  }, [batches, selectedBatchIds]);

  const compareSelectedBatches = useCallback((): ComparisonDiff[] => {
    if (selectedBatches.length < 2) return [];

    const [oldBatch, newBatch] = selectedBatches;
    return compareBatches(oldBatch, newBatch);
  }, [selectedBatches]);

  const compareResults = useCallback((): {
    oldResult?: NoisePredictionResult;
    newResult?: NoisePredictionResult;
    diffs: ComparisonDiff[];
  } | null => {
    if (selectedBatches.length < 2) return null;

    const [oldBatch, newBatch] = selectedBatches;
    if (!oldBatch.result || !newBatch.result) return null;

    return {
      oldResult: oldBatch.result,
      newResult: newBatch.result,
      diffs: compareResultsUtil(oldBatch.result, newBatch.result),
    };
  }, [selectedBatches]);

  const checkNoteImpact = useCallback(
    (batchId: string, noteIndex: number) => {
      const batch = batches.find((b) => b.id === batchId);
      if (!batch || !batch.result) return null;

      const note = batch.notes[noteIndex];
      if (!note) return null;

      return compareNoteImpact(note.previousResultSnapshot, batch.result);
    },
    [batches]
  );

  const toggleBatchSelection = useCallback(
    (batchId: string) => {
      if (selectedBatchIds.includes(batchId)) {
        deselectBatch(batchId);
      } else {
        if (selectedBatchIds.length >= 2) {
          clearSelection();
        }
        selectBatch(batchId);
      }
    },
    [selectedBatchIds, selectBatch, deselectBatch, clearSelection]
  );

  const getBatchComparisonSummary = useCallback((): string => {
    if (selectedBatches.length < 2) return '请选择两个批次进行对比';
    if (selectedBatches.length > 2) return '最多只能对比两个批次';

    const diffs = compareSelectedBatches();
    const highDiffs = diffs.filter((d) => d.significance === 'high');
    const mediumDiffs = diffs.filter((d) => d.significance === 'medium');
    const lowDiffs = diffs.filter((d) => d.significance === 'low');

    if (diffs.length === 0) {
      return '两个批次完全一致';
    }

    return `共发现 ${diffs.length} 处差异：${highDiffs.length} 个高影响，${mediumDiffs.length} 个中影响，${lowDiffs.length} 个低影响`;
  }, [selectedBatches, compareSelectedBatches]);

  return {
    selectedBatches,
    selectedBatchIds,
    toggleBatchSelection,
    clearSelection,
    compareSelectedBatches,
    compareResults,
    checkNoteImpact,
    getBatchComparisonSummary,
  };
};
