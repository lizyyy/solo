import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Layers,
  GitBranch,
  CheckCircle2,
  ChevronDown,
  Package,
  User,
  Clock,
} from 'lucide-react';
import { useWorkbenchStore } from '@/store';
import {
  ConclusionDisplay,
  ConclusionColors,
  type PendingConfirmItem,
  type CollisionPoint,
  type Conclusion,
} from '@/shared/types';

interface PendingWithDetails {
  pending: PendingConfirmItem;
  materialName: string;
  collisions: CollisionPoint[];
}

function PendingCard({ item }: { item: PendingWithDetails }) {
  const { pending, materialName, collisions } = item;
  const [keepId, setKeepId] = useState<string>(
    pending.duplicate_collision_ids[0] || ''
  );
  const [resolution, setResolution] = useState('保留最早检测记录，删除重复项');
  const resolvePending = useWorkbenchStore((s) => s.resolvePending);
  const selectCollision = useWorkbenchStore((s) => s.selectCollision);
  const [submitting, setSubmitting] = useState(false);

  const handleResolve = async () => {
    if (!keepId || submitting) return;
    setSubmitting(true);
    await resolvePending(pending.pending_id, {
      keep_collision_id: keepId,
      resolution,
    });
    setSubmitting(false);
  };

  return (
    <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-white font-medium">
                疑似重复碰撞
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs border border-amber-500/30">
                {pending.duplicate_collision_ids.length} 条重复
              </span>
              <span className="font-mono text-xs text-slate-500">
                {pending.pending_id}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Package size={12} />
              <span>涉及材料：{materialName}</span>
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500 flex-shrink-0">
          <div className="flex items-center justify-end gap-1 mb-0.5">
            <User size={10} />
            {pending.suspended_by}
          </div>
          <div className="flex items-center justify-end gap-1">
            <Clock size={10} />
            {new Date(pending.suspended_at).toLocaleString('zh-CN')}
          </div>
        </div>
      </div>

      <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
        <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
          <GitBranch size={12} />
          牵动的加固结论
        </div>
        <div className="flex flex-wrap gap-1.5">
          {pending.affected_conclusions.length === 0 ? (
            <span className="text-slate-500 text-xs italic">暂不牵动方案结论</span>
          ) : (
            pending.affected_conclusions.map((c: Conclusion, i) => (
              <span
                key={i}
                className={`px-2 py-0.5 text-white text-xs rounded border border-white/10 ${ConclusionColors[c]}`}
                title={ConclusionDisplay[c]}
              >
                {ConclusionDisplay[c]}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700">
        <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
          <Layers size={12} />
          影响分析
        </div>
        <p className="text-slate-300 text-sm">{pending.impact_analysis}</p>
      </div>

      <div>
        <div className="text-xs text-slate-500 mb-2">选择保留的碰撞点：</div>
        <div className="space-y-2">
          {pending.duplicate_collision_ids.map((colId) => {
            const col = collisions.find((c) => c.collision_id === colId);
            return (
              <label
                key={colId}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  keepId === colId
                    ? 'bg-blue-500/10 border-blue-500/50'
                    : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name={`keep-${pending.pending_id}`}
                  checked={keepId === colId}
                  onChange={() => setKeepId(colId)}
                  className="mt-0.5 accent-blue-500"
                />
                <div
                  className="flex-1 min-w-0"
                  onClick={() => col && selectCollision(col.collision_id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-sm font-mono">
                      {colId}
                    </span>
                    {col && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          col.severity === 'high'
                            ? 'bg-red-500/20 text-red-400'
                            : col.severity === 'medium'
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {col.severity === 'high'
                          ? '高风险'
                          : col.severity === 'medium'
                          ? '中风险'
                          : '低风险'}
                      </span>
                    )}
                  </div>
                  {col && (
                    <>
                      <p className="text-slate-400 text-xs line-clamp-2 mb-1">
                        {col.description}
                      </p>
                      <div className="text-[10px] text-slate-500 flex items-center gap-3">
                        <span>
                          检测:{' '}
                          {new Date(col.detected_at).toLocaleString('zh-CN')}
                        </span>
                        <span>元件: {col.element_id}</span>
                      </div>
                    </>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-500 mb-1">处理说明：</div>
        <textarea
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          rows={2}
          className="w-full bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-blue-500 resize-none placeholder-slate-500"
          placeholder="输入处理说明..."
        />
      </div>

      <div className="flex justify-end pt-2 border-t border-slate-700/50">
        <button
          onClick={handleResolve}
          disabled={!keepId || submitting}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
        >
          <CheckCircle2 size={16} />
          {submitting ? '处理中...' : '确认处理'}
        </button>
      </div>
    </div>
  );
}

export default function PendingTab() {
  const record = useWorkbenchStore((s) => s.record);

  const items = useMemo<PendingWithDetails[]>(() => {
    if (!record) return [];
    return record.pending_queue
      .filter((p) => !p.resolved_at)
      .map((pending) => {
        const mat = record.materials.find(
          (m) => m.item_id === pending.material_item_id
        );
        const collisions =
          mat?.collision_points.filter((c) =>
            pending.duplicate_collision_ids.includes(c.collision_id)
          ) || [];
        return {
          pending,
          materialName: mat?.material_name || '未知材料',
          collisions,
        };
      });
  }, [record]);

  if (!record) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800/50">
        <span className="text-xs text-slate-400 flex items-center gap-1.5">
          <AlertTriangle size={12} className="text-amber-400" />
          待确认 {items.length} 条，
          <span className="text-slate-500">
            已解决 {record.pending_queue.filter((p) => p.resolved_at).length} 条
          </span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <CheckCircle2 size={48} className="mb-3 opacity-30 text-emerald-500" />
            <p className="text-slate-400">暂无待确认项</p>
            <p className="text-xs text-slate-600 mt-1">所有碰撞点均已确认处理</p>
          </div>
        ) : (
          items.map((item) => (
            <PendingCard
              key={item.pending.pending_id}
              item={item}
            />
          ))
        )}
      </div>
    </div>
  );
}
