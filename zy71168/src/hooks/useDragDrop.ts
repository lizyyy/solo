import { useState, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';
import { getChemicalById } from '../data/chemicals';
import { validatePlacement } from '../engine/rulesEngine';

interface DragState {
  isDragging: boolean;
  chemicalId: string | null;
}

export const useDragDrop = () => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    chemicalId: null
  });

  const grid = useGameStore(state => state.grid);
  const placeChemical = useGameStore(state => state.placeChemical);
  const highlightCell = useGameStore(state => state.highlightCell);
  const clearHighlights = useGameStore(state => state.clearHighlights);
  const status = useGameStore(state => state.status);
  const isPaused = useGameStore(state => state.isPaused);

  const handleDragStart = useCallback((chemicalId: string) => {
    if (status !== 'playing' || isPaused) return;
    setDragState({ isDragging: true, chemicalId });
  }, [status, isPaused]);

  const handleDragEnd = useCallback(() => {
    setDragState({ isDragging: false, chemicalId: null });
    clearHighlights();
  }, [clearHighlights]);

  const handleDragOver = useCallback((row: number, col: number) => {
    if (!dragState.isDragging || !dragState.chemicalId) return;
    if (status !== 'playing' || isPaused) return;

    const chemical = getChemicalById(dragState.chemicalId);
    if (!chemical) return;

    const validation = validatePlacement(grid, chemical, { row, col });
    const hasSevereViolation = validation.violations.some(v => v.type === 'severe');
    
    if (hasSevereViolation) {
      highlightCell(row, col, 'invalid');
    } else if (validation.violations.length > 0) {
      highlightCell(row, col, 'isolation');
    } else {
      highlightCell(row, col, 'valid');
    }
  }, [dragState.isDragging, dragState.chemicalId, grid, status, isPaused, highlightCell]);

  const handleDragLeave = useCallback(() => {
    clearHighlights();
  }, [clearHighlights]);

  const handleDrop = useCallback((row: number, col: number) => {
    if (!dragState.chemicalId) return;
    if (status !== 'playing' || isPaused) return;

    const chemicalId = dragState.chemicalId;
    handleDragEnd();
    
    placeChemical(chemicalId, row, col);
  }, [dragState.chemicalId, status, isPaused, handleDragEnd, placeChemical]);

  return {
    isDragging: dragState.isDragging,
    draggingChemicalId: dragState.chemicalId,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop
  };
};
