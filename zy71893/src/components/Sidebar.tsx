import { Flame, List, User } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useDeviationStore } from '@/store/useDeviationStore'

export default function Sidebar() {
  const { currentUser } = useDeviationStore()
  const location = useLocation()

  const isActive = location.pathname === '/'

  return (
    <aside className="fixed left-0 top-0 h-full bg-slate-card border-r border-iron-lighter flex flex-col z-30 w-16 lg:w-56 transition-all">
      <div className="p-4 flex items-center justify-center lg:justify-start gap-3">
        <Flame className="text-signal" size={28} />
        <span className="hidden lg:block text-white font-semibold text-base">燃烧偏差</span>
      </div>
      <nav className="flex-1 mt-6 px-2">
        <a
          href="/"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-slate-hover text-signal' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-hover'}`}
        >
          <List size={20} />
          <span className="hidden lg:inline">记录总览</span>
        </a>
      </nav>
      <div className="p-4 border-t border-iron-lighter">
        <div className="flex items-center gap-3">
          <User size={20} className="text-slate-400" />
          <span className="hidden lg:inline text-slate-400 text-sm">{currentUser}</span>
        </div>
      </div>
    </aside>
  )
}
