import React from 'react';
import { motion } from 'framer-motion';
import { GridCell as GridCellType, HAZARD_CATEGORY_COLORS, ZONE_LABELS } from '../../types';
import { getChemicalById } from '../../data/chemicals';
import { cn } from '../../lib/utils';

interface GridCellProps {
  cell: GridCellType;
  onDragOver: (row: number, col: number) => void;
  onDragLeave: () => void;
  onDrop: (row: number, col: number) => void;
  onClick: (row: number, col: number) => void;
  isReplaying?: boolean;
}

const zoneColors: Record<string, string> = {
  normal: 'bg-slate-800/50 border-slate-600',
  explosion_proof: 'bg-red-900/30 border-red-500/50',
  refrigerated: 'bg-cyan-900/30 border-cyan-500/50',
  toxic: 'bg-purple-900/30 border-purple-500/50'
};

const highlightColors: Record<string, string> = {
  valid: 'ring-2 ring-green-400 bg-green-900/30',
  invalid: 'ring-2 ring-red-500 bg-red-900/50 animate-pulse',
  isolation: 'ring-2 ring-yellow-400 bg-yellow-900/30'
};

export const GridCell: React.FC<GridCellProps> = ({
  cell,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  isReplaying = false
}) => {
  const chemical = cell.chemicalId ? getChemicalById(cell.chemicalId) : null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver(cell.row, cell.col);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop(cell.row, cell.col);
  };

  return (
    <motion.div
      layout
      className={cn(
        'relative w-full aspect-square rounded-lg border-2 flex flex-col items-center justify-center',
        'transition-all duration-200 cursor-pointer',
        'hover:brightness-110 active:scale-95',
        zoneColors[cell.zoneType],
        cell.isHighlighted && cell.highlightType && highlightColors[cell.highlightType]
      )}
      onDragOver={handleDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      onClick={() => !isReplaying && onClick(cell.row, cell.col)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {cell.zoneType !== 'normal' && !chemical && (
        <span className="text-[10px] text-slate-400 font-mono">
          {ZONE_LABELS[cell.zoneType]}
        </span>
      )}

      {chemical && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center justify-center w-full h-full p-1"
          style={{
            backgroundColor: `${HAZARD_CATEGORY_COLORS[chemical.category]}20`
          }}
        >
          <span className="text-2xl mb-1">{chemical.icon}</span>
          <span className="text-[10px] font-medium text-slate-200 text-center leading-tight truncate w-full">
            {chemical.name}
          </span>
          <div
            className="w-2 h-2 rounded-full mt-1"
            style={{ backgroundColor: HAZARD_CATEGORY_COLORS[chemical.category] }}
          />
        </motion.div>
      )}

      <div className="absolute bottom-1 right-1 text-[8px] text-slate-500 font-mono">
        {cell.row},{cell.col}
      </div>
    </motion.div>
  );
};
