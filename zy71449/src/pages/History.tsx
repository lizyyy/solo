import { useEffect, useState } from 'react'
import { useCubeStore } from '@/store/useCubeStore'
import { ANOMALY_LABELS, SEVERITY_COLORS } from '@/engine/anomalyEngine'
import {
  History,
  Trash2,
  Eye,
  GitCompare,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { LossCubeSnapshot } from '@/types'

export default function HistoryPage() {
  const snapshots = useCubeStore(s => s.snapshots)
  const loadSnapshots = useCubeStore(s => s.loadSnapshots)
  const loadSnapshotData = useCubeStore(s => s.loadSnapshotData)
  const deleteSnapshot = useCubeStore(s => s.deleteSnapshot)
  const typhoonEvents = useCubeStore(s => s.typhoonEvents)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null)

  useEffect(() => {
    loadSnapshots()
  }, [loadSnapshots])

  const handleLoad = async (id: string) => {
    await loadSnapshotData(id)
  }

  const toggleCompare = (id: string) => {
    if (!compareIds) {
      setCompareIds([id, ''])
    } else if (compareIds[1] === '') {
      if (compareIds[0] === id) return
      setCompareIds([compareIds[0], id])
    } else {
      setCompareIds(null)
    }
  }

  const compareData = compareIds && compareIds[1]
    ? {
        a: snapshots.find(s => s.id === compareIds[0]),
        b: snapshots.find(s => s.id === compareIds[1]),
      }
    : null

  const getTyphoonName = (id: string) =>
    typhoonEvents.find(t => t.id === id)?.name || id

  const formatParams = (snapshot: LossCubeSnapshot) => {
    const p = snapshot.parameters
    return [
      `台风: ${getTyphoonName(p.typhoonId)}`,
      `地区: ${p.regionIds.length}个`,
      `阈值: ¥${(p.claimThreshold / 10000).toFixed(0)}万`,
      `异常: ${snapshot.anomalies.length}条`,
    ]
  }

  return (
    <div className="min-h-screen bg-[#060E1A] text-[#E0E8F0]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <History size={24} className="text-[#00D4FF]" />
            <div>
              <h1 className="text-xl font-bold">历史记录</h1>
              <p className="text-xs text-[#7B8CA8] mt-0.5">保险灾害损失立方 · 审计追溯</p>
            </div>
          </div>
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-[#0D1B2E] text-[#00D4FF] border border-[#1B3054] hover:border-[#00D4FF]/40 transition-all"
          >
            <ArrowLeft size={14} />
            返回立方
          </Link>
        </div>

        {compareIds && (
          <div className="mb-4 px-4 py-2 rounded bg-[#0D1B2E] border border-[#00D4FF]/20 text-xs flex items-center justify-between">
            <span className="text-[#00D4FF]">
              对比模式: {compareIds[1] ? '选择完毕，查看下方对比' : '请选择第二个快照'}
            </span>
            <button
              onClick={() => setCompareIds(null)}
              className="text-[#5A6E8A] hover:text-[#E0E8F0]"
            >
              取消
            </button>
          </div>
        )}

        {compareData?.a && compareData.b && (
          <div className="mb-6 bg-[#0A1422] rounded border border-[#1B3054] overflow-hidden">
            <div className="px-4 py-2 border-b border-[#1B3054] flex items-center gap-2">
              <GitCompare size={14} className="text-[#00D4FF]" />
              <span className="text-sm font-semibold">快照对比</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-[#1B3054]">
              {[
                { data: compareData.a, label: 'A' },
                { data: compareData.b, label: 'B' },
              ].map(({ data: snap, label }) => (
                <div key={label} className="p-4 space-y-2">
                  <div className="text-xs text-[#7B8CA8]">快照 {label}</div>
                  <div className="text-sm font-semibold">{snap!.name}</div>
                  <div className="space-y-1 text-[10px]">
                    {formatParams(snap!).map((line, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between px-2 py-1 rounded ${
                          formatParams(compareData.a!)[i] !== formatParams(compareData.b!)[i]
                            ? 'bg-[#FF6B35]/10 text-[#FF6B35]'
                            : 'text-[#7B8CA8]'
                        }`}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-[#5A6E8A]">
                    创建: {new Date(snap!.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {snapshots.length === 0 ? (
          <div className="text-center py-20">
            <History size={48} className="text-[#1B3054] mx-auto mb-4" />
            <p className="text-[#5A6E8A] text-sm">暂无历史记录</p>
            <p className="text-[#3A4A60] text-xs mt-1">在损失立方中保存快照后，记录将出现在此处</p>
          </div>
        ) : (
          <div className="space-y-3">
            {snapshots.map(snap => (
              <div
                key={snap.id}
                className="bg-[#0A1422] rounded border border-[#1B3054] overflow-hidden hover:border-[#2A4060] transition-all"
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-[#0D1B2E] border border-[#1B3054] flex items-center justify-center">
                      <History size={18} className="text-[#00D4FF]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{snap.name}</div>
                      <div className="text-[10px] text-[#5A6E8A] mt-0.5">
                        {getTyphoonName(snap.typhoonId)} · {new Date(snap.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {snap.anomalies.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[#FF6B35]/10 text-[#FF6B35]">
                        <AlertTriangle size={10} />
                        {snap.anomalies.filter(a => !a.acknowledged).length} 异常
                      </span>
                    )}

                    <button
                      onClick={() => toggleCompare(snap.id)}
                      className={`p-1.5 rounded transition-all ${
                        compareIds && (compareIds[0] === snap.id || compareIds[1] === snap.id)
                          ? 'bg-[#00D4FF]/15 text-[#00D4FF]'
                          : 'text-[#5A6E8A] hover:text-[#E0E8F0]'
                      }`}
                      title="对比"
                    >
                      <GitCompare size={14} />
                    </button>

                    <Link
                      to="/"
                      onClick={() => handleLoad(snap.id)}
                      className="p-1.5 rounded text-[#5A6E8A] hover:text-[#00D4FF] transition-all"
                      title="加载"
                    >
                      <Eye size={14} />
                    </Link>

                    <button
                      onClick={() => deleteSnapshot(snap.id)}
                      className="p-1.5 rounded text-[#5A6E8A] hover:text-[#FF6B35] transition-all"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>

                    <button
                      onClick={() => setExpandedId(expandedId === snap.id ? null : snap.id)}
                      className="p-1.5 rounded text-[#5A6E8A] hover:text-[#E0E8F0] transition-all"
                    >
                      {expandedId === snap.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {expandedId === snap.id && (
                  <div className="px-4 pb-4 space-y-4 border-t border-[#1B3054] pt-3">
                    <div>
                      <div className="text-[10px] text-[#7B8CA8] mb-1.5">参数快照</div>
                      <div className="grid grid-cols-3 gap-2">
                        {formatParams(snap).map((line, i) => (
                          <div key={i} className="text-xs px-2 py-1.5 bg-[#0D1B2E] rounded border border-[#1B3054]">
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>

                    {snap.anomalies.length > 0 && (
                      <div>
                        <div className="text-[10px] text-[#7B8CA8] mb-1.5 flex items-center gap-1">
                          <AlertTriangle size={10} />
                          异常记录
                        </div>
                        <div className="space-y-1">
                          {snap.anomalies.map(a => (
                            <div
                              key={a.id}
                              className="flex items-start gap-2 px-2 py-1.5 bg-[#0D1B2E] rounded border border-[#1B3054] text-[10px]"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1"
                                style={{ background: SEVERITY_COLORS[a.severity] }}
                              />
                              <div className="flex-1">
                                <div className="text-[#E0E8F0]">{ANOMALY_LABELS[a.type]}</div>
                                <div className="text-[#7B8CA8] mt-0.5">{a.description}</div>
                                <div className="text-[#5A6E8A] mt-0.5">
                                  {a.acknowledged ? '已确认' : '待确认'} · {a.sourceType}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {snap.decisions.length > 0 && (
                      <div>
                        <div className="text-[10px] text-[#7B8CA8] mb-1.5 flex items-center gap-1">
                          <FileText size={10} />
                          处理决策 (审计追溯)
                        </div>
                        <div className="relative pl-4 border-l border-[#1B3054] space-y-3">
                          {snap.decisions.map(d => (
                            <div key={d.id} className="relative">
                              <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-[#00D4FF] border-2 border-[#0A1422]" />
                              <div className="text-[10px]">
                                <div className="text-[#E0E8F0] font-medium">{d.action}</div>
                                <div className="text-[#7B8CA8] mt-0.5">{d.reason}</div>
                                <div className="text-[#5A6E8A] mt-0.5">
                                  {d.operator} · {new Date(d.timestamp).toLocaleString('zh-CN')}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
