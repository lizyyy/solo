import React, { useState } from 'react'
import { useApp } from './context/AppContext'
import { AnomalyAlert } from './components/AnomalyAlert'
import { FingeringDictionary } from './components/FingeringDictionary'
import { SectionManager } from './components/SectionManager'
import { PracticeEntry } from './components/PracticeEntry'
import { CommentPanel } from './components/CommentPanel'
import { Dashboard } from './components/Dashboard'
import { ReportGenerator } from './components/ReportGenerator'

type TabType = 'dashboard' | 'fingering' | 'section' | 'practice' | 'comment' | 'report'

const App: React.FC = () => {
  const { state } = useApp()
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')

  const unresolvedAnomalies = state.anomalies.filter(a => !a.resolved).length

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'dashboard', label: '分析看板', icon: '📊' },
    { id: 'fingering', label: '指法字典', icon: '🎯' },
    { id: 'section', label: '曲谱段落', icon: '📜' },
    { id: 'practice', label: '练习录入', icon: '✍️' },
    { id: 'comment', label: '老师点评', icon: '💬' },
    { id: 'report', label: '学习报告', icon: '📋' }
  ]

  return (
    <div className="min-h-screen bg-guqin-50">
      <header className="bg-white border-b border-guqin-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🎵</div>
              <div>
                <h1 className="text-2xl font-bold text-guqin-800">
                  古琴指法学习卡
                </h1>
                <p className="text-sm text-guqin-600">
                  古琴指法练习分析工具</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  共 {state.fingerings.length} 个指法</p>
                <p className="text-sm text-gray-500">
                  {state.sections.length} 个段落 · {state.practiceRecords.length} 条练习记录</p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id
                  ? 'tab-active'
                  : 'tab-inactive'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.id === 'dashboard' && unresolvedAnomalies > 0 && (
                  <span className="badge badge-critical">
                    {unresolvedAnomalies}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && (
          <>
            <AnomalyAlert />
            <Dashboard />
          </>
        )}
        {activeTab === 'fingering' && <FingeringDictionary />}
        {activeTab === 'section' && <SectionManager />}
        {activeTab === 'practice' && <PracticeEntry />}
        {activeTab === 'comment' && <CommentPanel />}
        {activeTab === 'report' && <ReportGenerator />}
      </main>

      <footer className="bg-white border-t border-guqin-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          <p>古琴社指法练习工具 · 每个异常点都可追溯到来源材料</p>
        </div>
      </footer>
    </div>
  )
}

export default App
