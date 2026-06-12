import type { Conflict } from '../types';
import StatusBadge from './StatusBadge';

interface ConflictEvidenceProps {
  conflict: Conflict;
  onResolve: (conflictId: string, resolution: 'confirmed' | 'rejected') => void;
}

const fieldLabels: Record<string, string> = {
  license_end_date: '授权截止日期',
  episode_count: '集数',
  license_fee: '授权费用',
  revenue_ratio: '分成比例',
  error_tolerance: '误差说明',
  track_remarks: '轨道备注',
};

export default function ConflictEvidence({ conflict, onResolve }: ConflictEvidenceProps) {
  const evidence = typeof conflict.evidence === 'string' 
    ? JSON.parse(conflict.evidence) 
    : conflict.evidence;

  return (
    <div className="card-studio p-5 border-l-4 border-status-conflict">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <StatusBadge status="conflict" />
            <span className="text-studio-gold font-mono text-sm">
              {fieldLabels[conflict.field_name] || conflict.field_name}
            </span>
          </div>
          <p className="text-sm text-studio-silver">
            检测到授权页数据与调音师留言存在冲突，请许老师确认
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-studio-darker rounded-lg p-4">
          <p className="text-xs font-mono text-status-reused mb-2">授权期限页数据</p>
          <p className="text-white font-mono text-lg">{evidence.original_value || '—'}</p>
        </div>
        <div className="bg-studio-darker rounded-lg p-4 border-l-2 border-status-conflict">
          <p className="text-xs font-mono text-status-conflict mb-2">调音师留言数据</p>
          <p className="text-white font-mono text-lg">{evidence.message_value || '—'}</p>
        </div>
      </div>

      <div className="bg-studio-darker rounded-lg p-4 mb-4">
        <p className="text-xs font-mono text-studio-gold mb-2">留言原文</p>
        <p className="text-studio-silver font-mono text-sm italic">
          "{evidence.message_content}"
        </p>
        {evidence.keyword && (
          <p className="text-xs text-status-conflict mt-2 font-mono">
            匹配关键词: {evidence.keyword}
          </p>
        )}
      </div>

      {conflict.status === 'pending' && (
        <div className="flex gap-3">
          <button
            onClick={() => onResolve(conflict.id, 'confirmed')}
            className="flex-1 btn-confirm text-sm"
          >
            ✓ 以留言为准（确认覆盖）
          </button>
          <button
            onClick={() => onResolve(conflict.id, 'rejected')}
            className="flex-1 btn-outline text-sm"
          >
            ✕ 保持原数据（驳回）
          </button>
        </div>
      )}

      {conflict.status !== 'pending' && (
        <div className="flex items-center gap-2">
          <StatusBadge status={conflict.status === 'confirmed' ? 'completed' : 'reused'} />
          <span className="text-sm text-studio-silver">
            处理人: {conflict.resolved_by} | {conflict.resolved_at}
          </span>
        </div>
      )}
    </div>
  );
}
