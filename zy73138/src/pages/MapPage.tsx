import { Link } from 'react-router-dom'
import { Anchor, History, FileCheck } from 'lucide-react'
import MapCanvas from '@/components/map/MapCanvas'
import MapLegend from '@/components/map/MapLegend'
import LogbookPanel from '@/components/map/LogbookPanel'
import FilterBar from '@/components/map/FilterBar'
import { useWaterQualityStore } from '@/store'

export default function MapPage() {
  const selectedRecordId = useWaterQualityStore((s) => s.selectedRecordId)

  return (
    <div className="flex h-screen flex-col bg-ocean-900">
      <nav className="flex items-center justify-between border-b border-tide/20 bg-ocean-900 px-4 py-2">
        <div className="flex items-center gap-3">
          <Anchor size={20} className="text-tide" />
          <h1 className="font-serif text-base font-bold tracking-wide text-foam">
            近岸水质空间标注
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/history"
            className="flex items-center gap-1.5 text-xs text-foam/60 transition-colors hover:text-tide"
          >
            <History size={14} />
            变更历史
          </Link>
          <Link
            to="/handover"
            className="flex items-center gap-1.5 text-xs text-foam/60 transition-colors hover:text-tide"
          >
            <FileCheck size={14} />
            交接确认
          </Link>
        </div>
      </nav>

      <FilterBar />

      <div className="relative flex-1">
        <MapCanvas />

        <MapLegend />

        {selectedRecordId && <LogbookPanel />}
      </div>
    </div>
  )
}
