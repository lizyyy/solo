
import React from 'react';
import { motion } from 'framer-motion';
import { Search, Pickaxe, HelpCircle, Check, X } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { MineCell } from '../../types';

interface MineGridProps {
  onCellClick: (cell: MineCell) => void;
}

export const MineGrid: React.FC<MineGridProps> = ({ onCellClick }) => {
  const { mineGrid, selectedCell } = useGameStore();

  const getCellStatusColor = (cell: MineCell) => {
    switch (cell.status) {
      case 'unknown':
        return 'bg-slate-700 hover:bg-slate-600 border-slate-600';
      case 'scanned':
        if (cell.isCorrect === true) {
          return 'bg-green-900/50 border-green-500';
        } else if (cell.isCorrect === false) {
          return 'bg-red-900/50 border-red-500';
        }
        return 'bg-cyan-900/30 border-cyan-500';
      case 'mined':
        return 'bg-amber-900/30 border-amber-600';
      default:
        return 'bg-slate-700 border-slate-600';
    }
  };

  const getCellIcon = (cell: MineCell) => {
    switch (cell.status) {
      case 'unknown':
        return <HelpCircle className="w-6 h-6 text-slate-500" />;
      case 'scanned':
        if (cell.isCorrect === true) {
          return <Check className="w-6 h-6 text-green-400" />;
        } else if (cell.isCorrect === false) {
          return <X className="w-6 h-6 text-red-400" />;
        }
        return <Search className="w-6 h-6 text-cyan-400" />;
      case 'mined':
        return <Pickaxe className="w-6 h-6 text-amber-400" />;
      default:
        return null;
    }
  };

  const getMineralColor = (cell: MineCell) => {
    if (cell.mineral) {
      return cell.mineral.color;
    }
    return '#475569';
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4 shadow-xl">
      <h3 className="text-slate-200 font-semibold mb-3 flex items-center gap-2">
        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
        矿区地图
      </h3>

      <div className="grid grid-cols-6 gap-2">
        {mineGrid.map((row, y) =>
          row.map((cell) => (
            <motion.button
              key={cell.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onCellClick(cell)}
              className={`
                relative aspect-square rounded-lg border-2 flex flex-col items-center justify-center
                transition-all duration-200 cursor-pointer
                ${getCellStatusColor(cell)}
                ${selectedCell === cell.id ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900' : ''}
                ${cell.status === 'mined' ? 'opacity-60' : ''}
              `}
            >
              {cell.status === 'scanned' && cell.mineral && (
                <div
                  className="absolute top-1 left-1 w-3 h-3 rounded-full"
                  style={{ backgroundColor: getMineralColor(cell) }}
                  title={cell.mineral.nameCn}
                />
              )}

              {getCellIcon(cell)}

              <span className="text-xs text-slate-400 mt-1">
                {cell.x + 1},{cell.y + 1}
              </span>

              {cell.status === 'mined' && cell.minedQuantity > 0 && (
                <span className="absolute bottom-1 right-1 text-xs text-amber-300 font-mono">
                  {cell.minedQuantity}
                </span>
              )}
            </motion.button>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-slate-700 rounded border border-slate-600" />
          <span>未探测</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-cyan-900/50 rounded border border-cyan-500" />
          <span>已扫描</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-900/50 rounded border border-green-500" />
          <span>识别正确</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-900/50 rounded border border-red-500" />
          <span>识别错误</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-amber-900/50 rounded border border-amber-600" />
          <span>已开采</span>
        </div>
      </div>
    </div>
  );
};
