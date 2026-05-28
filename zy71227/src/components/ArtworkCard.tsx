import { useState } from 'react';
import { AlertTriangle, Edit3, Check } from 'lucide-react';
import type { Artwork } from '../types';
import { genreLabels } from '../data/mockData';

interface ArtworkCardProps {
  artwork: Artwork;
  onUpdate?: (id: string, updates: Partial<Artwork>) => void;
  onResolveConflict?: (id: string, conflictIndex: number) => void;
  draggable?: boolean;
}

export function ArtworkCard({ artwork, onUpdate, onResolveConflict, draggable = true }: ArtworkCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(artwork.estimatedValue);

  const handleSave = () => {
    onUpdate?.(artwork.id, { estimatedValue: editValue });
    setIsEditing(false);
  };

  return (
    <div
      className={`
        relative bg-slate-800/50 rounded-xl border overflow-hidden transition-all duration-300
        ${artwork.conflictStatus === 'flagged' ? 'border-red-500 shadow-lg shadow-red-500/20' : 'border-slate-700'}
        ${artwork.conflictStatus === 'resolved' ? 'border-emerald-500' : ''}
        ${draggable ? 'cursor-grab active:cursor-grabbing hover:shadow-xl hover:shadow-amber-500/10' : ''}
        hover:border-amber-500/50
      `}
    >
      {artwork.conflictStatus === 'flagged' && (
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 animate-pulse">
            <AlertTriangle size={12} />
            冲突
          </div>
        </div>
      )}

      <div className="aspect-square overflow-hidden">
        <img
          src={artwork.imageUrl}
          alt={artwork.title}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
        />
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-serif text-lg text-amber-100">{artwork.title}</h3>
          <p className="text-sm text-slate-400">{artwork.artist}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs px-2 py-1 bg-slate-700 rounded-full text-slate-300">
            {genreLabels[artwork.genre]}
          </span>
          {artwork.tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-xs px-2 py-1 bg-amber-900/30 rounded-full text-amber-200">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editValue}
                onChange={e => setEditValue(Number(e.target.value))}
                className="w-24 px-2 py-1 bg-slate-700 rounded text-sm text-amber-100"
              />
              <button
                onClick={handleSave}
                className="p-1 bg-emerald-600 rounded hover:bg-emerald-500"
              >
                <Check size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg text-amber-400">
                ¥{artwork.estimatedValue.toLocaleString()}
              </span>
              {onUpdate && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 hover:bg-slate-700 rounded"
                >
                  <Edit3 size={14} className="text-slate-400" />
                </button>
              )}
            </div>
          )}
          <span className="text-xs text-slate-500">
            版税 {artwork.baseRoyaltyRate}%
          </span>
        </div>

        {artwork.conflictStatus === 'flagged' && artwork.conflictDetails.length > 0 && (
          <div className="mt-3 pt-3 border-t border-red-500/30 space-y-2">
            {artwork.conflictDetails.map((detail, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <AlertTriangle size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                <span className="text-red-300 flex-1">{detail}</span>
                {onResolveConflict && (
                  <button
                    onClick={() => onResolveConflict(artwork.id, idx)}
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    标记解决
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
