import { useState } from 'react';
import { usePipelineStore } from '@/store/pipelineStore';
import type { Conflict, ConflictResolution } from '@/types';
import { AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const CONFLICT_TYPE_LABELS: Record<Conflict['type'], string> = {
  photo_cad_mismatch: '照片-CAD不匹配',
  duplicate_import: '重复导入',
};

function EvidenceDisplay({ conflict }: { conflict: Conflict }) {
  if (conflict.type === 'photo_cad_mismatch') {
    return (
      <div className="flex items-center gap-4 my-3">
        <div className="flex-1 rounded-lg bg-blue-50 border border-blue-200 p-3">
          <div className="text-xs text-blue-600 mb-1 font-display">照片编号信息</div>
          <div className="font-mono-data text-sm text-blue-900">
            {conflict.evidence.map((e) => String(e.photoValue)).join(', ')}
          </div>
        </div>
        <div className="flex-shrink-0 text-2xl font-bold text-red-500">≠</div>
        <div className="flex-1 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <div className="text-xs text-amber-600 mb-1 font-display">CAD图层信息</div>
          <div className="font-mono-data text-sm text-amber-900">
            {conflict.evidence.map((e) => String(e.cadValue)).join(', ')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-3">
      {conflict.evidence.map((e, i) => (
        <div key={i} className="rounded-lg bg-orange-50 border border-orange-200 p-3">
          <div className="text-xs text-orange-600 mb-1 font-display">重复导入详情</div>
          <div className="flex items-center gap-3">
            <span className="font-mono-data text-sm text-orange-900">照片编号: {String(e.photoValue)}</span>
            <span className="text-orange-400">|</span>
            <span className="text-sm text-orange-700">{String(e.cadValue)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResolutionBadge({ resolution }: { resolution: ConflictResolution }) {
  if (resolution === 'confirm') {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
        <CheckCircle className="w-3.5 h-3.5" />已确认
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">
      <XCircle className="w-3.5 h-3.5" />已驳回
    </span>
  );
}

function ConflictCard({ conflict }: { conflict: Conflict }) {
  const { records, resolveConflict } = usePipelineStore();
  const [note, setNote] = useState('');
  const [resolution, setResolution] = useState<ConflictResolution | null>(null);

  const record = records.find((r) => r.id === conflict.recordId);

  if (conflict.status === 'resolved' && conflict.resolution) {
    return (
      <div className={cn('card', resolution ? 'opacity-80' : '')}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="status-tag">{CONFLICT_TYPE_LABELS[conflict.type]}</span>
            {record && <span className="font-mono-data text-xs text-gray-500">{record.photoNumber}</span>}
          </div>
          <ResolutionBadge resolution={conflict.resolution} />
        </div>
        <EvidenceDisplay conflict={conflict} />
        <div className="text-xs text-gray-500 mt-1">
          裁决人: {conflict.resolvedBy} · {conflict.resolvedAt ? new Date(conflict.resolvedAt).toLocaleString('zh-CN') : ''}
        </div>
      </div>
    );
  }

  const handleResolve = (r: ConflictResolution) => {
    resolveConflict(conflict.id, r, note || undefined);
    setResolution(r);
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <span className="status-tag">{CONFLICT_TYPE_LABELS[conflict.type]}</span>
        {record && <span className="font-mono-data text-xs text-gray-500">{record.photoNumber}</span>}
      </div>

      {conflict.evidence.map((e, i) => (
        <p key={i} className="text-sm text-gray-600 mb-1">{e.description}</p>
      ))}

      <EvidenceDisplay conflict={conflict} />

      {!resolution ? (
        <div className="mt-4 space-y-3">
          <textarea
            className="input-field w-full text-sm"
            rows={2}
            placeholder="裁决备注（可选）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-3">
            <button className="btn-success flex items-center gap-1.5" onClick={() => handleResolve('confirm')}>
              <CheckCircle className="w-4 h-4" />确认
            </button>
            <button className="btn-danger flex items-center gap-1.5" onClick={() => handleResolve('reject')}>
              <XCircle className="w-4 h-4" />驳回
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 inline-flex items-center gap-2">
          <ResolutionBadge resolution={resolution} />
          <span className="text-xs text-gray-500">裁决完成</span>
        </div>
      )}
    </div>
  );
}

export default function ConflictsPage() {
  const { conflicts } = usePipelineStore();
  const [showResolved, setShowResolved] = useState(false);

  const pending = conflicts.filter((c) => c.status === 'pending');
  const resolved = conflicts.filter((c) => c.status === 'resolved');

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display text-gray-900">冲突处理</h1>
        <p className="text-sm text-gray-500 mt-1">照片编号与CAD图层名冲突证据展示，人工裁决确认或驳回</p>
      </div>

      {conflicts.length === 0 && (
        <div className="card text-center py-12 text-gray-400">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-300" />
          <p>暂无冲突记录</p>
        </div>
      )}

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold font-display text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            待处理冲突
            <span className="text-sm font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {pending.length}
            </span>
          </h2>
          <div className="space-y-4">
            {pending.map((c) => (
              <ConflictCard key={c.id} conflict={c} />
            ))}
          </div>
        </section>
      )}

      {resolved.length > 0 && (
        <section>
          <button
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-3 transition-colors"
            onClick={() => setShowResolved(!showResolved)}
          >
            {showResolved ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            已处理冲突 ({resolved.length})
          </button>
          {showResolved && (
            <div className="space-y-4">
              {resolved.map((c) => (
                <ConflictCard key={c.id} conflict={c} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
