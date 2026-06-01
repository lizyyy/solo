import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Workbench from '@/pages/Workbench'
import RecordDetail from '@/pages/RecordDetail'

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-surface">
        <header className="sticky top-0 z-50 border-b border-surface-border bg-surface/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-neon shadow-neon animate-pulse" />
              <h1 className="text-lg font-bold text-white tracking-wide">
                Livehouse<span className="text-neon ml-1">票房分账</span>
              </h1>
            </div>
            <span className="text-xs text-muted font-mono">林老师的分账工具</span>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Workbench />} />
            <Route path="/record/:id" element={<RecordDetail />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}
