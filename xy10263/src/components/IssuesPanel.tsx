import { useState } from 'react';
import { AlertTriangle, Gap as GapIcon, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { useWorkspace } from '../store/context';
import type { Conflict, Gap } from '../types';

const CONFLICT_TYPE_LABELS: Record<string, string> = {
  time_conflict: '时间冲突',
  testimony_conflict: '证词冲突',
  logic_conflict: '逻辑冲突',
};

const GAP_TYPE_LABELS: Record<string, string> = {
  missing_clue: '线索缺失',
  timeline_gap: '时间线缺口',
  unassigned: '玩家无关联',
};

function ConflictItem({ conflict }: { conflict: Conflict }) {
  const { dispatch, workspace } = useWorkspace();
  const [resolving, setResolving] = useState(false);
  const [notes, setNotes] = useState('');

  const getRelatedClues = () => {
    return conflict.involvedClueIds
      .map(id => workspace.clues.find(c => c.id === id))
      .filter(Boolean);
  };

  const handleResolve = () => {
    dispatch({
      type: 'RESOLVE_CONFLICT',
      payload: { id: conflict.id, notes },
    });
    setResolving(false);
    setNotes('');
  };

  return (
    <div
      className={`p-3 rounded-lg border ${
        conflict.resolved
          ? 'bg-emerald-900/20 border-emerald-800'
          : 'bg-red-900/20 border-red-800'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          {conflict.resolved ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white font-medium">{conflict.description}</span>
              <span className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">
                {CONFLICT_TYPE_LABELS[conflict.type] || conflict.type}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-xs text-slate-400 mb-1">涉及线索:</p>
              <div className="space-y-1">
                {getRelatedClues().map((clue) => clue && (
                  <div key={clue.id} className="text-xs text-slate-300 bg-slate-800 px-2 py-1 rounded">
                    • {clue.title}
                  </div>
                ))}
              </div>
            </div>
            {conflict.resolvedNotes && (
              <p className="mt-2 text-xs text-emerald-400">
                ✓ {conflict.resolvedNotes}
              </p>
            )}
          </div>
        </div>

        {!conflict.resolved && (
          <button
            onClick={() => setResolving(true)}
            className="text-xs text-emerald-400 hover:text-emerald-300"
          >
            标记解决
          </button>
        )}
      </div>

      {resolving && (
        <div className="mt-3 space-y-2">
          <textarea
            placeholder="解决说明（可选）"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
          />
          <div className="flex gap-2">
            <button
              onClick={handleResolve}
              className="flex-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm"
            >
              确认解决
            </button>
            <button
              onClick={() => {
                setResolving(false);
                setNotes('');
              }}
              className="flex-1 px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GapItem({ gap }: { gap: Gap }) {
  return (
    <div className="p-3 rounded-lg border bg-amber-900/20 border-amber-800">
      <div className="flex items-start gap-2">
        <GapIcon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white">{gap.description}</span>
            <span className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">
              {GAP_TYPE_LABELS[gap.type] || gap.type}
            </span>
          </div>
          {gap.relatedTimeRange && (
            <p className="text-xs text-slate-400 mt-1">
              时间范围: {gap.relatedTimeRange[0]} - {gap.relatedTimeRange[1]}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function IssuesPanel() {
  const { conflicts, gaps, statistics } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'conflicts' | 'gaps'>('conflicts');

  const unresolvedCount = conflicts.filter(c => !c.resolved).length;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('conflicts')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeTab === 'conflicts'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <XCircle className="w-4 h-4" />
            <span>冲突 ({unresolvedCount}/{conflicts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('gaps')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeTab === 'gaps'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>遗漏 ({gaps.length})</span>
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-72 overflow-y-auto">
        {activeTab === 'conflicts' && (
          <>
            {conflicts.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p>未检测到冲突</p>
                <p className="text-sm mt-1">继续分析线索以发现潜在冲突</p>
              </div>
            ) : (
              conflicts.map((conflict) => (
                <ConflictItem key={conflict.id} conflict={conflict} />
              ))
            )}
          </>
        )}

        {activeTab === 'gaps' && (
          <>
            {gaps.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p>未发现明显遗漏</p>
                <p className="text-sm mt-1">数据覆盖良好</p>
              </div>
            ) : (
              gaps.map((gap) => (
                <GapItem key={gap.id} gap={gap} />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
