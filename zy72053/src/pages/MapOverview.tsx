import { Filter } from 'lucide-react'
import { useStore } from '@/store/useStore'
import PipelineScene from '@/components/three/PipelineScene'
import StatsBar from '@/components/map/StatsBar'
import FilterPanel from '@/components/map/FilterPanel'
import PointDetail from '@/components/map/PointDetail'
import ScreenshotExport from '@/components/map/ScreenshotExport'

export default function MapOverview() {
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const setSidebarOpen = useStore((s) => s.setSidebarOpen)
  const selectedPointId = useStore((s) => s.selectedPointId)

  return (
    <div className="relative h-screen overflow-hidden" style={{ background: '#0A1628' }}>
      <div className="relative z-10">
        <StatsBar />
      </div>

      <div className="absolute left-0 top-14 z-20">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="m-3 flex h-9 w-9 items-center justify-center rounded-lg bg-black/50 text-gray-400 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-cyan-400"
        >
          <Filter size={18} />
        </button>
      </div>

      <div className="absolute inset-0 top-14" id="map-container">
        <PipelineScene />
      </div>

      <div className="absolute left-0 top-14 z-30 h-[calc(100%-3.5rem)]">
        <FilterPanel open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      {selectedPointId && (
        <div className="absolute right-0 top-14 z-30 h-[calc(100%-3.5rem)]">
          <PointDetail />
        </div>
      )}

      <div className="absolute bottom-6 right-6 z-30">
        <ScreenshotExport />
      </div>
    </div>
  )
}
