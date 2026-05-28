import { Link, useLocation } from "react-router-dom"
import { LineChart, ClipboardList, FileBarChart } from "lucide-react"

const navItems = [
  { path: '/', label: '曲线工坊', icon: LineChart },
  { path: '/review', label: '练习复盘', icon: ClipboardList },
  { path: '/reports', label: '学习报告', icon: FileBarChart },
]

export default function NavBar() {
  const location = useLocation()

  return (
    <nav className="bg-navy-800 border-b border-navy-700">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-gold-500 text-gold-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-navy-600'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
