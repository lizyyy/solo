import { useDroppable } from '@dnd-kit/core';
import { Flame, X, AlertTriangle } from 'lucide-react';
import type { Booth, Artwork } from '../types';
import { heatLevelColors } from '../data/mockData';
import { Conflict } from '../types';

interface DroppableBoothProps {
  booth: Booth;
  artwork: Artwork | undefined;
  warnings: Conflict[];
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export function DroppableBooth({ booth, artwork, warnings, isSelected, onSelect, onRemove }: DroppableBoothProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: booth.id,
    data: {
      type: 'booth',
      booth
    }
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        relative rounded-xl border-2 border-dashed overflow-hidden transition-all duration-300
        ${artwork ? 'border-solid border-amber-500/50' : 'border-slate-600 hover:border-amber-500/30'}
        ${isSelected ? 'ring-2 ring-amber-400' : ''}
        ${isOver ? 'border-amber-400 bg-amber-500/10 scale-105' : ''}
      `}
      onClick={onSelect}
    >
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${heatLevelColors[booth.heatLevel]} to-transparent`} />
      
      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-black/50 rounded-full text-xs z-10">
        <Flame size={12} className={booth.heatLevel >= 4 ? 'text-orange-400' : 'text-slate-400'} />
        <span className="text-slate-300">热度 {booth.heatLevel}</span>
      </div>

      {warnings.length > 0 && (
        <div className="absolute top-2 right-2 z-10">
          <div className="p-1 bg-red-500 rounded-full animate-pulse">
            <AlertTriangle size={12} className="text-white" />
          </div>
        </div>
      )}

      {artwork ? (
        <div className="cursor-pointer">
          <img src={artwork.imageUrl} alt={artwork.title} className="w-full aspect-square object-cover" />
          <div className="p-3 bg-slate-800/90">
            <div className="font-medium text-amber-100 text-sm truncate">{artwork.title}</div>
            <div className="text-xs text-slate-400">{artwork.artist}</div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-amber-400 font-mono">¥{booth.reservePrice.toLocaleString()}</span>
              <span className="text-slate-400">{booth.royaltyRate}%</span>
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="absolute top-10 right-2 p-1 bg-red-500/80 rounded-full hover:bg-red-500 transition-colors z-10"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className={`aspect-square flex flex-col items-center justify-center bg-slate-800/30 transition-colors ${isOver ? 'text-amber-400' : 'text-slate-500'}`}>
          <div className="text-4xl mb-2">{isOver ? '✨' : '🎨'}</div>
          <div className="text-sm">{isOver ? '放置作品' : '拖放作品'}</div>
          <div className="text-xs text-slate-600">加成 x{booth.heatBonus.toFixed(1)}</div>
        </div>
      )}
    </div>
  );
}
