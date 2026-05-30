import { useMemo } from 'react'
import { useOrbitalStore } from '@/store/useOrbitalStore'
import { getMolecule, getOrbital } from '@/data/molecules'
import Scene3D from '@/components/Scene3D'
import EnergyLevelSelector from '@/components/EnergyLevelSelector'
import ControlPanel from '@/components/ControlPanel'
import ParamsPanel from '@/components/ParamsPanel'
import SectionView from '@/components/SectionView'
import NotesPanel from '@/components/NotesPanel'
import AnomalyPanel from '@/components/AnomalyPanel'
import HistoryPanel from '@/components/HistoryPanel'
import ScreenshotReport from '@/components/ScreenshotReport'
import { Atom, Activity, AlertTriangle, Clock, FileText, ChevronDown } from 'lucide-react'

type TabId = 'control' | 'notes' | 'anomaly' | 'history' | 'report'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'control', label: '控制', icon: <Activity size={13} /> },
  { id: 'notes', label: '备注', icon: <FileText size={13} /> },
  { id: 'anomaly', label: '异常', icon: <AlertTriangle size={13} /> },
  { id: 'history', label: '历史', icon: <Clock size={13} /> },
  { id: 'report', label: '报告', icon: <Atom size={13} /> },
]

function Header() {
  const currentMoleculeId = useOrbitalStore((s) => s.currentMoleculeId)
  const currentOrbitalId = useOrbitalStore((s) => s.currentOrbitalId)
  const molecule = useMemo(() => getMolecule(currentMoleculeId), [currentMoleculeId])
  const orbital = useMemo(() => getOrbital(currentMoleculeId, currentOrbitalId), [currentMoleculeId, currentOrbitalId])

  return (
    <header className="h-10 flex items-center justify-between px-4 bg-lab-surface border-b border-lab-border shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-lab-glow shadow-glow animate-pulse-glow" />
          <h1 className="text-sm font-bold font-mono text-lab-text tracking-wide">
            分子轨道云课堂
          </h1>
        </div>
        <div className="h-4 w-px bg-lab-border" />
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-lab-muted">{molecule?.formula}</span>
          {orbital && (
            <>
              <span className="text-lab-border">›</span>
              <span className="text-lab-glow text-glow">{orbital.label}</span>
              <span className="text-lab-muted">({orbital.symmetry})</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-mono text-lab-muted">
        <span>MO Classroom v1.0</span>
      </div>
    </header>
  )
}

function RightPanel() {
  const rightPanelTab = useOrbitalStore((s) => s.rightPanelTab)
  const setRightPanelTab = useOrbitalStore((s) => s.setRightPanelTab)
  const anomalyQueue = useOrbitalStore((s) => s.anomalyQueue)
  const pendingCount = useMemo(() => anomalyQueue.filter((a) => a.status === 'pending').length, [anomalyQueue])

  return (
    <div className="flex flex-col h-full bg-lab-surface border-l border-lab-border">
      <div className="flex shrink-0 border-b border-lab-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setRightPanelTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-mono transition-all duration-200 border-b-2 ${
              rightPanelTab === tab.id
                ? 'text-lab-glow border-lab-glow bg-lab-glow/5'
                : 'text-lab-muted border-transparent hover:text-lab-text hover:bg-lab-panel/50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.id === 'anomaly' && pendingCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-lab-warning/20 text-lab-warning text-[8px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {rightPanelTab === 'control' && (
          <div className="flex flex-col gap-0">
            <ControlPanel />
            <div className="border-t border-lab-border" />
            <ParamsPanel />
            <div className="border-t border-lab-border" />
            <SectionView />
          </div>
        )}
        {rightPanelTab === 'notes' && <NotesPanel />}
        {rightPanelTab === 'anomaly' && <AnomalyPanel />}
        {rightPanelTab === 'history' && <HistoryPanel />}
        {rightPanelTab === 'report' && <ScreenshotReport />}
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <div className="flex flex-col w-full h-full bg-lab-bg">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 shrink-0 border-r border-lab-border overflow-hidden">
          <EnergyLevelSelector />
        </div>
        <div className="flex-1 relative overflow-hidden">
          <Scene3D />
        </div>
        <div className="w-80 shrink-0 overflow-hidden">
          <RightPanel />
        </div>
      </div>
    </div>
  )
}
