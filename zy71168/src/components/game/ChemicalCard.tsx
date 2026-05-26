import React from 'react';
import { Chemical, HAZARD_CATEGORY_LABELS, HAZARD_CATEGORY_COLORS } from '../../types';
import { Info } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ChemicalCardProps {
  chemical: Chemical;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  isDragging?: boolean;
  compact?: boolean;
}

export const ChemicalCard: React.FC<ChemicalCardProps> = ({
  chemical,
  onDragStart,
  onDragEnd,
  isDragging = false,
  compact = false
}) => {
  const categoryColor = HAZARD_CATEGORY_COLORS[chemical.category];

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(chemical.id);
  };

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 p-2 rounded-lg border',
          'bg-slate-800/50 border-slate-600',
          'cursor-grab active:cursor-grabbing',
          isDragging && 'opacity-50',
          'hover:scale-[1.02] active:scale-[0.98] transition-transform'
        )}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
      >
        <span className="text-xl">{chemical.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-200 truncate">
            {chemical.name}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            {chemical.formula}
          </div>
        </div>
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: categoryColor }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative p-3 rounded-xl border-2 bg-slate-800/70',
        'cursor-grab active:cursor-grabbing select-none',
        'transition-all duration-200',
        isDragging ? 'opacity-50 scale-95' : 'hover:scale-105 hover:shadow-lg',
        'border-slate-600'
      )}
      style={{
        borderLeftColor: categoryColor,
        borderLeftWidth: '4px'
      }}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-3xl">{chemical.icon}</span>
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-1.5 h-3 rounded-sm',
                i < chemical.hazardLevel ? 'bg-red-500' : 'bg-slate-600'
              )}
            />
          ))}
        </div>
      </div>

      <h4 className="font-bold text-slate-100 mb-1">{chemical.name}</h4>
      <p className="text-xs font-mono text-slate-400 mb-2">{chemical.formula}</p>

      <div className="flex items-center gap-2 mb-2">
        <span
          className="px-2 py-0.5 rounded text-[10px] font-medium"
          style={{
            backgroundColor: `${categoryColor}30`,
            color: categoryColor
          }}
        >
          {HAZARD_CATEGORY_LABELS[chemical.category]}
        </span>
      </div>

      <div className="space-y-1 text-[10px] text-slate-400">
        <div className="flex items-center gap-1">
          <Info className="w-3 h-3" />
          <span>
            温度: {chemical.storageRequirements.minTemp}~{chemical.storageRequirements.maxTemp}°C
          </span>
        </div>
        {chemical.storageRequirements.isolationDistance > 0 && (
          <div>隔离: {chemical.storageRequirements.isolationDistance}格</div>
        )}
        {chemical.specialZones && (
          <div className="text-yellow-400">
            需存放在: {chemical.specialZones.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
};
