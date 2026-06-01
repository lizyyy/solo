import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { QC_ISSUE_LABELS, type QCIssueType } from '@/types'
import { CheckCircle, AlertCircle } from 'lucide-react'

const QC_SUB_TABS: { key: QCIssueType; label: string }[] = [
  { key: 'null_value', label: '空值' },
  { key: 'duplicate', label: '重复项' },
  { key: 'boundary', label: '边界' },
]

export default function QCPanels() {
  const [activeSubTab, setActiveSubTab] = useState<QCIssueType>('null_value')
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({})

  const qcRecords = useStore((s) => s.qcRecords)
  const conflicts = useStore((s) => s.conflicts)
  const photos = useStore((s) => s.photos)
  const resolveQC = useStore((s) => s.resolveQC)
  const resolveConflict = useStore((s) => s.resolveConflict)
  const addJudgment = useStore((s) => s.addJudgment)

  const filteredRecords = qcRecords.filter((r) => r.issueType === activeSubTab)
  const pendingConflicts = conflicts.filter((c) => c.resolution === 'pending')

  const getPhotoFileName = (photoId?: string) => {
    if (!photoId) return null
    return photos.find((p) => p.id === photoId)?.fileName ?? null
  }

  const handleResolveConflict = (
    conflictId: string,
    pointId: string,
    resolution: 'data_side' | 'photo_side' | 'manual_override',
    reason: string
  ) => {
    const conflict = conflicts.find((c) => c.id === conflictId)
    if (!conflict) return

    let oldValue = ''
    let newValue = ''
    if (resolution === 'data_side') {
      oldValue = '冲突待决'
      newValue = '采纳数据侧'
    } else if (resolution === 'photo_side') {
      oldValue = '冲突待决'
      newValue = '采纳照片侧'
    } else {
      oldValue = '冲突待决'
      newValue = `手动覆盖: ${reason}`
    }

    resolveConflict(conflictId, resolution, '当前用户')
    addJudgment({
      pointId,
      operator: '当前用户',
      judgmentType: 'conflict_resolution',
      oldValue,
      newValue,
      reason: resolution === 'manual_override' ? reason : `采纳${resolution === 'data_side' ? '数据侧' : '照片侧'}证据`,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1">
        {QC_SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeSubTab === tab.key
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredRecords.length === 0 && (
          <p className="text-sm text-gray-500">暂无{QC_ISSUE_LABELS[activeSubTab]}问题</p>
        )}
        {filteredRecords.map((record) => (
          <div
            key={record.id}
            className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/record/${record.pointId}`}
                    className="font-mono text-sm font-semibold text-cyan-400 hover:underline"
                  >
                    {record.pointId}
                  </Link>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      record.status === 'open'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {record.status === 'open' ? (
                      <AlertCircle size={10} />
                    ) : (
                      <CheckCircle size={10} />
                    )}
                    {record.status === 'open' ? '未解决' : '已解决'}
                  </span>
                </div>
                <p className="text-sm text-gray-400">{record.description}</p>
                {getPhotoFileName(record.photoId) && (
                  <p className="font-mono text-xs text-gray-500">
                    照片: {getPhotoFileName(record.photoId)}
                  </p>
                )}
              </div>
              {record.status === 'open' && (
                <button
                  onClick={() => resolveQC(record.id)}
                  className="shrink-0 rounded-md border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
                >
                  标记已解决
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-orange-400">冲突仲裁</h3>
        {pendingConflicts.length === 0 && (
          <p className="text-sm text-gray-500">暂无待决冲突</p>
        )}
        <div className="space-y-4">
          {pendingConflicts.map((conflict) => (
            <div
              key={conflict.id}
              className="rounded-lg border border-orange-500/30 bg-white/[0.03] p-4"
            >
              <div className="mb-3 font-mono text-sm font-semibold text-cyan-400">
                <Link to={`/record/${conflict.pointId}`} className="hover:underline">
                  {conflict.pointId}
                </Link>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-4">
                <div className="rounded-md border border-white/10 bg-black/30 p-3">
                  <div className="mb-1 text-xs font-medium text-orange-400">数据侧证据</div>
                  <p className="text-sm text-gray-300">{conflict.dataEvidence}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/30 p-3">
                  <div className="mb-1 text-xs font-medium text-orange-400">照片侧证据</div>
                  <p className="text-sm text-gray-300">{conflict.photoEvidence}</p>
                </div>
              </div>

              <div className="mb-3 rounded-md border border-cyan-500/30 bg-cyan-500/5 p-3">
                <div className="mb-1 text-xs font-medium text-cyan-400">建议</div>
                <p className="text-sm text-gray-300">{conflict.suggestion}</p>
              </div>

              {overrideReasons[conflict.id] !== undefined && (
                <div className="mb-3">
                  <textarea
                    value={overrideReasons[conflict.id] ?? ''}
                    onChange={(e) =>
                      setOverrideReasons((prev) => ({
                        ...prev,
                        [conflict.id]: e.target.value,
                      }))
                    }
                    placeholder="输入手动覆盖理由..."
                    className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none"
                    rows={2}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    handleResolveConflict(conflict.id, conflict.pointId, 'data_side', '')
                  }
                  className="rounded-md bg-orange-500/20 px-3 py-1.5 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/30"
                >
                  采纳数据侧
                </button>
                <button
                  onClick={() =>
                    handleResolveConflict(conflict.id, conflict.pointId, 'photo_side', '')
                  }
                  className="rounded-md bg-orange-500/20 px-3 py-1.5 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/30"
                >
                  采纳照片侧
                </button>
                <button
                  onClick={() => {
                    if (overrideReasons[conflict.id] === undefined) {
                      setOverrideReasons((prev) => ({ ...prev, [conflict.id]: '' }))
                    } else {
                      const reason = overrideReasons[conflict.id]?.trim()
                      if (!reason) return
                      handleResolveConflict(
                        conflict.id,
                        conflict.pointId,
                        'manual_override',
                        reason
                      )
                      setOverrideReasons((prev) => {
                        const next = { ...prev }
                        delete next[conflict.id]
                        return next
                      })
                    }
                  }}
                  className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30"
                >
                  {overrideReasons[conflict.id] !== undefined ? '确认覆盖' : '手动覆盖'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
