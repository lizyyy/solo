import { useSnapshotStore } from '@/store/snapshotStore'
import { useExposureStore } from '@/store/exposureStore'
import { Clock, Trash2, RotateCcw } from 'lucide-react'
import type { Snapshot } from '@/types'

export default function SnapshotList() {
  const snapshots = useSnapshotStore((s) => s.snapshots)
  const loadSnapshots = useSnapshotStore((s) => s.loadSnapshots)
  const deleteSnapshot = useSnapshotStore((s) => s.deleteSnapshot)
  const loadFromSnapshot = useExposureStore((s) => s.loadFromSnapshot)

  const handleLoad = (snap: Snapshot) => {
    loadFromSnapshot({
      subsidiaries: snap.subsidiaries,
      currencies: snap.currencies,
      exposures: snap.exposures,
      hedgeContracts: snap.hedgeContracts,
      exchangeRates: snap.exchangeRates,
      anomalies: snap.anomalies,
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-accent-blue" />
          <span className="text-xs font-medium text-txt-primary">历史快照</span>
        </div>
        <button className="btn-secondary text-xs py-1 px-3" onClick={loadSnapshots}>
          刷新
        </button>
      </div>

      {snapshots.length === 0 ? (
        <div className="text-center text-txt-muted py-8 text-sm">暂无快照记录</div>
      ) : (
        <div className="space-y-2">
          {snapshots.map((snap) => (
            <div key={snap.id} className="card flex items-center justify-between group">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-txt-primary truncate">{snap.summary}</div>
                <div className="text-xs text-txt-muted mt-1">
                  {new Date(snap.createdAt).toLocaleString()} · {snap.createdBy}
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="p-1.5 rounded-lg hover:bg-accent-green/10 text-accent-green transition-colors"
                  onClick={() => handleLoad(snap)}
                  title="复盘回放"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  className="p-1.5 rounded-lg hover:bg-accent-red/10 text-accent-red transition-colors"
                  onClick={() => deleteSnapshot(snap.id)}
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
