import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, BarChart3, ArrowLeft, Sliders, ClipboardList, Users, AlertTriangle, CheckCircle, Copy, Package, FileDown, Shield } from 'lucide-react'
import { useStore, type CostAllocationResult } from '@/store'
import CostScene3D from '@/components/CostScene3D'
import CostChart from '@/components/CostChart'

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {})
}

function SummaryCard({ icon: Icon, label, value, color, pulse }: { icon: any; label: string; value: number | string; color: string; pulse?: boolean }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-400' },
    green: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  }
  const c = colorMap[color] || colorMap.blue
  return (
    <div className={`bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-4 flex items-center gap-3 ${pulse ? 'animate-pulse-amber' : ''}`}>
      <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
        <Icon size={20} className={c.text} />
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`text-lg font-bold ${c.text}`}>{value}</p>
      </div>
    </div>
  )
}

function DetailPanel({ result, onClose }: { result: CostAllocationResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const traceableId = result.traceableId ?? result.recordId ?? result.id
  const isPending = result.boundaryStatus === 'pending' || (result.isBoundary && !result.boundaryStatus)

  const handleCopy = () => {
    copyToClipboard(traceableId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-amber-500/30 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100" style={{ fontFamily: 'var(--font-title)' }}>计算结果详情</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm">关闭</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <div>
          <span className="text-slate-500 block text-xs mb-1">可追溯ID</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-200 font-mono text-xs">{traceableId.slice(0, 12)}</span>
            <button onClick={handleCopy} className="text-slate-500 hover:text-amber-500">
              <Copy size={12} />
              {copied && <span className="text-emerald-400 text-xs ml-1">已复制</span>}
            </button>
          </div>
        </div>
        <div>
          <span className="text-slate-500 block text-xs mb-1">批次号</span>
          <div className="flex items-center gap-1">
            <Package size={12} className="text-slate-500" />
            <span className="text-slate-300 font-mono text-xs">
              {result.batchId ? result.batchId.slice(0, 8) : '-'}
            </span>
          </div>
        </div>
        <div>
          <span className="text-slate-500 block text-xs mb-1">分摊成本</span>
          <p className="text-amber-500 font-mono">{result.allocatedCost.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-slate-500 block text-xs mb-1">边界类型</span>
          <p className={result.isBoundary ? 'text-rose-400' : 'text-slate-300'}>
            {result.isBoundary ? (result.boundaryType || '是') : '否'}
          </p>
        </div>
        <div>
          <span className="text-slate-500 block text-xs mb-1">来源参数</span>
          <p className="text-slate-300 text-xs font-mono">
            unit_cost={result.unitCost ?? '-'} / ratio={result.allocationRatio ?? '-'}
          </p>
        </div>
        <div>
          <span className="text-slate-500 block text-xs mb-1">下一步找谁</span>
          <p className={isPending ? 'text-amber-400 flex items-center gap-1' : 'text-emerald-400'}>
            {isPending ? (
              <>
                <Shield size={12} />
                联系教研负责人吴老师确认
              </>
            ) : (
              <>无需操作</>
            )}
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-600 border-t border-slate-700/50 pt-3">
        ℹ 本面板与边界样本报告、抽样名单详情读取同一条记录，状态一致
      </p>

      <div className="flex gap-3 pt-2">
        <Link to={`/sampling/${result.sourceListId}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-amber-500 transition-colors">
          <ClipboardList size={14} />
          回到抽样名单
        </Link>
        <Link to="/params" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-amber-500 transition-colors">
          <Sliders size={14} />
          回到参数调试表
        </Link>
      </div>
    </div>
  )
}

export default function Calculation() {
  const { calculationResults, calculationSummary, selectedResult, viewMode, loading, fetchCalculation, setSelectedResult, setViewMode, exportCalculation } = useStore()

  useEffect(() => {
    fetchCalculation()
  }, [])

  const handleSelect = (result: CostAllocationResult) => {
    setSelectedResult(result)
  }

  if (loading.calculation) {
    return <div className="text-slate-400 text-center py-12">加载计算结果...</div>
  }

  if (!calculationSummary && calculationResults.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: 'var(--font-title)' }}>公平分摊成本计算</h2>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
          <AlertTriangle size={48} className="mx-auto mb-4 text-slate-600" />
          <p className="text-slate-400">暂无计算结果，请先导入抽样名单并配置参数</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: 'var(--font-title)' }}>公平分摊成本计算</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCalculation}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-700/50 border border-slate-600 text-slate-300 rounded-lg text-sm hover:bg-slate-700 hover:text-amber-500 transition-colors"
          >
            <FileDown size={16} />
            导出计算明细 CSV
          </button>
          <div className="flex gap-1 bg-slate-800/50 rounded-lg border border-slate-700/50 p-1">
            <button
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === '3d' ? 'bg-amber-500 text-slate-900 font-medium' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Box size={16} />
              3D 视图
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === 'chart' ? 'bg-amber-500 text-slate-900 font-medium' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <BarChart3 size={16} />
              图表视图
            </button>
          </div>
        </div>
      </div>

      {calculationSummary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard icon={Users} label="总样本数" value={calculationSummary.totalSamples} color="blue" />
          <SummaryCard icon={BarChart3} label="总成本" value={calculationSummary.totalCost.toFixed(2)} color="amber" />
          <SummaryCard icon={AlertTriangle} label="边界样本" value={calculationSummary.boundaryCount} color="rose" />
          <SummaryCard icon={CheckCircle} label="待处理" value={calculationSummary.pendingCount} color="green" />
          <SummaryCard icon={Package} label="批次数量" value={calculationSummary.batchCount ?? '-'} color="blue" />
          <SummaryCard icon={Shield} label="需要复核" value={calculationSummary.needReviewCount ?? calculationSummary.pendingCount} color="amber" pulse={calculationSummary.needReviewCount ? calculationSummary.needReviewCount > 0 : calculationSummary.pendingCount > 0} />
        </div>
      )}

      {viewMode === '3d' ? (
        <CostScene3D results={calculationResults} onSelect={handleSelect} />
      ) : (
        <CostChart results={calculationResults} onSelect={handleSelect} />
      )}

      {selectedResult && (
        <DetailPanel result={selectedResult} onClose={() => setSelectedResult(null)} />
      )}
    </div>
  )
}
