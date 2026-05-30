import { useEffect } from 'react'
import ExhibitionScene from '@/components/3d/ExhibitionScene'
import Sidebar from '@/components/ui/Sidebar'
import TimelineBar from '@/components/ui/TimelineBar'
import { useExhibitionStore } from '@/store/useExhibitionStore'

export function ExhibitionPage() {
  const loadDemoData = useExhibitionStore((s) => s.loadDemoData)

  useEffect(() => {
    loadDemoData()
  }, [loadDemoData])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0f0f1a]">
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative">
          <ExhibitionScene />
          <TopBar />
        </div>
        <Sidebar />
      </div>
      <TimelineBar />
    </div>
  )
}

function TopBar() {
  const exhibitionName = useExhibitionStore((s) => s.exhibitionName)
  const showSafetyZones = useExhibitionStore((s) => s.showSafetyZones)
  const showPaths = useExhibitionStore((s) => s.showPaths)
  const showLightRanges = useExhibitionStore((s) => s.showLightRanges)
  const toggleSafetyZones = useExhibitionStore((s) => s.toggleSafetyZones)
  const togglePaths = useExhibitionStore((s) => s.togglePaths)
  const toggleLightRanges = useExhibitionStore((s) => s.toggleLightRanges)
  const conflicts = useExhibitionStore((s) => s.conflicts)
  const unresolved = conflicts.filter((c) => !c.resolvedAt).length

  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 pointer-events-none">
      <div className="flex items-center gap-3 pointer-events-auto">
        <h1 className="font-display text-lg font-semibold text-zinc-100 tracking-wide">
          {exhibitionName}
        </h1>
        {unresolved > 0 && (
          <span className="bg-red-500/20 text-red-400 text-xs font-mono px-2 py-0.5 rounded-full border border-red-500/30">
            {unresolved} 冲突
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 pointer-events-auto">
        <button
          onClick={toggleSafetyZones}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
            showSafetyZones
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/30'
          }`}
        >
          安全距离
        </button>
        <button
          onClick={togglePaths}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
            showPaths
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/30'
          }`}
        >
          动线
        </button>
        <button
          onClick={toggleLightRanges}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
            showLightRanges
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/30'
          }`}
        >
          灯光范围
        </button>
      </div>
    </div>
  )
}
