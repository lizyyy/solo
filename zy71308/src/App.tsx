import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import Workbench from '@/pages/Workbench'
import Records from '@/pages/Records'
import Materials from '@/pages/Materials'
import { Flame, FileText, Database, Zap } from 'lucide-react'

const navItems = [
  { to: '/', label: '工作台', icon: Zap },
  { to: '/records', label: '工艺记录', icon: FileText },
  { to: '/materials', label: '材料库与报告', icon: Database },
]

export default function App() {
  return (
    <Router>
      <div className="flex h-screen overflow-hidden bg-bg-primary">
        <nav className="w-16 flex flex-col items-center py-4 bg-bg-secondary border-r border-border gap-2 shrink-0">
          <div className="mb-4 flex items-center justify-center w-10 h-10 rounded-lg bg-amber-dim">
            <Flame className="w-5 h-5 text-amber" />
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-12 h-14 rounded-lg text-[10px] gap-1 transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-dim text-amber'
                    : 'text-txt-muted hover:text-txt-secondary hover:bg-bg-card'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Workbench />} />
            <Route path="/records" element={<Records />} />
            <Route path="/materials" element={<Materials />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}
