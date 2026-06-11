import React, { useState } from 'react'
import { useAppState } from './store/useAppState'
import { ConflictPanel } from './components/ConflictPanel'
import { SelfCheckPanel } from './components/SelfCheckPanel'
import { DataConsistencyPanel } from './components/DataConsistencyPanel'
import { WorkflowPanel } from './components/WorkflowPanel'
import { AuditTrailPanel } from './components/AuditTrailPanel'
import { DashboardPanel } from './components/DashboardPanel'
import { ReportPanel } from './components/ReportPanel'
import './styles.css'

type Page = 'dashboard' | 'conflict' | 'selfcheck' | 'consistency' | 'workflow' | 'audit' | 'report'

const NAV_ITEMS: { key: Page; label: string }[] = [
  { key: 'dashboard', label: '预警总览' },
  { key: 'conflict', label: '冲突检测' },
  { key: 'selfcheck', label: '系统自检' },
  { key: 'consistency', label: '数据一致性' },
  { key: 'workflow', label: '工作流管理' },
  { key: 'report', label: '结果报告' },
  { key: 'audit', label: '追溯审计' },
]

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const state = useAppState()

  const pendingConflicts = state.conflicts.filter(c => c.status === 'pending').length

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPanel state={state} />
      case 'conflict': return <ConflictPanel state={state} />
      case 'selfcheck': return <SelfCheckPanel state={state} />
      case 'consistency': return <DataConsistencyPanel state={state} />
      case 'workflow': return <WorkflowPanel state={state} />
      case 'report': return <ReportPanel state={state} />
      case 'audit': return <AuditTrailPanel state={state} />
    }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>🏗️ 塔吊吊臂挠度预警</h1>
          <div className="subtitle">安全阈值 × 铭牌参数 · 冲突检测与追溯</div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              className={`nav-item ${currentPage === item.key ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.key)}
            >
              {item.label}
              {item.key === 'conflict' && pendingConflicts > 0 && (
                <span className="badge">{pendingConflicts}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  )
}
