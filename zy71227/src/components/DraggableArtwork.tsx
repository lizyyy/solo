import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle } from 'lucide-react';
import type { Artwork } from '../types';

interface DraggableArtworkProps {
  artwork: Artwork;
}

export function DraggableArtwork({ artwork }: DraggableArtworkProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: artwork.id,
    data: {
      type: 'artwork',
      artwork
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border transition-all duration-200
        ${isDragging ? 'border-amber-400 shadow-lg shadow-amber-500/30 scale-105' : 'border-slate-700 cursor-grab active:cursor-grabbing hover:border-amber-500/50'}
      `}
    >
      <img 
        src={artwork.imageUrl} 
        alt={artwork.title} 
        className="w-12 h-12 rounded object-cover" 
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-amber-100 text-sm truncate">{artwork.title}</div>
        <div className="text-xs text-slate-500">¥{artwork.estimatedValue.toLocaleString()}</div>
      </div>
      {artwork.conflictStatus === 'flagged' && (
        <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
      )}
    </div>
  );
}
