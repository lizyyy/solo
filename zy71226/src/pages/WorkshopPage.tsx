import { useState } from 'react'
import { useStore } from '@/store/useStore'
import CurveEditor from '@/components/CurveEditor'
import BondCard from '@/components/BondCard'
import PortfolioWeights from '@/components/PortfolioWeights'
import PolicyEvents from '@/components/PolicyEvents'
import DurationScore from '@/components/DurationScore'
import PriceChart from '@/components/PriceChart'
import AlertToast from '@/components/AlertToast'
import BatchSelector from '@/components/BatchSelector'
import { RotateCcw, FileCheck } from 'lucide-react'

export default function WorkshopPage() {
  const bonds = useStore(s => s.bonds)
  const selectBond = useStore(s => s.selectBond)
  const selectedBondId = useStore(s => s.selectedBondId)
  const getBondPrice = useStore(s => s.getBondPrice)
  const getBondDuration = useStore(s => s.getBondDuration)
  const resetCurve = useStore(s => s.resetCurve)
  const completeSession = useStore(s => s.completeSession)
  const currentSession = useStore(s => s.currentSession)
  const [showComplete, setShowComplete] = useState(false)

  const handleComplete = () => {
    completeSession()
    setShowComplete(true)
    setTimeout(() => setShowComplete(false), 2500)
  }

  return (
    <div className="min-h-screen bg-navy-900">
      <AlertToast />

      <header className="border-b border-navy-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100">国债收益率曲线工坊</h1>
            <p className="text-xs text-slate-500 mt-0.5">拖拽节点 · 配置组合 · 理解久期</p>
          </div>
          <div className="flex items-center gap-3">
            {currentSession && (
              <span className="text-xs text-slate-400 font-mono">
                📂 {currentSession.batchName}
              </span>
            )}
            <button
              onClick={resetCurve}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-navy-600 hover:border-navy-500 text-slate-400 hover:text-slate-200 text-sm transition-colors"
            >
              <RotateCcw size={14} />
              重置曲线
            </button>
            <button
              onClick={handleComplete}
              disabled={!currentSession}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-navy-900 font-medium text-sm transition-colors"
            >
              <FileCheck size={14} />
              完成练习
            </button>
          </div>
        </div>
      </header>

      <BatchSelector />

      {showComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="glass-panel rounded-xl p-6 animate-slide-up pointer-events-auto">
            <div className="text-4xl mb-2 text-center">🎉</div>
            <h3 className="text-lg font-semibold text-slate-200 text-center">练习已完成</h3>
            <p className="text-sm text-slate-400 text-center mt-1">报告已保存，可前往复盘或报告页查看</p>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-6">
        <PolicyEvents />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-5">
          <div className="lg:col-span-2 space-y-5">
            <CurveEditor />
            <PriceChart />
          </div>

          <div className="space-y-5">
            <DurationScore />
            <PortfolioWeights />
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">债券持仓（点击查看价格走势）</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {bonds.map(bond => (
              <BondCard
                key={bond.id}
                bond={bond}
                price={getBondPrice(bond.id)}
                duration={getBondDuration(bond.id)}
                isSelected={selectedBondId === bond.id}
                onClick={() => selectBond(selectedBondId === bond.id ? null : bond.id)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
