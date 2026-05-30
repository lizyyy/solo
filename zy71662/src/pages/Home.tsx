import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import * as api from '@/lib/api'
import { Play, Save, Download, Plus, ChevronRight } from 'lucide-react'
import { getSchemeStatusColor, statusLabel } from '@/lib/helpers'
import PointsTab from './PointsTab'
import FixturesTab from './FixturesTab'
import ForceTab from './ForceTab'
import VerificationTab from './VerificationTab'
import RisksTab from './RisksTab'

const tabs = [
  { key: 'points' as const, label: '吊点面板' },
  { key: 'fixtures' as const, label: '灯具分配' },
  { key: 'force' as const, label: '受力分解' },
  { key: 'verification' as const, label: '载荷校验' },
  { key: 'risks' as const, label: '风险项' },
]

export default function Home() {
  const currentSchemeId = useStore((s) => s.currentSchemeId)
  const schemeDetail = useStore((s) => s.schemeDetail)
  const activeTab = useStore((s) => s.activeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const runCalculation = useStore((s) => s.runCalculation)
  const createSnapshot = useStore((s) => s.createSnapshot)
  const isLoading = useStore((s) => s.isLoading)

  useEffect(() => {
    if (currentSchemeId) runCalculation(currentSchemeId)
  }, [currentSchemeId])

  const handleExport = async () => {
    if (!currentSchemeId) return
    const { filename } = await api.generateReport(currentSchemeId)
    window.open(`/api/reports/download/${filename}`, '_blank')
  }

  if (!schemeDetail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-4">
        <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center">
          <ChevronRight size={32} className="text-zinc-600" />
        </div>
        <p className="text-lg">请先选择一个方案</p>
      </div>
    )
  }

  const scheme = schemeDetail.scheme

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="flex items-center gap-4 border-b border-zinc-700 px-6 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-zinc-100">{scheme.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded ${getSchemeStatusColor(scheme.status)} bg-zinc-800`}>
            {statusLabel(scheme.status)}
          </span>
        </div>
        <span className="text-sm text-zinc-400">安全系数: <span className="text-zinc-200">{scheme.safetyFactor}</span></span>
        <div className="flex-1" />
        <button onClick={() => runCalculation(scheme.id)} disabled={isLoading}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 rounded px-3 py-1.5 text-sm">
          <Play size={14} /> 执行计算
        </button>
        <button onClick={() => createSnapshot(scheme.id)}
          className="flex items-center gap-1.5 bg-zinc-700 hover:bg-zinc-600 rounded px-3 py-1.5 text-sm">
          <Save size={14} /> 保存版本
        </button>
        <button onClick={handleExport}
          className="flex items-center gap-1.5 bg-zinc-700 hover:bg-zinc-600 rounded px-3 py-1.5 text-sm">
          <Download size={14} /> 导出PDF
        </button>
        <button onClick={() => setActiveTab('points')}
          className="flex items-center gap-1.5 bg-zinc-700 hover:bg-zinc-600 rounded px-3 py-1.5 text-sm">
          <Plus size={14} /> 新建吊点
        </button>
      </header>

      <nav className="flex border-b border-zinc-700 px-6 shrink-0">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto p-6">
        {activeTab === 'points' && <PointsTab />}
        {activeTab === 'fixtures' && <FixturesTab />}
        {activeTab === 'force' && <ForceTab />}
        {activeTab === 'verification' && <VerificationTab />}
        {activeTab === 'risks' && <RisksTab />}
      </main>
    </div>
  )
}
