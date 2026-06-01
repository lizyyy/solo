import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import ImportZone from '@/components/data/ImportZone'
import QCPanels from '@/components/data/QCPanels'
import JudgmentLogTable from '@/components/data/JudgmentLogTable'

const TABS = [
  { key: 'import', label: '数据导入' },
  { key: 'qc', label: '质控面板' },
  { key: 'log', label: '判断日志' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function DataManagement() {
  const [activeTab, setActiveTab] = useState<TabKey>('import')

  return (
    <div className="flex h-screen w-screen flex-col" style={{ backgroundColor: '#0A1628' }}>
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
        <Link
          to="/"
          className="flex items-center gap-1 text-gray-400 transition-colors hover:text-cyan-400"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">返回</span>
        </Link>
        <h1 className="text-lg font-bold text-white">数据管理与质控</h1>
      </div>

      <div className="flex gap-1 border-b border-white/10 px-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-cyan-400 text-cyan-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeTab === 'import' && <ImportZone />}
        {activeTab === 'qc' && <QCPanels />}
        {activeTab === 'log' && <JudgmentLogTable />}
      </div>
    </div>
  )
}
