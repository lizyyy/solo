import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, BarChart3, ArrowLeft, Sliders, ClipboardList, Users, AlertTriangle, CheckCircle } from 'lucide-react'
import { useStore, type CostAllocationResult } from '@/store'
import CostScene3D from '@/components/CostScene3D'
import CostChart from '@/components/CostChart'

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-400' },
    green: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  }
  const c = colorMap[color] || colorMap.blue
  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-4 flex items-center gap-3">
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
  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-amber-500/30 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100" style={{ fontFamily: 'var(--font-title)' }}>计算结果详情</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm">关闭</button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-slate-500">样本ID</span>
          <p className="text-slate-200 font-mono">{result.recordId?.slice(0, 8) ?? result.id.slice(0, 8)}</p>
        </div>
        <div>
          <span className="text-slate-500">分摊成本</span>
          <p className="text-amber-500 font-mono">{result.allocatedCost.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-slate-500">边界类型</span>
          <p className={result.isBoundary ? 'text-rose-400' : 'text-slate-300'}>
            {result.isBoundary ? (result.boundaryType || '是') : '否'}
          </p>
        </div>
      </div>

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
  const { calculationResults, calculationSummary, selectedResult, viewMode, loading, fetchCalculation, setSelectedResult, setViewMode } = useStore()

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

      {calculationSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard icon={Users} label="总样本数" value={calculationSummary.totalSamples} color="blue" />
          <SummaryCard icon={BarChart3} label="总成本" value={calculationSummary.totalCost.toFixed(2)} color="amber" />
          <SummaryCard icon={AlertTriangle} label="边界样本" value={calculationSummary.boundaryCount} color="rose" />
          <SummaryCard icon={CheckCircle} label="待处理" value={calculationSummary.pendingCount} color="green" />
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
