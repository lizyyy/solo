import React from 'react';
import { motion } from 'framer-motion';
import { GridCell } from './GridCell';
import { useGameStore } from '../../store/useGameStore';
import { useDragDrop } from '../../hooks/useDragDrop';
import { GRID_COLS } from '../../types';

interface ShelfProps {
  isReplaying?: boolean;
}

export const Shelf: React.FC<ShelfProps> = ({ isReplaying = false }) => {
  const grid = useGameStore(state => state.grid);
  const removeChemical = useGameStore(state => state.removeChemical);
  const isPaused = useGameStore(state => state.isPaused);
  const status = useGameStore(state => state.status);

  const {
    handleDragOver,
    handleDragLeave,
    handleDrop
  } = useDragDrop();

  const handleCellClick = (row: number, col: number) => {
    if (isReplaying || isPaused || status !== 'playing') return;
    const cell = grid[row][col];
    if (cell.chemicalId) {
      removeChemical(row, col);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-slate-900/50 rounded-2xl border border-slate-700"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-200">仓储货架</h3>
        <div className="text-xs text-slate-400">
          点击已摆放的化学品可移除
        </div>
      </div>

      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <GridCell
              key={`${rowIndex}-${colIndex}`}
              cell={cell}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleCellClick}
              isReplaying={isReplaying}
            />
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-slate-700 border border-slate-500" />
          <span className="text-slate-400">普通区</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-900/50 border border-red-500/50" />
          <span className="text-slate-400">防爆柜</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-cyan-900/50 border border-cyan-500/50" />
          <span className="text-slate-400">冷藏区</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-900/50 border border-purple-500/50" />
          <span className="text-slate-400">毒害区</span>
        </div>
      </div>
    </motion.div>
  );
};
