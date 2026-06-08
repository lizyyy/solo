import { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X, Info, AlertCircle } from 'lucide-react';
import type { Track, AnomalyType } from '../types';
import { ANOMALY_LABELS, LICENSE_LABELS } from '../types';
import { formatDuration, formatDateTime, truncateText } from '../utils/formatters';

const ALL_ANOMALY_TYPES: AnomalyType[] = ['expired_license', 'timecode_mismatch', 'duplicate_track'];

interface TrackRowProps {
  track: Track;
  index: number;
  onUpdateRemark: (trackId: string, remark: string) => void;
  onUpdateAnomaly: (trackId: string, anomalyTypes: AnomalyType[]) => void;
  isHighlighted?: boolean;
}

export function TrackRow({ track, index, onUpdateRemark, onUpdateAnomaly, isHighlighted }: TrackRowProps) {
  const [isEditingRemark, setIsEditingRemark] = useState(false);
  const [remarkValue, setRemarkValue] = useState(track.remark);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showAnomalyPicker, setShowAnomalyPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLTableRowElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditingRemark && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingRemark]);

  useEffect(() => {
    if (isHighlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);

  useEffect(() => {
    if (!showAnomalyPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowAnomalyPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAnomalyPicker]);

  useEffect(() => {
    setRemarkValue(track.remark);
  }, [track.remark]);

  const handleSaveRemark = () => {
    onUpdateRemark(track.id, remarkValue);
    setIsEditingRemark(false);
  };

  const handleCancelEdit = () => {
    setRemarkValue(track.remark);
    setIsEditingRemark(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRemark();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const toggleAnomalyType = (type: AnomalyType) => {
    const current = track.anomalyTypes;
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onUpdateAnomaly(track.id, next);
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
        <div className="relative">
          <button
            onClick={() => setShowAnomalyPicker(!showAnomalyPicker)}
            className="flex items-center gap-1 group/anomaly"
          >
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
                <span className="px-1 py-0.5 text-gray-300 hover:text-gray-500 text-xs opacity-0 group-hover/anomaly:opacity-100 transition-opacity">
                  ✎
                </span>
              </div>
            ) : (
              <span className="flex items-center gap-1 text-xs">
                <span className="text-green-600">✓ 正常</span>
                <AlertCircle className="w-3 h-3 text-gray-300 group-hover/anomaly:text-gray-400 opacity-0 group-hover/anomaly:opacity-100 transition-opacity" />
              </span>
            )}
          </button>

          {showAnomalyPicker && (
            <div
              ref={pickerRef}
              className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[180px]"
            >
              <div className="text-xs text-gray-500 mb-2 font-medium">人工标注异常</div>
              {ALL_ANOMALY_TYPES.map((type) => {
                const checked = track.anomalyTypes.includes(type);
                return (
                  <label
                    key={type}
                    className="flex items-center gap-2 py-1.5 px-1 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAnomalyType(type)}
                      className="w-4 h-4 rounded border-gray-300 text-[#E07A5F] focus:ring-[#E07A5F]"
                    />
                    <span className="text-sm text-gray-700">{ANOMALY_LABELS[type]}</span>
                  </label>
                );
              })}
              <div className="mt-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => {
                    onUpdateAnomaly(track.id, []);
                    setShowAnomalyPicker(false);
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  清除所有标注
                </button>
              </div>
            </div>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        {isEditingRemark ? (
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
          <div className="flex items-center gap-2 group/remark">
            <span className="text-sm text-gray-600 flex-1" title={track.remark}>
              {track.remark || <span className="text-gray-400 italic">点击添加备注</span>}
            </span>
            <button
              onClick={() => setIsEditingRemark(true)}
              className="p-1 text-gray-400 hover:text-[#1E3A3A] hover:bg-gray-100 rounded opacity-0 group-hover/remark:opacity-100 transition-opacity"
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
            <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[220px]">
              <div className="text-xs text-gray-500 space-y-1">
                <div>
                  <span className="text-gray-400">添加时间：</span>
                  {formatDateTime(track.createdAt)}
                </div>
                <div>
                  <span className="text-gray-400">更新时间：</span>
                  {formatDateTime(track.updatedAt)}
                </div>
                {hasAnomaly && (
                  <div>
                    <span className="text-gray-400">异常标注：</span>
                    {track.anomalyTypes.map((t) => ANOMALY_LABELS[t]).join('、')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
