import { useState, useCallback } from 'react'
import { Mountain, Zap, Route, Settings2 } from 'lucide-react'
import { useClassroomStore } from '@/store'
import type { ViewMode } from '@/types'

const VIEWS: { key: ViewMode; label: string; icon: typeof Mountain }[] = [
  { key: 'surface', label: '3D曲面', icon: Mountain },
  { key: 'vector', label: '向量动画', icon: Zap },
  { key: 'path', label: '路径回放', icon: Route },
  { key: 'params', label: '参数总览', icon: Settings2 },
]

export default function ViewSwitcher() {
  const { project, setActiveView } = useClassroomStore()
  const activeView = project.viewState.activeView

  return (
    <div className="flex gap-1 bg-[#0d1225]/80 backdrop-blur-md rounded-xl p-1 border border-white/5">
      {VIEWS.map(({ key, label, icon: Icon }) => {
        const isActive = activeView === key
        return (
          <button
            key={key}
            onClick={() => setActiveView(key)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${isActive
                ? 'bg-[#4fc3f7]/20 text-[#4fc3f7] shadow-[0_0_12px_rgba(79,195,247,0.2)]'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }
            `}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
