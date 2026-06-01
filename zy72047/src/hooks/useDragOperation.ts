import { useCallback, useRef } from 'react';
import type { DraggableAttributes } from '@dnd-kit/core';
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { useGameStore } from '@/store/useGameStore';
import type { VinylElement } from '@/types/game';

export const useDragOperation = () => {
  const processDrag = useGameStore(state => state.processDrag);
  const currentLevel = useGameStore(state => state.currentLevel);
  const isPaused = useGameStore(state => state.isPaused);
  const currentRound = useGameStore(state => state.currentRound);
  const error = useGameStore(state => state.error);
  const clearError = useGameStore(state => state.clearError);

  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleDragStart = useCallback((element: VinylElement) => {
    if (isPaused || !currentRound) {
      return false;
    }
    dragStartPos.current = { x: element.position.x, y: element.position.y };
    return true;
  }, [isPaused, currentRound]);

  const handleDragEnd = useCallback((
    element: VinylElement,
    position: { x: number; y: number },
    note: string = ''
  ) => {
    if (!currentLevel || !currentRound) return null;

    const operation = processDrag(
      element.id,
      element.label,
      position,
      note,
      '黑胶节拍修复赛'
    );

    dragStartPos.current = null;
    return operation;
  }, [currentLevel, currentRound, processDrag]);

  const handleDragCancel = useCallback(() => {
    dragStartPos.current = null;
  }, []);

  const getElementEffect = useCallback((elementId: string) => {
    if (!currentLevel) return null;
    return currentLevel.rules.dragEffects[elementId] || null;
  }, [currentLevel]);

  const canDrag = useCallback((element: VinylElement) => {
    if (!currentRound || isPaused) return false;
    if (element.type !== 'drag' && element.type !== 'both') return false;
    return true;
  }, [currentRound, isPaused]);

  const getDragTooltip = useCallback((element: VinylElement) => {
    const effect = getElementEffect(element.id);
    if (!effect) return element.label;

    const parts: string[] = [];
    if (effect.resource !== 0) {
      parts.push(`资源${effect.resource > 0 ? '+' : ''}${effect.resource}`);
    }
    if (effect.score !== 0) {
      parts.push(`分数${effect.score > 0 ? '+' : ''}${effect.score}`);
    }
    if (effect.risk !== 0) {
      parts.push(`风险${effect.risk > 0 ? '+' : ''}${effect.risk}`);
    }

    return `${element.label}: ${parts.join(', ')}`;
  }, [getElementEffect]);

  return {
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    getElementEffect,
    canDrag,
    getDragTooltip,
    isPaused,
    currentRound,
    error,
    clearError,
  };
};

export interface DraggableHookResult {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  setNodeRef: (node: HTMLElement | null) => void;
  transform: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
  } | null;
  isDragging: boolean;
}
