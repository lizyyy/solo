
import { useState, useCallback } from 'react';
import { HistoryEntry, ColorParams, ActionType } from '../types';
import { generateId } from '../utils/colorMath';
import { getOperatorName } from '../utils/reportGenerator';

interface UseHistoryResult {
  history: HistoryEntry[];
  currentIndex: number;
  addHistory: (
    actionType: ActionType,
    params: ColorParams,
    previousParams?: ColorParams,
    options?: {
      note?: string;
      modificationSource?: string;
      isManualCorrection?: boolean;
    }
  ) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  revertTo: (index: number) => HistoryEntry | null;
  canUndo: boolean;
  canRedo: boolean;
  resetHistory: () => void;
  getCurrentParams: () => ColorParams | null;
}

export function useHistory(initialParams: ColorParams): UseHistoryResult {
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      id: generateId(),
      timestamp: Date.now(),
      actionType: 'reset',
      params: initialParams,
      operator: getOperatorName(),
      note: '初始状态',
      modificationSource: '系统初始化',
      isManualCorrection: false,
    },
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const addHistory = useCallback(
    (
      actionType: ActionType,
      params: ColorParams,
      previousParams?: ColorParams,
      options?: {
        note?: string;
        modificationSource?: string;
        isManualCorrection?: boolean;
      }
    ) => {
      const newEntry: HistoryEntry = {
        id: generateId(),
        timestamp: Date.now(),
        actionType,
        params: { ...params },
        previousParams: previousParams ? { ...previousParams } : undefined,
        operator: getOperatorName(),
        note: options?.note,
        modificationSource: options?.modificationSource,
        isManualCorrection: options?.isManualCorrection || false,
      };

      setHistory((prev) => {
        const newHistory = prev.slice(0, currentIndex + 1);
        newHistory.push(newEntry);
        return newHistory;
      });
      setCurrentIndex((prev) => prev + 1);
    },
    [currentIndex]
  );

  const undo = useCallback((): HistoryEntry | null => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      return history[newIndex];
    }
    return null;
  }, [currentIndex, history]);

  const redo = useCallback((): HistoryEntry | null => {
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      return history[newIndex];
    }
    return null;
  }, [currentIndex, history]);

  const revertTo = useCallback(
    (index: number): HistoryEntry | null => {
      if (index >= 0 && index < history.length) {
        setCurrentIndex(index);
        const entry = history[index];
        const revertEntry: HistoryEntry = {
          id: generateId(),
          timestamp: Date.now(),
          actionType: 'revert',
          params: { ...entry.params },
          previousParams: history[currentIndex]?.params,
          operator: getOperatorName(),
          note: `回退到步骤 ${index + 1}`,
          modificationSource: '历史回退',
          isManualCorrection: false,
        };
        setHistory((prev) => [...prev, revertEntry]);
        setCurrentIndex((prev) => prev + 1);
        return revertEntry;
      }
      return null;
    },
    [history, currentIndex]
  );

  const resetHistory = useCallback(() => {
    setHistory([
      {
        id: generateId(),
        timestamp: Date.now(),
        actionType: 'reset',
        params: initialParams,
        operator: getOperatorName(),
        note: '重置',
        modificationSource: '用户操作',
        isManualCorrection: false,
      },
    ]);
    setCurrentIndex(0);
  }, [initialParams]);

  const getCurrentParams = useCallback((): ColorParams | null => {
    return history[currentIndex]?.params || null;
  }, [history, currentIndex]);

  return {
    history,
    currentIndex,
    addHistory,
    undo,
    redo,
    revertTo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    resetHistory,
    getCurrentParams,
  };
}
