import { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X, Info } from 'lucide-react';
import type { Track, AnomalyType } from '../types';
import { ANOMALY_LABELS, LICENSE_LABELS } from '../types';
import { formatDuration, formatDateTime, truncateText } from '../utils/formatters';

interface TrackRowProps {
  track: Track;
  index: number;
  onUpdateRemark: (trackId: string, remark: string) => void;
  onUpdateAnomaly: (trackId: string, anomalyTypes: AnomalyType[]) => void;
  isHighlighted?: boolean;
}

export function TrackRow({ track, index, onUpdateRemark, onUpdateAnomaly, isHighlighted }: TrackRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [remarkValue, setRemarkValue] = useState(track.remark);
  const [showTooltip, setShowTooltip] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isHighlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);

  const handleSaveRemark = () => {
    onUpdateRemark(track.id, remarkValue);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setRemarkValue(track.remark);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRemark();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const getLicenseBadgeColor = () => {
    switch (track.licenseStatus) {
      case 'valid':
        return 'bg-green-100 text-green-700';
      case 'expired':
        return 'bg-red-100 text-red-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  const hasAnomaly = track.anomalyTypes.length > 0;

  return (
    <tr
      ref={rowRef}
      className={`border-b border-gray-100 transition-all ${
        isHighlighted ? 'bg-[#F2CC8F]/30 ring-2 ring-[#F2CC8F]' : ''
      } ${hasAnomaly ? 'bg-red-50/50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
    >
      <td className="px-4 py-3 text-sm text-gray-500 font-mono">
        {String(index + 1).padStart(2, '0')}
      </td>

      <td className="px-4 py-3">
        <div className="font-medium text-gray-800" title={track.title}>
          {track.title || <span className="text-gray-400 italic">未命名</span>}
        </div>
        <div className="text-xs text-gray-500" title={track.artist}>
          {truncateText(track.artist, 20)}
        </div>
      </td>

      <td className="px-4 py-3 text-sm font-mono text-gray-600">
        {track.isrc || <span className="text-gray-400">--</span>}
      </td>

      <td className="px-4 py-3 text-sm text-gray-600 font-mono">
        {formatDuration(track.duration)}
      </td>

      <td className="px-4 py-3 text-sm text-gray-600 font-mono">
        {track.timecode || <span className="text-gray-400">--</span>}
      </td>

      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLicenseBadgeColor()}`}>
          {LICENSE_LABELS[track.licenseStatus]}
        </span>
      </td>

      <td className="px-4 py-3">
        {hasAnomaly ? (
          <div className="flex flex-wrap gap-1">
            {track.anomalyTypes.map((type) => (
              <span
                key={type}
                className="px-1.5 py-0.5 bg-[#E07A5F]/10 text-[#E07A5F] rounded text-xs font-medium"
              >
                {ANOMALY_LABELS[type]}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-green-600 text-xs">✓ 正常</span>
        )}
      </td>

      <td className="px-4 py-3">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={remarkValue}
              onChange={(e) => setRemarkValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveRemark}
              className="flex-1 px-2 py-1 border border-[#1E3A3A] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A3A]/50 min-w-[150px]"
            />
            <button
              onClick={handleSaveRemark}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-1 text-red-600 hover:bg-red-50 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <span className="text-sm text-gray-600 flex-1" title={track.remark}>
              {track.remark || <span className="text-gray-400 italic">点击添加备注</span>}
            </span>
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 text-gray-400 hover:text-[#1E3A3A] hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="p-1 text-gray-400 hover:text-[#1E3A3A] hover:bg-gray-100 rounded"
          >
            <Info className="w-4 h-4" />
          </button>
          {showTooltip && (
            <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px]">
              <div className="text-xs text-gray-500 space-y-1">
                <div>
                  <span className="text-gray-400">添加时间：</span>
                  {formatDateTime(track.createdAt)}
                </div>
                <div>
                  <span className="text-gray-400">更新时间：</span>
                  {formatDateTime(track.updatedAt)}
                </div>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
