import { Calculator, AlertTriangle, RefreshCw, Eye, Send, History } from 'lucide-react'
import { useVarStore } from '@/store'

export default function CalculationTable() {
  const {
    calculations,
    rows,
    conflicts,
    recalculate,
    setSelectedRowId,
    releaseCalculation,
  } = useVarStore()

  const getRow = (rowId: string) => rows.find((r) => r.id === rowId)

  const pendingConflicts = conflicts.filter((c) => c.status === 'pending')

  const handleRecalcAll = () => {
    recalculate('all', '唐老师', '点击全量重算按钮')
  }

  const handleRecalcOne = (rowId: string) => {
    recalculate(rowId, '唐老师', '单行重算')
  }

  return (
    <div className="space-y-5">
      {pendingConflicts.length > 0 && (
        <div className="bg-accent-red/5 border border-accent-red/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-accent-red mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-text-red font-sans font-medium">存在未裁决冲突</p>
            <p className="text-xs text-text-muted font-sans mt-1">
              共 {pendingConflicts.length} 项冲突尚未裁决。冲突确认并回写至原字段后会自动触发重算，
              <span className="text-accent-amber">原始说法始终保存在 originalFields 中，不会被系统静默清洗</span>。
            </p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator size={16} className="text-accent-gold" />
            <h3 className="text-sm font-medium text-text-primary font-sans">VaR 计算明细</h3>
            <span className="badge-muted">{calculations.length} 条</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRecalcAll} className="btn-primary text-xs flex items-center gap-1.5 py-1.5">
              <RefreshCw size={12} />
              全量重算
            </button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>行号</th>
                <th>投资组合</th>
                <th>原始VaR</th>
                <th>当前VaR</th>
                <th>版本</th>
                <th>更新人/来源</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {calculations.map((calc) => {
                const row = getRow(calc.rowId)
                const hasConflict = conflicts.some(
                  (c) => c.rowId === calc.rowId && c.status === 'pending'
                )
                const isReview = row?.needsReview
                const changed = calc.versionHistory.length > 1
                return (
                  <tr
                    key={calc.id}
                    className={
                      hasConflict
                        ? 'bg-accent-red/5'
                        : isReview
                        ? 'bg-accent-gold/5'
                        : changed
                        ? 'bg-accent-green/5'
                        : ''
                    }
                  >
                    <td className="text-text-muted">{row?.rowIndex || '-'}</td>
                    <td className="text-text-primary">{row?.fields.portfolio || '-'}</td>
                    <td className="text-text-muted font-mono text-xs">
                      {calc.originalDisplayValue}
                      <span className="text-text-muted/50 ml-1">v1</span>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span
                          className={`font-mono text-base ${
                            hasConflict
                              ? 'text-accent-red'
                              : isReview
                              ? 'text-accent-amber'
                              : 'text-text-gold'
                          }`}
                        >
                          {calc.displayValue}
                        </span>
                        {changed && (
                          <span className="text-[10px] font-sans text-text-muted flex items-center gap-1">
                            <History size={9} />
                            已变更{calc.versionHistory.length - 1}次
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="badge-gold">v{calc.recalcVersion}</span>
                    </td>
                    <td className="text-xs font-sans">
                      <div className="text-text-secondary">{calc.updatedBy}</div>
                      <div className="text-text-muted truncate max-w-[120px]" title={calc.recalcSource}>
                        {calc.recalcSource}
                      </div>
                    </td>
                    <td>
                      {hasConflict ? (
                        <span className="badge-red">冲突待决</span>
                      ) : isReview ? (
                        <span className="badge-gold">
                          待复核 → {row?.reviewOwner || '负责人'}
                        </span>
                      ) : calc.released ? (
                        <span className="badge-green">已发布</span>
                      ) : (
                        <span className="badge-muted">草稿</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => row && setSelectedRowId(row.id)}
                          className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-gold transition-colors"
                          title="查看复核详情"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleRecalcOne(calc.rowId)}
                          className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                          title="重算此行"
                        >
                          <RefreshCw size={14} />
                        </button>
                        {!calc.released && !isReview && row?.formatType !== 'mixed' && (
                          <button
                            onClick={() => releaseCalculation(calc.id, '活动负责人')}
                            className="p-1.5 rounded hover:bg-accent-green/10 text-text-muted hover:text-text-green transition-colors"
                            title="释放发布"
                          >
                            <Send size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-base-700/50 border border-surface-border rounded-lg p-4">
          <p className="text-xs text-text-gold font-sans font-medium mb-2">
            ⚠ 百分数/小数混搭记录
          </p>
          <p className="text-xs text-text-muted font-sans leading-relaxed">
            有 <span className="text-accent-amber font-mono">{rows.filter(r => r.formatType === 'mixed').length}</span> 条记录存在格式混搭。
            这类记录<strong className="text-accent-amber">绝不会自动归正常</strong>，需活动负责人人工复核后才能释放发布。
            原始说法始终保存在 <code className="text-text-gold text-[10px] bg-base-800 px-1 rounded">originalFields</code> 中。
          </p>
        </div>
        <div className="bg-base-700/50 border border-surface-border rounded-lg p-4">
          <p className="text-xs text-text-green font-sans font-medium mb-2">
            ✓ 同源数据保障
          </p>
          <p className="text-xs text-text-muted font-sans leading-relaxed">
            导出明细、页面展示、接口返回三者都从 Zustand store 同一份数据读取。
            点击任一计算行的 <Eye size={9} className="inline" /> 可查看原值、改值、变更原因、版本历史、下一步处理人。
          </p>
        </div>
      </div>
    </div>
  )
}
