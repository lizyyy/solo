import { useState } from 'react';
import type { Track } from '../types';
import StatusBadge from './StatusBadge';
import { materialApi } from '../utils/api';
import { useStore } from '../store/useStore';

interface TrackRemarkProps {
  track: Track;
  onUpdate?: () => void;
}

const reworkKeywords = ['返工', '重新录制', '补录', '改', '调整', '重新编曲', '换版本', '修订'];

export default function TrackRemark({ track, onUpdate }: TrackRemarkProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [remarks, setRemarks] = useState(track.remarks || '');
  const { showNotification, setLoading } = useStore();

  const hasRework = reworkKeywords.some(kw => remarks?.includes(kw));

  const handleSave = async () => {
    setLoading('track-remark', true);
    try {
      await materialApi.updateTrackRemarks(
        track.id,
        remarks,
        '版权运营',
        hasRework ? '轨道备注含返工原因，标记待复核' : '更新轨道备注'
      );
      showNotification('success', '轨道备注已更新，变更记录和历史记录已同步');
      setIsEditing(false);
      onUpdate?.();
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading('track-remark', false);
    }
  };

  const handleConfirmRework = async () => {
    setLoading('track-recheck', true);
    try {
      await materialApi.confirmRework(track.id, '版权运营');
      showNotification('success', '返工原因已复核，状态更新为已完成');
      onUpdate?.();
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading('track-recheck', false);
    }
  };

  return (
    <div className="bg-studio-darker rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-studio-gold font-mono text-sm">
              轨道 {track.track_number}
            </span>
            <span className="text-studio-silver text-xs">{track.track_type || '音乐轨'}</span>
            {hasRework && (
              <StatusBadge status="rework">含返工原因</StatusBadge>
            )}
            {track.need_recheck && (
              <StatusBadge status="pending">待复核</StatusBadge>
            )}
            {track.rework_confirmed && (
              <StatusBadge status="completed">已复核</StatusBadge>
            )}
          </div>
          <p className="text-white font-medium">{track.track_name}</p>
          {track.isrc_code && (
            <p className="text-xs text-studio-silver font-mono mt-1">
              ISRC: {track.isrc_code}
            </p>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="input-studio min-h-[100px] resize-y"
            placeholder="输入轨道备注...（包含返工、补录、重新录制等关键词将自动标记待复核）"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-studio text-sm">
              保存备注
            </button>
            <button
              onClick={() => {
                setRemarks(track.remarks || '');
                setIsEditing(false);
              }}
              className="btn-outline text-sm"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-studio-silver text-sm whitespace-pre-wrap">
            {track.remarks || '暂无备注'}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setIsEditing(true)}
              className="btn-outline text-sm px-3 py-1.5"
            >
              ✏️ 编辑备注
            </button>
            {track.need_recheck && !track.rework_confirmed && (
              <button
                onClick={handleConfirmRework}
                className="btn-confirm text-sm px-3 py-1.5"
              >
                ✓ 复核返工原因
              </button>
            )}
          </div>
        </div>
      )}

      {track.updated_at && (
        <p className="text-xs text-studio-silver mt-3 font-mono">
          最后更新: {track.updated_at}
        </p>
      )}
    </div>
  );
}
