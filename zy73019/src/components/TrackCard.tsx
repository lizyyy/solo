import { AlertTriangle, FileStack, RotateCcw, CalendarDays, PawPrint } from 'lucide-react';
import { ISSUE_LABEL, type Track } from '../../shared/types';
import { cn } from '@/lib/utils';
import StatusBadge from './StatusBadge';

interface TrackCardProps {
  track: Track;
  onClick: () => void;
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
};

const TrackCard = ({ track, onClick }: TrackCardProps) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'relative bg-white border border-slate-200 rounded-lg p-4 cursor-pointer',
        'hover:border-[#B8956A]/50 hover:shadow-md transition-all duration-200',
        'active:scale-[0.99]'
      )}
    >
      {track.aliasWarning && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="relative">
            <div className="w-7 h-7 rounded-full bg-[#B91C1C] flex items-center justify-center shadow-md border-2 border-white">
              <AlertTriangle size={14} className="text-white" />
            </div>
          </div>
        </div>
      )}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#B8956A]/10 flex items-center justify-center">
            <PawPrint size={18} className="text-[#B8956A]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-800 truncate">
              {track.petName}
            </h3>
            {track.aliases.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {track.aliases.map((alias, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200"
                  >
                    {alias}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <StatusBadge status={track.status} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              'px-2 py-0.5 rounded text-xs font-medium',
              'bg-[#475569]/10 text-[#475569] border border-[#475569]/20'
            )}
          >
            {ISSUE_LABEL[track.issueType]}
          </span>
        </div>
        <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <FileStack size={14} className="text-slate-400" />
            <span>材料</span>
            <span
              className={cn(
                'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-medium',
                track.materials.length > 0
                  ? 'bg-[#7A9E7E]/15 text-[#5A7D5E]'
                  : 'bg-slate-100 text-slate-500'
              )}
            >
              {track.materials.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <RotateCcw size={14} className="text-slate-400" />
            <span>改判</span>
            <span
              className={cn(
                'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-medium',
                track.revisionCount > 0
                  ? 'bg-[#D97706]/15 text-[#B45309]'
                  : 'bg-slate-100 text-slate-500'
              )}
            >
              {track.revisionCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-auto">
            <CalendarDays size={14} className="text-slate-400" />
            <span>{formatDate(track.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackCard;
