import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Clip } from 'shared/types';
import { STATUS_CONFIG, formatDuration, formatDate } from 'shared/constants';
import { useClipStore } from '@/store/clipStore';
import StatusBadge from './StatusBadge';
import SourceTag from './SourceTag';
import { Clock, User, AlertCircle, CheckSquare, Square, Edit } from 'lucide-react';

interface ClipCardProps {
  clip: Clip;
}

const ClipCard: React.FC<ClipCardProps> = ({ clip }) => {
  const navigate = useNavigate();
  const { selectedClipIds, toggleClipSelection } = useClipStore();
  const isSelected = selectedClipIds.includes(clip.id);

  const statusConfig = STATUS_CONFIG[clip.status];
  const hasEditPoint = !!clip.editPointContent;
  const hasAdScript = !!clip.adScriptContent;
  const hasAudioChange = !!clip.audioTrackAfter;
  const hasPending = clip.pendingReasons.some(p => !p.resolved);
  const latestPending = clip.pendingReasons.find(p => !p.resolved);
  const missingCount = clip.materials.filter(m => m.status === 'missing').length;

  const sourceTypes: ('edit_point' | 'ad_script' | 'audio_track')[] = [];
  if (hasEditPoint) sourceTypes.push('edit_point');
  if (hasAdScript) sourceTypes.push('ad_script');
  if (hasAudioChange) sourceTypes.push('audio_track');

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleClipSelection(clip.id);
  };

  return (
    <div
      className={`card p-5 cursor-pointer group relative animate-fade-in ${
        isSelected ? 'ring-2 ring-amber-500' : ''
      }`}
      onClick={() => navigate(`/clip/${clip.id}`)}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: statusConfig.color,
      }}
    >
      <div className="absolute top-4 left-4" onClick={handleSelect}>
        {isSelected ? (
          <CheckSquare className="w-4 h-4 text-amber-700" />
        ) : (
          <Square className="w-4 h-4 text-studio-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 pl-7">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-studio-muted">
              {clip.episode}
            </span>
            {missingCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="w-3 h-3" />
                {missingCount}项缺失
              </span>
            )}
          </div>
          <h3 className="font-serif text-base font-semibold text-slate-850 mb-1 group-hover:text-amber-700 transition-colors">
            {clip.title}
          </h3>
          <p className="text-sm text-studio-muted">嘉宾：{clip.guest}</p>
        </div>
        <StatusBadge status={clip.status} />
      </div>

      <div className="flex items-center gap-3 mb-3 pl-7">
        <div className="flex items-center gap-1">
          {sourceTypes.map(type => (
            <SourceTag key={type} type={type} showIcon={false} />
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs text-studio-muted">
          <Clock className="w-3 h-3" />
          {formatDuration(clip.duration)}
        </div>
      </div>

      {hasPending && latestPending && (
        <div className="mb-3 p-2.5 rounded-md bg-red-50 border border-red-100 pl-7">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-red-700">待处理原因</p>
              <p className="text-xs text-red-600 line-clamp-2">
                {latestPending.reason}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-studio-muted pl-7">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>
              {clip.changeLogs[0]?.operatorName || '未知'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Edit className="w-3 h-3" />
            <span>{formatDate(clip.updatedAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-amber-700">
          查看详情
        </div>
      </div>
    </div>
  );
};

export default ClipCard;
