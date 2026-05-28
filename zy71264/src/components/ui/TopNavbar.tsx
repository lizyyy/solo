import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarChart3, GitCompare, FileText, Activity } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'
import ScoreDetailModal from './ScoreDetailModal'

export default function TopNavbar() {
  const location = useLocation()
  const { score } = useStore()
  const [showScoreModal, setShowScoreModal] = useState(false)

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-400'
    if (s >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const navLinks = [
    { to: '/', label: '3D剖面', icon: BarChart3 },
    { to: '/compare', label: '方案对比', icon: GitCompare },
    { to: '/report', label: '报告导出', icon: FileText },
  ]

  return (
    <nav className="h-14 bg-dc-panel border-b border-dc-border flex items-center justify-between px-6">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-dc-cold" />
          <span className="text-lg font-bold text-dc-text tracking-wide">DC-AIR 3D</span>
        </div>
        <div className="flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon
            const isActive = location.pathname === link.to
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'text-dc-cold border-b-2 border-dc-cold -mb-px'
                    : 'text-dc-muted hover:text-dc-text'
                )}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>
      <div
        onClick={() => setShowScoreModal(true)}
        className={cn(
          'px-4 py-1.5 rounded-full bg-dc-bg border border-dc-border cursor-pointer hover:border-dc-cold transition-colors',
          getScoreColor(score.overallScore)
        )}
      >
        <span className="text-sm font-medium">
          评分: {score.overallScore}/100
        </span>
      </div>
      <ScoreDetailModal isOpen={showScoreModal} onClose={() => setShowScoreModal(false)} />
    </nav>
  )
}
