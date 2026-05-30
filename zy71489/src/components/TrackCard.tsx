import { useState } from 'react';
import { Music, Clock, Users, Zap, ChevronDown, ChevronUp, Check } from 'lucide-react';
import type { TrackWithRelations } from '@shared/types';
import { cn } from '@/lib/utils';
import SourceInfoPanel from './SourceInfoPanel';

interface TrackCardProps {
  track: TrackWithRelations;
  onSelect: (trackId: string, selected: boolean) => void;
  disabled?: boolean;
}

export default function TrackCard({ track, onSelect, disabled = false }: TrackCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCopyrightBadge = () => {
    if (!track.copyright) {
      return <span className="badge-neutral">未登记</span>;
    }

    const status = track.copyright.status;
    switch (status) {
      case 'expired':
        return <span className="badge-red animate-pulse-red">版权过期</span>;
      case 'pending':
        return <span className="badge-orange">待审核</span>;
      case 'restricted':
        return <span className="badge-orange">受限</span>;
      case 'active':
        return <span className="badge-gold">版权有效</span>;
      default:
        return <span className="badge-neutral">未知</span>;
    }
  };

  const getSourceLabel = () => {
    return track.source.sourceType === 'manual' ? '手动录入' : 'CSV导入';
  };

  const isExpired = track.copyright?.status === 'expired';

  return (
    <div
      className={cn(
        'card-stage p-4 transition-all duration-300',
        track.isSelected && 'border-gold/50 shadow-glow',
        isExpired && !track.isSelected && 'opacity-60',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'hover:-translate-y-1 cursor-pointer'
      )}
      onClick={() => !disabled && setExpanded(!expanded)}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200',
            track.isSelected
              ? 'bg-gold border-gold'
              : 'border-neutral-600 hover:border-gold/50',
            disabled && 'cursor-not-allowed'
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) {
              onSelect(track.id, !track.isSelected);
            }
          }}
        >
          {track.isSelected && <Check size={14} className="text-neutral-900" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-serif font-semibold text-white truncate">{track.name}</h3>
                {isExpired && <span className="w-2 h-2 rounded-full bg-red animate-pulse-red shrink-0" />}
              </div>
              <p className="text-sm text-neutral-400 truncate">{track.artist}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {getCopyrightBadge()}
              <span className={cn(
                'badge-neutral',
                track.source.sourceType === 'manual' ? 'badge-neutral' : 'badge-gold'
              )}>
                {getSourceLabel()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-neutral-400">
              <Clock size={12} />
              <span className="font-mono text-neutral-300">{formatDuration(track.duration)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-400">
              <Users size={12} />
              <span className="font-mono text-gold">{track.voteCount.toLocaleString()} 票</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-400">
              <Zap size={12} />
              <span className="font-mono text-orange">
                {'★'.repeat(track.staminaLevel)}{'☆'.repeat(5 - track.staminaLevel)}
              </span>
            </div>
          </div>
        </div>

        <div className="text-neutral-500 shrink-0">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-neutral-800 animate-fade-in-up">
          <SourceInfoPanel
            trackSource={track.source}
            voteCount={track.voteCount}
            copyright={track.copyright}
          />
        </div>
      )}
    </div>
  );
}
