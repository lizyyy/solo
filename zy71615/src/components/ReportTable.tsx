import { useState } from 'react'
import { useGameStore, getReportData } from '../store/gameStore'
import { ERROR_TYPE_LABELS } from '../engine/types'
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Clock, Package, DollarSign, Ship, Shield, FileCheck } from 'lucide-react'
import { exportLedgerCSV, exportReportJSON } from '../utils/export'
import { Download } from 'lucide-react'

export function ReportTable() {
  const { reports, roundSnapshots, balance, initialBalance, replayRound, setReplayRound, ledger } = useGameStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const reportData = getReportData()

  const stageIcons: Record<string, React.ReactNode> = {
    order_selected: <Package size={14} />,
    container_assigned: <Ship size={14} />,
    rate_locked: <DollarSign size={14} />,
    cabin_booked: <Clock size={14} />,
    breach_checked: <Shield size={14} />,
    settled: <FileCheck size={14} />,
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="text-slate-400 text-sm mb-1">总利润</div>
          <div className={`text-2xl font-bold ${balance >= initialBalance ? 'text-green-400' : 'text-red-400'}`}>
            {balance - initialBalance >= 0 ? '+' : ''}¥{(balance - initialBalance).toLocaleString()}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="text-slate-400 text-sm mb-1">交易笔数</div>
          <div className="text-2xl font-bold text-white">{reports.length}</div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="text-slate-400 text-sm mb-1">错误次数</div>
          <div className="text-2xl font-bold text-red-400">
            {reports.filter(r => r.hasError).length}
          </div>
        </div>
      </div>

      {reportData.errorSummary.length > 0 && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <h4 className="text-red-400 font-medium mb-2 flex items-center gap-2">
            <AlertTriangle size={16} />
            错误汇总
          </h4>
          <div className="flex flex-wrap gap-2">
            {reportData.errorSummary.map(e => (
              <span key={e.type} className="bg-red-900/50 text-red-300 px-3 py-1 rounded text-sm">
                {e.label}: {e.count} 次
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-amber-400 font-serif text-lg">交易追溯</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportLedgerCSV(ledger)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm transition-colors"
            >
              <Download size={14} />
              导出账本 CSV
            </button>
            <button
              onClick={() => exportReportJSON(reports, roundSnapshots)}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-slate-900 rounded text-sm font-medium transition-colors"
            >
              <Download size={14} />
              导出报告 JSON
            </button>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            暂无交易记录
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {[...reports].reverse().map(entry => (
              <div key={entry.id}>
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/30 transition-colors"
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                >
                  <div className="flex items-center gap-4">
                    {expandedId === entry.id ? (
                      <ChevronDown size={16} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={16} className="text-slate-400" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{entry.orderId}</span>
                        <span className="text-slate-400 text-sm">回合 {entry.round}</span>
                        {entry.hasError ? (
                          <AlertTriangle size={14} className="text-red-400" />
                        ) : (
                          <CheckCircle size={14} className="text-green-400" />
                        )}
                      </div>
                      {entry.hasError && (
                        <div className="flex items-center gap-1 mt-1">
                          {entry.errorTypes.map(et => (
                            <span key={et} className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded">
                              {ERROR_TYPE_LABELS[et]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`font-bold ${entry.finalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {entry.finalProfit >= 0 ? '+' : ''}¥{entry.finalProfit.toLocaleString()}
                  </div>
                </div>

                {expandedId === entry.id && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="bg-slate-900 rounded-lg p-4">
                      <div className="relative">
                        {entry.steps.map((step, i) => (
                          <div key={i} className="flex gap-4 pb-4 last:pb-0">
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                step.value === null ? 'bg-slate-700 text-slate-400' :
                                step.value >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                              }`}>
                                {stageIcons[step.stage]}
                              </div>
                              {i < entry.steps.length - 1 && (
                                <div className="w-px h-full bg-slate-700 mt-1" />
                              )}
                            </div>
                            <div className="flex-1 pt-1">
                              <div className="text-slate-300">{step.description}</div>
                              {step.value !== null && (
                                <div className={`text-sm font-medium mt-1 ${
                                  step.value >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {step.value >= 0 ? '+' : ''}¥{step.value.toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
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
