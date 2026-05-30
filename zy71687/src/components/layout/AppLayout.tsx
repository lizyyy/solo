import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useStore } from '@/store/useStore'
import { Activity } from 'lucide-react'

export default function AppLayout() {
  const isMatched = useStore((s) => s.isMatched)

  return (
    <div className="flex h-screen bg-[#0f1219] overflow-hidden">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between h-12 px-6 border-b border-white/5 shrink-0">
          <h1 className="text-white font-semibold text-base tracking-wide">结汇排程</h1>
          <div className="flex items-center gap-2">
            <Activity size={14} className={isMatched ? 'text-[#00d4aa]' : 'text-gray-500'} />
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                isMatched
                  ? 'bg-[#00d4aa]/15 text-[#00d4aa]'
                  : 'bg-gray-700/50 text-gray-400'
              }`}
            >
              {isMatched ? '已匹配' : '未匹配'}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
