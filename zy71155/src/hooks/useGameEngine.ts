import { useEffect, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { useHistoryStore } from '../store/historyStore';
import { snapToGrid, getCommodityAABB } from '../utils/rules/collision';
import { getCommodityById } from '../data/commodities';
import type { CommodityInstance } from '../types/game';

export const useGameEngine = () => {
  const {
    status,
    currentLevel,
    currentLevelId,
    placedItems,
    pendingCommodities,
    selectedCommodity,
    selectedBoxType,
    violations,
    settlementResult,
    timeElapsed,
    score,
    operationStack,
    currentStackIndex,
    isPaused,
    toasts,
    unlockedLevels,
    levelScores,
    totalCommodities,
    startLevel,
    selectCommodity,
    placeItem,
    removeItem,
    undo,
    redo,
    pause,
    resume,
    restart,
    submit,
    reset,
    updateTime,
    canUndo,
    canRedo,
    canSubmit,
    validatePlacement,
    loadProgress,
    addToast,
    removeToast,
  } = useGameStore();
  
  const addHistoryRecord = useHistoryStore(state => state.addRecord);
  
  useEffect(() => {
    loadProgress();
  }, [loadProgress]);
  
  useEffect(() => {
    if (status !== 'playing' || isPaused) return;
    
    const interval = setInterval(() => {
      updateTime(1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [status, isPaused, updateTime]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== 'playing' || isPaused) return;
      
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undo();
      } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') {
        selectCommodity(null);
      } else if (e.key === ' ') {
        e.preventDefault();
        if (isPaused) {
          resume();
        } else {
          pause();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, isPaused, undo, redo, selectCommodity, pause, resume]);
  
  const handleSubmit = useCallback(() => {
    if (!canSubmit()) return;
    
    submit();
    
    setTimeout(() => {
      const state = useGameStore.getState();
      if (state.settlementResult && currentLevel && currentLevelId) {
        addHistoryRecord({
          levelId: currentLevelId,
          levelName: currentLevel.name,
          score: state.settlementResult.score,
          grade: state.settlementResult.grade,
          timeUsed: state.timeElapsed,
          placements: state.placedItems,
          violations: state.settlementResult.violations,
          settlementResult: state.settlementResult,
          operationStack: state.operationStack,
          totalCommodities: state.totalCommodities,
        });
      }
    }, 100);
  }, [canSubmit, submit, addHistoryRecord, currentLevel, currentLevelId]);
  
  const handleCanvasClick = useCallback((gridX: number, gridY: number, layer: number) => {
    if (status !== 'playing' || isPaused) return;
    if (!selectedCommodity || !selectedBoxType) return;
    
    const snapped = snapToGrid(gridX, gridY);
    placeItem(selectedCommodity.instanceId, snapped.x, snapped.y, layer);
  }, [status, isPaused, selectedCommodity, selectedBoxType, placeItem]);
  
  const handleCanvasRightClick = useCallback((gridX: number, gridY: number) => {
    if (status !== 'playing' || isPaused) return;
    if (!selectedBoxType) return;
    
    for (const item of placedItems) {
      const commodity = getCommodityById(item.commodityId);
      if (!commodity) continue;
      
      const aabb = getCommodityAABB(item, commodity);
      
      if (
        gridX >= aabb.x &&
        gridX < aabb.x + aabb.width &&
        gridY >= aabb.y &&
        gridY < aabb.y + aabb.height
      ) {
        removeItem(item.instanceId);
        return;
      }
    }
  }, [status, isPaused, placedItems, selectedBoxType, removeItem]);
  
  return {
    status,
    currentLevel,
    currentLevelId,
    placedItems,
    pendingCommodities,
    selectedCommodity: selectedCommodity as CommodityInstance | null,
    selectedBoxType,
    violations,
    settlementResult,
    timeElapsed,
    score,
    operationStack,
    currentStackIndex,
    isPaused,
    toasts,
    unlockedLevels,
    levelScores,
    totalCommodities,
    startLevel,
    selectCommodity,
    placeItem,
    removeItem,
    undo,
    redo,
    pause,
    resume,
    restart,
    submit: handleSubmit,
    reset,
    updateTime,
    canUndo,
    canRedo,
    canSubmit,
    validatePlacement,
    addToast,
    removeToast,
    handleCanvasClick,
    handleCanvasRightClick,
  };
};
