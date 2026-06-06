import { Music, Calendar, User, ChevronRight, Image } from 'lucide-react';
import { Batch } from '@/types';
import { StatusBadge } from './StatusBadge';
import { useNavigate } from 'react-router-dom';

interface BatchCardProps {
  batch: Batch;
  index: number;
}

export const BatchCard = ({ batch, index }: BatchCardProps) => {
  const navigate = useNavigate();

  const borderColors: Record<string, string> = {
    smooth: 'border-l-4 border-l-forest-500',
    mixed_tickets: 'border-l-4 border-l-orange-500',
    old_standard: 'border-l-4 border-l-gray-500',
  };

  return (
    <div
      className={`glass-card p-5 cursor-pointer hover:bg-white/15 transition-all duration-300 hover:scale-[1.02] animate-slide-in ${borderColors[batch.sceneType] || ''}`}
      style={{ animationDelay: `${index * 0.1}s` }}
      onClick={() => navigate(`/batch/${batch.id}`)}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-gold-200 mb-1">
            {batch.name}
          </h3>
          <p className="text-xs text-white/50 font-mono">{batch.id}</p>
        </div>
        <StatusBadge status={batch.status} sceneType={batch.sceneType} size="sm" />
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Music size={16} className="text-gold-400" />
          <span>{batch.tracks.length} 首曲目</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Image size={16} className="text-gold-400" />
          <span>{batch.photos.length} 张签到照片</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Calendar size={16} className="text-gold-400" />
          <span>{batch.createdAt}</span>
        </div>
        {batch.operator && (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <User size={16} className="text-gold-400" />
            <span>{batch.operator}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <div className="flex -space-x-2">
          {batch.tracks.slice(0, 3).map((track) => (
            <div
              key={track.id}
              className="w-8 h-8 rounded-full bg-wine-800 border-2 border-wine-900 flex items-center justify-center text-[10px] text-white/80 font-medium"
              title={track.name}
            >
              {track.name.slice(0, 2)}
            </div>
          ))}
          {batch.tracks.length > 3 && (
            <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-wine-900 flex items-center justify-center text-[10px] text-white/60">
              +{batch.tracks.length - 3}
            </div>
          )}
        </div>
        <ChevronRight size={20} className="text-gold-400" />
      </div>
    </div>
  );
};
