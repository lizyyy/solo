import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useExhibitionStore } from '@/store/useExhibitionStore'
import PropertyPanel from './PropertyPanel'
import ConflictList from './ConflictList'

export default function Sidebar() {
  const sidebarOpen = useExhibitionStore((s) => s.sidebarOpen)
  const toggleSidebar = useExhibitionStore((s) => s.toggleSidebar)

  return (
    <div
      className="flex h-full shrink-0 border-l border-zinc-700/50 bg-[#1a1a2e] transition-[width] duration-200"
      style={{ width: sidebarOpen ? 320 : 40 }}
    >
      {!sidebarOpen ? (
        <div className="flex w-full items-start justify-center pt-2">
          <button
            onClick={toggleSidebar}
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700/50 hover:text-zinc-200"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      ) : (
        <div className="flex h-full w-full flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-700/50 px-3 py-2">
            <span className="text-xs font-medium text-zinc-300">属性面板</span>
            <button
              onClick={toggleSidebar}
              className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700/50 hover:text-zinc-200"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="h-1/2 shrink-0 overflow-hidden border-b border-zinc-700/50">
            <PropertyPanel />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <ConflictList />
          </div>
        </div>
      )}
    </div>
  )
}
