import { useState, useMemo } from 'react'
import { useOrbitalStore, HistorySnapshot } from '@/store/useOrbitalStore'
import { getMolecule, getOrbital } from '@/data/molecules'
import { Trash2, GitCompare, X } from 'lucide-react'

function formatTime(ts: number): string {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((v) => v.toString().padStart(2, '0'))
    .join(':')
}

type DiffKey = keyof Pick<
  HistorySnapshot,
  'moleculeId' | 'orbitalId' | 'showNodePlanes' | 'nodePlaneOpacity' | 'sectionPosition' | 'showSection' | 'isosurfaceThreshold'
>

const DIFF_LABELS: Record<DiffKey, string> = {
  moleculeId: '分子',
  orbitalId: '轨道',
  showNodePlanes: '节点面显示',
  nodePlaneOpacity: '节点面透明度',
  sectionPosition: '截面位置',
  showSection: '截面显示',
  isosurfaceThreshold: '等值面阈值',
}

const DIFF_KEYS: DiffKey[] = [
  'moleculeId',
  'orbitalId',
  'showNodePlanes',
  'nodePlaneOpacity',
  'sectionPosition',
  'showSection',
  'isosurfaceThreshold',
]

function formatDiffValue(key: DiffKey, value: HistorySnapshot[DiffKey]): string {
  if (key === 'moleculeId') {
    return getMolecule(value as string)?.formula || (value as string)
  }
  if (key === 'orbitalId') {
    const snap = value as string
    const mol = getMolecule(snap.split('_')[0])
    const orb = getOrbital(mol?.id || '', snap)
    return orb?.label || snap
  }
  if (typeof value === 'boolean') return value ? '开' : '关'
  if (typeof value === 'number') return value.toFixed(2)
  return String(value)
}

function SnapshotLabel({ snapshot }: { snapshot: HistorySnapshot }) {
  const mol = getMolecule(snapshot.moleculeId)
  const orb = getOrbital(snapshot.moleculeId, snapshot.orbitalId)
  return (
    <span className="text-lab-glow/60 text-[10px] font-mono truncate">
      {mol?.formula || snapshot.moleculeId} · {orb?.label || snapshot.orbitalId}
    </span>
  )
}

function CompareView({
  left,
  right,
  onClose,
}: {
  left: HistorySnapshot
  right: HistorySnapshot
  onClose: () => void
}) {
  const diffs = useMemo(() => {
    const result: { key: DiffKey; left: HistorySnapshot[DiffKey]; right: HistorySnapshot[DiffKey] }[] = []
    for (const key of DIFF_KEYS) {
      if (left[key] !== right[key]) {
        result.push({ key, left: left[key], right: right[key] })
      }
    }
    return result
  }, [left, right])

  return (
    <div className="mt-2 p-2 rounded bg-lab-surface/80 border border-lab-glow/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono text-lab-glow uppercase tracking-wider">
          快照对比
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 rounded text-lab-muted hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-x-2 gap-y-1 text-[11px] font-mono">
        <span className="text-lab-muted text-center text-[10px]">
          {formatTime(left.timestamp)}
        </span>
        <span />
        <span className="text-lab-muted text-center text-[10px]">
          {formatTime(right.timestamp)}
        </span>
        {diffs.map((d) => (
          <div key={d.key} className="contents">
            <span className="text-lab-text px-1 py-0.5 rounded bg-lab-glow/10 border border-lab-glow/20 text-right">
              {formatDiffValue(d.key, d.left)}
            </span>
            <span className="text-lab-muted text-center self-center">
              {DIFF_LABELS[d.key]}
            </span>
            <span className="text-lab-glow px-1 py-0.5 rounded bg-lab-glow/10 border border-lab-glow/20">
              {formatDiffValue(d.key, d.right)}
            </span>
          </div>
        ))}
        {diffs.length === 0 && (
          <div className="col-span-3 text-center text-lab-muted/50 py-2">
            两个快照完全相同
          </div>
        )}
      </div>
    </div>
  )
}

export default function HistoryPanel() {
  const history = useOrbitalStore((s) => s.history)
  const restoreSnapshot = useOrbitalStore((s) => s.restoreSnapshot)
  const compareSnapshotId = useOrbitalStore((s) => s.compareSnapshotId)
  const setCompareSnapshotId = useOrbitalStore((s) => s.setCompareSnapshotId)
  const clearHistory = useOrbitalStore((s) => s.clearHistory)

  const [compareSecondId, setCompareSecondId] = useState<string | null>(null)

  const compareLeft = useMemo(
    () => history.find((h) => h.id === compareSnapshotId) || null,
    [history, compareSnapshotId]
  )
  const compareRight = useMemo(
    () => history.find((h) => h.id === compareSecondId) || null,
    [history, compareSecondId]
  )

  function handleCompareClick(id: string) {
    if (!compareSnapshotId) {
      setCompareSnapshotId(id)
      setCompareSecondId(null)
    } else if (compareSnapshotId === id) {
      setCompareSnapshotId(null)
      setCompareSecondId(null)
    } else if (!compareSecondId) {
      setCompareSecondId(id)
    } else {
      setCompareSnapshotId(id)
      setCompareSecondId(null)
    }
  }

  function handleCloseCompare() {
    setCompareSnapshotId(null)
    setCompareSecondId(null)
  }

  return (
    <div className="flex flex-col gap-3 p-3 bg-lab-panel rounded-lg border border-lab-border h-full">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-lab-muted uppercase tracking-wider">
          历史记录
        </span>
        {history.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            className="p-1 rounded text-lab-muted hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {history.length === 0 ? (
          <div className="text-[11px] text-lab-muted/50 text-center py-4 font-mono">
            暂无历史记录
          </div>
        ) : (
          <div className="relative pl-4">
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-lab-border" />

            <div className="space-y-1">
              {history.map((snap) => {
                const isSelected =
                  snap.id === compareSnapshotId || snap.id === compareSecondId

                return (
                  <div key={snap.id} className="relative">
                    <div
                      className={`absolute left-[-25px] top-[9px] w-2 h-2 rounded-full border ${
                        isSelected
                          ? 'bg-lab-glow border-lab-glow shadow-glow-sm'
                          : 'bg-lab-surface border-lab-border'
                      }`}
                    />

                    <div
                      className={`group p-1.5 rounded cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-lab-glow/10 border border-lab-glow/30'
                          : 'bg-lab-surface/40 border border-transparent hover:border-lab-border hover:bg-lab-surface/60'
                      }`}
                      onClick={() => restoreSnapshot(snap.id)}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono text-lab-text">
                              {snap.action}
                            </span>
                            <span className="text-[10px] font-mono text-lab-muted">
                              {formatTime(snap.timestamp)}
                            </span>
                          </div>
                          <SnapshotLabel snapshot={snap} />
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCompareClick(snap.id)
                          }}
                          className={`shrink-0 p-0.5 rounded transition-all cursor-pointer ${
                            isSelected
                              ? 'text-lab-glow'
                              : 'text-lab-muted/40 hover:text-lab-glow/60 hover:bg-lab-glow/10'
                          }`}
                          title="对比"
                        >
                          <GitCompare size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {compareLeft && compareRight && (
        <CompareView
          left={compareLeft}
          right={compareRight}
          onClose={handleCloseCompare}
        />
      )}
    </div>
  )
}
