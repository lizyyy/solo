import { useStore } from '@/store/useStore'
import StepProgress from '@/components/StepProgress'
import RecordCard from '@/components/RecordCard'
import ConflictBanner from '@/components/ConflictBanner'
import { TrendingUp, Shield, FilePlus, AlertTriangle } from 'lucide-react'

export default function Overview() {
  const records = useStore((s) => s.records)
  const riskReviews = useStore((s) => s.riskReviews)
  const pendingRisk = records.filter((r) => r.status === '待风控复核')
  const normalCount = records.filter((r) => r.status === '正常').length
  const supplementCount = records.filter((r) => r.status === '尾差补录').length
  const totalAmount = records.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h2
          className="text-2xl font-bold text-[#1a365d] mb-1"
          style={{ fontFamily: '"Noto Serif SC", serif' }}
        >
          试算总览
        </h2>
        <p className="text-sm text-slate-400">ABS 现金流瀑布试算 · 双源证据合并结果</p>
      </div>

      <div className="mb-8">
        <StepProgress />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">汇总金额</p>
              <p className="text-lg font-bold text-slate-800 font-mono">
                ¥{totalAmount.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <TrendingUp size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">正常记录</p>
              <p className="text-lg font-bold text-slate-800">{normalCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <FilePlus size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">尾差补录</p>
              <p className="text-lg font-bold text-slate-800">{supplementCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <Shield size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">待风控复核</p>
              <p className="text-lg font-bold text-red-600">{pendingRisk.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <ConflictBanner />
      </div>

      {pendingRisk.length > 0 && (
        <div className="mb-6 rounded-xl border-2 border-red-200 bg-red-50/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-red-500" />
            <h3 className="text-sm font-semibold text-red-800">待风控复核条目</h3>
          </div>
          <p className="text-xs text-red-600 mb-3">
            以下记录金额为 0 且备注"已冲正"，不自动归入正常，需风控同事复核
          </p>
          <div className="space-y-3">
            {pendingRisk.map((r) => (
              <div key={r.id} className="bg-white rounded-lg border border-red-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">金额 ¥0 · 备注：{r.remark}</p>
                  </div>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                    待风控复核
                  </span>
                </div>
                {riskReviews.filter((rv) => rv.recordId === r.id).map((rv) => (
                  <div key={rv.id} className="mt-2 pt-2 border-t border-red-100">
                    <p className="text-xs text-slate-600">
                      风控意见：{rv.opinion} — {rv.comment}（{rv.reviewer}，{new Date(rv.reviewedAt).toLocaleString('zh-CN')}）
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-600">试算记录</h3>
        <p className="text-xs text-slate-400">共 {records.length} 条</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {records.map((record) => (
          <RecordCard key={record.id} record={record} />
        ))}
      </div>
    </div>
  )
}
