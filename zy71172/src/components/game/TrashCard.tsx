
import { motion } from 'framer-motion';
import { TrashItem, CATEGORY_COLORS, CATEGORY_EMOJIS, CATEGORY_NAMES } from '@/types';
import { useDraggable } from '@dnd-kit/core';
import { Scissors, Droplets, AlertTriangle } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { cn } from '@/lib/utils';

interface TrashCardProps {
  trash: TrashItem;
  isActive?: boolean;
}

export function TrashCard({ trash, isActive = false }: TrashCardProps) {
  const { levelConfig, bagBreakTrash, cleanTrash, status } = useGameStore();
  const categoryColor = CATEGORY_COLORS[trash.category];

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: trash.id,
    disabled: status !== 'playing',
    data: { trash },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 1000 : 1,
  } : undefined;

  const showBagBreak = levelConfig?.hasBagBreakMechanic && trash.requiresBagBreak && !trash.isBagBroken;
  const showClean = levelConfig?.hasContaminationMechanic && trash.isContaminated && !trash.isCleaned;

  const handleBagBreak = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === 'playing') {
      bagBreakTrash(trash.id);
    }
  };

  const handleClean = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === 'playing') {
      cleanTrash(trash.id);
    }
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'relative w-32 h-40 rounded-xl shadow-lg cursor-grab active:cursor-grabbing',
        'bg-white border-2 transition-all duration-200',
        isDragging && 'opacity-50 scale-105',
        isActive && 'ring-4 ring-yellow-400 ring-opacity-50',
        trash.isBagBroken && 'border-amber-500',
        trash.isCleaned && 'border-cyan-500'
      )}
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      exit={{ scale: 0, rotate: 10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Status Indicators */}
      <div className="absolute -top-2 -right-2 flex gap-1">
        {trash.isBagBroken && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs shadow-md"
            title="已破袋"
          >
            ✓
          </motion.span>
        )}
        {trash.isCleaned && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs shadow-md"
            title="已清洁"
          >
            ✓
          </motion.span>
        )}
      </div>

      {/* Emoji Display */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ borderColor: categoryColor }}
      >
        <span className="text-5xl mb-2">{trash.emoji}</span>
        <span className="text-sm font-medium text-gray-700 px-2 text-center">
          {trash.name}
        </span>
        <span
          className="text-xs mt-1 px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: categoryColor }}
        >
          {CATEGORY_EMOJIS[trash.category]} {CATEGORY_NAMES[trash.category]}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {showBagBreak && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={handleBagBreak}
            className="w-8 h-8 bg-amber-500 hover:bg-amber-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
            title="破袋"
          >
            <Scissors size={16} />
          </motion.button>
        )}
        {showClean && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={handleClean}
            className="w-8 h-8 bg-cyan-500 hover:bg-cyan-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
            title="清洁"
          >
            <Droplets size={16} />
          </motion.button>
        )}
      </div>

      {/* Warning Indicators */}
      <div className="absolute -top-2 -left-2 flex gap-1">
        {trash.isContaminated && !trash.isCleaned && (
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs shadow-md"
            title="已污染"
          >
            <AlertTriangle size={14} />
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}

export default TrashCard;
