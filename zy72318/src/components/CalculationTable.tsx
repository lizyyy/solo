import { Calculator, AlertTriangle, RefreshCw } from 'lucide-react'
import { useVarStore } from '@/store'

export default function CalculationTable() {
  const { calculations, rows, conflicts } = useVarStore()

  const getRow = (rowId: string) => rows.find((r) => r.id === rowId)

  const pendingConflicts = conflicts.filter((c) => c.status === 'pending')

  return (
    <div className="space-y-5">
      {pendingConflicts.length > 0 && (
        <div className="bg-accent-red/5 border border-accent-red/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-accent-red mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-text-red font-sans font-medium">存在未裁决冲突</p>
            <p className="text-xs text-text-muted font-sans mt-1">
              共 {pendingConflicts.length} 项冲突尚未裁决，计算明细可能受影响。请前往「冲突与复核」页面处理。
            </p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator size={16} className="text-accent-gold" />
            <h3 className="text-sm font-medium text-text-primary font-sans">VaR 计算明细</h3>
          </div>
          <button className="btn-ghost text-xs flex items-center gap-1">
            <RefreshCw size={12} />
            重算
          </button>
        </div>
        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>行号</th>
                <th>投资组合</th>
                <th>VaR 值</th>
                <th>显示格式</th>
                <th>更新时间</th>
                <th>操作人</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {calculations.map((calc) => {
                const row = getRow(calc.rowId)
                const hasConflict = conflicts.some(
                  (c) => c.rowId === calc.rowId && c.status === 'pending'
                )
                const isReview = row?.needsReview
                return (
                  <tr
                    key={calc.id}
                    className={
                      hasConflict
                        ? 'bg-accent-red/5'
                        : isReview
                        ? 'bg-accent-gold/5'
                        : ''
                    }
                  >
                    <td className="text-text-muted">{row?.rowIndex || '-'}</td>
                    <td className="text-text-primary">{row?.fields.portfolio || '-'}</td>
                    <td>
                      <span
                        className={`font-mono text-base ${
                          hasConflict ? 'text-accent-red' : isReview ? 'text-accent-amber' : 'text-text-primary'
                        }`}
                      >
                        {calc.displayValue}
                      </span>
                    </td>
                    <td>
                      {calc.displayFormat === 'percent' ? (
                        <span className="badge-gold">百分数</span>
                      ) : (
                        <span className="badge-muted">小数</span>
                      )}
                    </td>
                    <td className="text-text-secondary text-xs">
                      {new Date(calc.lastUpdated).toLocaleString('zh-CN')}
                    </td>
                    <td className="text-text-secondary text-xs font-sans">{calc.updatedBy}</td>
                    <td>
                      {hasConflict ? (
                        <span className="badge-red">冲突待决</span>
                      ) : isReview ? (
                        <span className="badge-gold">待复核</span>
                      ) : (
                        <span className="badge-green">已确认</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-base-700/50 border border-surface-border rounded-lg p-4">
        <p className="text-xs text-text-muted font-sans">
          💡 百分数/小数混搭的行不会自动归正常，需在「冲突与复核」中由活动负责人复核确认后才能更新。
        </p>
      </div>
    </div>
  )
}
