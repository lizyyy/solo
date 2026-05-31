import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettlementStore } from '@/store/settlement'
import StatusFilterBar from '@/components/StatusFilterBar'
import StatusBadge from '@/components/StatusBadge'
import { Download, RefreshCw, AlertTriangle, Copy, FileWarning } from 'lucide-react'
import type { Settlement, StatusFilter } from '@shared/types'

function formatMoney(v: number | null): string {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SettlementList() {
  const { settlements, statusFilter, loading, fetchSettlements, setStatusFilter, exportCsv, reload } = useSettlementStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchSettlements()
  }, [])

  return (
    <div className="min-h-screen bg-[#f5f5f4]">
      <header className="bg-[#1e3a5f] text-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-medium tracking-wide">直播打赏分成结算</h1>
          <div className="flex gap-2">
            <button
              onClick={reload}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重跑数据
            </button>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              导出CSV
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-4">
        <StatusFilterBar current={statusFilter} onChange={(f: StatusFilter) => setStatusFilter(f)} />

        {loading && <p className="py-8 text-center text-stone-400">加载中...</p>}

        {!loading && settlements.length === 0 && (
          <p className="py-8 text-center text-stone-400">暂无记录</p>
        )}

        {!loading && settlements.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-stone-100 text-left text-stone-600">
                  <th className="px-3 py-2.5 font-medium border-b border-stone-200">标记</th>
                  <th className="px-3 py-2.5 font-medium border-b border-stone-200">主播ID</th>
                  <th className="px-3 py-2.5 font-medium border-b border-stone-200">主播名称</th>
                  <th className="px-3 py-2.5 font-medium border-b border-stone-200 text-right font-mono">打赏总额</th>
                  <th className="px-3 py-2.5 font-medium border-b border-stone-200 text-right font-mono">退款金额</th>
                  <th className="px-3 py-2.5 font-medium border-b border-stone-200 text-right font-mono">分成比例</th>
                  <th className="px-3 py-2.5 font-medium border-b border-stone-200 text-right font-mono">结算金额</th>
                  <th className="px-3 py-2.5 font-medium border-b border-stone-200">状态</th>
                  <th className="px-3 py-2.5 font-medium border-b border-stone-200">变更</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s: Settlement, i: number) => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/settlement/${s.id}`)}
                    className={`cursor-pointer hover:bg-blue-50 transition-colors border-b border-stone-100 ${
                      i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        {s.hasEmptyFields && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700">
                            <FileWarning className="h-3 w-3" />未填写
                          </span>
                        )}
                        {s.isDuplicate && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700">
                            <Copy className="h-3 w-3" />疑似重复
                          </span>
                        )}
                        {s.isFullRefund && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700">
                            <AlertTriangle className="h-3 w-3" />全额退款
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-stone-600">{s.anchorId}</td>
                    <td className="px-3 py-2.5 text-stone-800">{s.anchorName}</td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {s.totalTip !== null ? formatMoney(s.totalTip) : <span className="text-red-500 text-xs">未填写</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {s.refundAmount !== null ? formatMoney(s.refundAmount) : <span className="text-red-500 text-xs">未填写</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {s.shareRate !== null ? `${(s.shareRate * 100).toFixed(0)}%` : <span className="text-red-500 text-xs">未填写</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium">
                      {s.settlementAmount !== null ? formatMoney(s.settlementAmount) : <span className="text-red-500 text-xs">未填写</span>}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-2.5 text-stone-400 text-xs">
                      {s.hasChangeHistory ? '有' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
