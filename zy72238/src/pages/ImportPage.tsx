import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { Upload, Trash2, AlertCircle, AlertTriangle, Info, CheckCircle2, RefreshCw, User, Shield } from 'lucide-react'
import type { SelfCheckResult } from '@/types'

const severityConfig: Record<SelfCheckResult['severity'], { border: string; icon: typeof AlertCircle; color: string }> = {
  error: { border: 'border-l-red-500', icon: AlertCircle, color: 'text-red-400' },
  warning: { border: 'border-l-amber-500', icon: AlertTriangle, color: 'text-amber-400' },
  info: { border: 'border-l-blue-500', icon: Info, color: 'text-blue-400' },
}

const typeLabel = (type: 'principal' | 'fee') => type === 'principal' ? '本金' : '手续费'
const statusLabel: Record<string, string> = {
  normal: '正常',
  pending_review: '待复核',
  reviewed: '已复核',
  rejected: '已退回',
}
const statusBadge: Record<string, string> = {
  normal: 'bg-emerald-500/20 text-emerald-400',
  pending_review: 'bg-amber-500/20 text-amber-400',
  reviewed: 'bg-blue-500/20 text-blue-400',
  rejected: 'bg-red-500/20 text-red-400',
}

function CheckResultCard({ result }: { result: SelfCheckResult }) {
  const config = severityConfig[result.severity]
  const Icon = config.icon
  return (
    <div className={`flex items-start gap-3 rounded-lg border-l-4 ${config.border} bg-slate-700/30 p-3`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.color}`} />
      <span className="text-sm text-slate-300">{result.message}</span>
    </div>
  )
}

function RoleSwitcher() {
  const { currentRole, setCurrentRole } = useStore()
  const roles = [
    { key: 'operator' as const, label: '对账运营', icon: User },
    { key: 'supervisor' as const, label: '结算主管', icon: Shield },
  ]
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-700/50 p-1">
      <span className="pl-2 text-xs text-slate-400">当前角色：</span>
      {roles.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setCurrentRole(key)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            currentRole === key ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

export default function ImportPage() {
  const { transactions, selfCheckResults, importTransactions, runSelfCheck } = useStore()
  const [rawData, setRawData] = useState('')

  const handleImport = () => {
    if (!rawData.trim()) return
    const lines = rawData.trim().split('\n').filter((l) => l.trim())
    const rows = lines.map((line) => {
      const [businessNo, typeStr, amountStr, counterTailNo] = line.split(',').map((s) => s.trim())
      return {
        businessNo,
        type: (typeStr === '本金' ? 'principal' : 'fee') as 'principal' | 'fee',
        amount: Number(amountStr),
        counterTailNo,
      }
    }).filter((r) => r.businessNo && r.type && !isNaN(r.amount) && r.counterTailNo)
    if (rows.length > 0) {
      importTransactions(rows)
      setRawData('')
    }
  }

  const handleClear = () => setRawData('')

  const allPassed = selfCheckResults.length === 0 && transactions.length > 0

  return (
    <div className="min-h-screen bg-slate-900 p-6 font-['Noto_Sans_SC',sans-serif]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">柜台流水导入与自检</h1>
          <p className="mt-1 text-sm text-slate-400">粘贴柜台流水数据完成批量导入，系统将自动执行合规自检</p>
        </header>

        <div className="grid grid-cols-5 gap-5">
          <div className="col-span-3 rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 shadow">
            <RoleSwitcher />
            <label className="mt-4 block text-sm font-medium text-slate-300">流水数据</label>
            <textarea
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              placeholder={'OTC-2024001,本金,500000,T001\nOTC-2024001,手续费,2500,T001'}
              className="mt-2 h-48 w-full resize-none rounded-lg border border-slate-600/50 bg-slate-900/60 p-3 font-['JetBrains_Mono',monospace] text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
            />
            <div className="mt-3 flex gap-3">
              <button
                onClick={handleImport}
                disabled={!rawData.trim()}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600"
              >
                <Upload className="h-4 w-4" />
                导入
              </button>
              <button
                onClick={handleClear}
                className="flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-500"
              >
                <Trash2 className="h-4 w-4" />
                清空
              </button>
            </div>
          </div>

          <div className="col-span-2 rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">自检结果</h2>
              <button
                onClick={runSelfCheck}
                className="flex items-center gap-1.5 rounded-lg bg-slate-700/50 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-600 hover:text-slate-100"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重新自检
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {allPassed ? (
                <div className="flex items-center gap-3 rounded-lg border-l-4 border-l-emerald-500 bg-slate-700/30 p-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span className="text-sm text-emerald-300">所有自检项通过，数据无异常</span>
                </div>
              ) : selfCheckResults.length > 0 ? (
                selfCheckResults.map((r, i) => <CheckResultCard key={i} result={r} />)
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">尚未执行自检</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 shadow">
          <h2 className="text-sm font-semibold text-slate-200">已导入数据</h2>
          {transactions.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              暂无导入数据，请在左侧粘贴柜台流水数据后点击导入
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 text-xs text-slate-400">
                    <th className="pb-2 pr-4 font-medium">业务号</th>
                    <th className="pb-2 pr-4 font-medium">类型</th>
                    <th className="pb-2 pr-4 font-medium text-right">金额</th>
                    <th className="pb-2 pr-4 font-medium">柜台流水尾号</th>
                    <th className="pb-2 pr-4 font-medium">状态</th>
                    <th className="pb-2 font-medium">导入时间</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, i) => (
                    <tr key={i} className="border-b border-slate-700/30">
                      <td className="py-2.5 pr-4 font-['JetBrains_Mono',monospace] text-slate-200">{tx.businessNo}</td>
                      <td className="py-2.5 pr-4 text-slate-300">{typeLabel(tx.type)}</td>
                      <td className="py-2.5 pr-4 text-right font-['JetBrains_Mono',monospace] text-slate-200">
                        {tx.amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4 font-['JetBrains_Mono',monospace] text-slate-300">{tx.counterTailNo}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[tx.status] ?? 'bg-slate-600/30 text-slate-400'}`}>
                          {statusLabel[tx.status] ?? tx.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs text-slate-400">{tx.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
