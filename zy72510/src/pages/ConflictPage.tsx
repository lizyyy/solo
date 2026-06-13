import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useAppStore } from '@/store/app';
import ConflictEvidenceView from '@/components/ConflictEvidenceView';
import type { ConflictEvidence, GrayBatch, Sample } from '../../shared/types';

export default function ConflictPage() {
  const { currentBatchId, setCurrentBatchId, setConflictList, conflictList } = useAppStore();
  const [batches, setBatches] = useState<GrayBatch[]>([]);
  const [sampleMap, setSampleMap] = useState<Record<string, Sample>>({});

  useEffect(() => {
    api.getBatches().then(setBatches);
  }, []);

  useEffect(() => {
    if (currentBatchId) {
      loadConflicts(currentBatchId);
    }
  }, [currentBatchId]);

  async function loadConflicts(batchId: string) {
    const list = await api.getConflicts(batchId);
    setConflictList(list);
    const map: Record<string, Sample> = {};
    for (const c of list) {
      try {
        const s = await api.getSample(c.sampleId);
        map[c.sampleId] = s;
      } catch {}
    }
    setSampleMap(map);
  }

  function handleResolved() {
    if (currentBatchId) loadConflicts(currentBatchId);
  }

  const unresolved = conflictList.filter((c) => !c.resolved);
  const resolved = conflictList.filter((c) => c.resolved);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">冲突处理</h2>
        <select
          value={currentBatchId ?? ''}
          onChange={(e) => setCurrentBatchId(e.target.value || null)}
          className="px-3 py-1.5 bg-slate-800 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:border-white/20"
        >
          <option value="">选择批次...</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.name} ({b.id})</option>
          ))}
        </select>
      </div>

      {!currentBatchId ? (
        <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
          请先选择一个批次
        </div>
      ) : conflictList.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
          暂无冲突数据
        </div>
      ) : (
        <div className="space-y-6">
          {unresolved.length > 0 && (
            <div>
              <div className="text-xs font-medium text-red-400 mb-3">待处理冲突（{unresolved.length}）</div>
              <div className="space-y-3">
                {unresolved.map((c: ConflictEvidence, i: number) => (
                  <div key={c.id} className={i % 2 === 1 ? 'opacity-95' : ''}>
                    <ConflictEvidenceView
                      conflict={c}
                      sample={sampleMap[c.sampleId]}
                      onResolved={handleResolved}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {resolved.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-400 mb-3">已处理冲突（{resolved.length}）</div>
              <div className="space-y-3">
                {resolved.map((c: ConflictEvidence, i: number) => (
                  <div key={c.id} className={i % 2 === 1 ? 'opacity-95' : ''}>
                    <ConflictEvidenceView
                      conflict={c}
                      sample={sampleMap[c.sampleId]}
                      onResolved={handleResolved}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
