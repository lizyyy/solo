import { useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';
import { getChemicalById } from '../data/chemicals';
import { validatePlacement } from '../engine/rulesEngine';

export const useDragDrop = () => {
  const draggingChemicalId = useGameStore(state => state.draggingChemicalId);
  const setDraggingChemical = useGameStore(state => state.setDraggingChemical);
  const grid = useGameStore(state => state.grid);
  const placeChemical = useGameStore(state => state.placeChemical);
  const highlightCell = useGameStore(state => state.highlightCell);
  const clearHighlights = useGameStore(state => state.clearHighlights);
  const status = useGameStore(state => state.status);
  const isPaused = useGameStore(state => state.isPaused);

  const handleDragStart = useCallback((chemicalId: string) => {
    if (status !== 'playing' || isPaused) return;
    setDraggingChemical(chemicalId);
  }, [status, isPaused, setDraggingChemical]);

  const handleDragEnd = useCallback(() => {
    setDraggingChemical(null);
    clearHighlights();
  }, [setDraggingChemical, clearHighlights]);

  const handleDragOver = useCallback((row: number, col: number) => {
    if (!draggingChemicalId) return;
    if (status !== 'playing' || isPaused) return;

    const chemical = getChemicalById(draggingChemicalId);
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
  }, [draggingChemicalId, grid, status, isPaused, highlightCell]);

  const handleDragLeave = useCallback(() => {
    clearHighlights();
  }, [clearHighlights]);

  const handleDrop = useCallback((row: number, col: number) => {
    if (!draggingChemicalId) return;
    if (status !== 'playing' || isPaused) return;

    const chemicalId = draggingChemicalId;
    handleDragEnd();
    
    placeChemical(chemicalId, row, col);
  }, [draggingChemicalId, status, isPaused, handleDragEnd, placeChemical]);

  return {
    isDragging: !!draggingChemicalId,
    draggingChemicalId,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop
  };
};
