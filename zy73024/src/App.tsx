import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import AnalysisPage from './pages/AnalysisPage'
import DeliveryPage from './pages/DeliveryPage'
import NotFoundPage from './pages/NotFoundPage'
import { useAppStore } from './store/useAppStore'

function Nav() {
  const loc = useLocation()
  const deliveryMode = useAppStore((s) => s.deliveryMode)
  const setDeliveryMode = useAppStore((s) => s.setDeliveryMode)

  const linkBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-all'
  const active = (p: string) =>
    loc.pathname.startsWith(p) ? `${linkBase} bg-white text-clay shadow-sm` : `${linkBase} text-clay-100 hover:text-white hover:bg-white/10`

  if (deliveryMode) return null

  return (
    <header className="sticky top-0 z-40 border-b border-clay-200/60 backdrop-blur-sm">
      <div className="bg-gradient-to-r from-clay-600 via-clay to-clay-500 text-white">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="text-2xl">🐾</span>
            <div className="leading-tight">
              <div className="font-kai text-xl tracking-wide">宠物减重回访追踪</div>
              <div className="text-[11px] text-clay-100">救助站 · 小乔工作台</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 ml-6">
            <Link to="/dashboard" className={active('/dashboard')}>📋 追踪汇总</Link>
            <Link to="/delivery" className={active('/delivery')}>📤 交付说明</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setDeliveryMode(true)}
              className="px-3 py-1.5 bg-white/90 text-clay-700 text-xs rounded-lg hover:bg-white transition-colors font-medium"
            >
              📺 切换交接视图
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-white/30">
              <div className="w-8 h-8 rounded-full bg-paper text-clay-700 flex items-center justify-center font-kai font-bold">乔</div>
              <div className="text-xs leading-tight">
                <div className="font-medium">志愿者 小乔</div>
                <div className="text-clay-100">今日已跟进 4 只</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <div className="min-h-screen paper-bg">
      <Nav />
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/pet/:id" element={<AnalysisPage />} />
          <Route path="/delivery" element={<DeliveryPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  )
}
