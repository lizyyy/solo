import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, FileSearch, History, Upload } from 'lucide-react'
import { useState } from 'react'
import { useExposureStore } from '@/store/exposureStore'
import { generateDemoData } from '@/utils/hedgingCalc'
import { detectAnomalies } from '@/utils/hedgingCalc'
import ImportDialog from '@/components/import/ImportDialog'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '敞口总览' },
  { to: '/detail', icon: FileSearch, label: '明细异常' },
  { to: '/review', icon: History, label: '复盘导出' },
]

export default function AppLayout() {
  const [importOpen, setImportOpen] = useState(false)
  const dataLoaded = useExposureStore((s) => s.dataLoaded)

  const loadDemo = () => {
    const demo = generateDemoData()
    const store = useExposureStore.getState()
    store.setSubsidiaries(demo.subsidiaries)
    store.setCurrencies(demo.currencies)
    store.setExposures(demo.exposures)
    store.setHedgeContracts(demo.hedgeContracts)
    store.setExchangeRates(demo.exchangeRates)
    const anomalies = detectAnomalies(demo.subsidiaries, demo.exposures, demo.hedgeContracts, demo.exchangeRates)
    store.setAnomalies(anomalies)
    store.setDataLoaded(true)
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-deep">
      <header className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0 bg-panel/80 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-accent-green to-accent-blue flex items-center justify-center text-deep text-xs font-bold">
              FX
            </div>
            <span className="font-display font-bold text-sm text-txt-primary">外汇敞口币种树</span>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive ? 'bg-accent-green/10 text-accent-green' : 'text-txt-secondary hover:text-txt-primary hover:bg-card'
                  }`
                }
              >
                <item.icon size={14} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {!dataLoaded && (
            <button className="btn-primary text-xs" onClick={loadDemo}>
              加载演示数据
            </button>
          )}
          <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={() => setImportOpen(true)}>
            <Upload size={14} />
            导入
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
