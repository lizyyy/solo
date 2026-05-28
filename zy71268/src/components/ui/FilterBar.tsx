import { useMemo, useEffect, type RefObject } from 'react'
import { ChevronDown, GitCompareArrows } from 'lucide-react'
import { useSculptureStore } from '@/store/useSculptureStore'
import ExportButton from '@/components/ui/ExportButton'

interface FilterBarProps {
  exportCanvasRef?: RefObject<HTMLCanvasElement | null>
}

export default function FilterBar({ exportCanvasRef }: FilterBarProps) {
  const allSculptures = useSculptureStore((s) => s.sculptures)
  const selectedId = useSculptureStore((s) => s.selectedId)
  const selectedSculpture = allSculptures.find((s) => s.id === selectedId) ?? null
  const versionIndex = useSculptureStore((s) => s.versionIndex)
  const compareMode = useSculptureStore((s) => s.compareMode)
  const filteredLocation = useSculptureStore((s) => s.filteredLocation)
  const filteredStatus = useSculptureStore((s) => s.filteredStatus)
  const selectSculpture = useSculptureStore((s) => s.selectSculpture)
  const setVersionIndex = useSculptureStore((s) => s.setVersionIndex)
  const setCompareMode = useSculptureStore((s) => s.setCompareMode)
  const setFilteredLocation = useSculptureStore((s) => s.setFilteredLocation)
  const setFilteredStatus = useSculptureStore((s) => s.setFilteredStatus)

  const locations = useMemo(
    () => [...new Set(allSculptures.map((sc) => sc.installLocation))],
    [allSculptures]
  )

  const filteredSculptures = useMemo(() => {
    return allSculptures.filter((s) => {
      if (filteredLocation && s.installLocation !== filteredLocation) return false
      if (filteredStatus && s.reviewReport.status !== filteredStatus) return false
      return true
    })
  }, [allSculptures, filteredLocation, filteredStatus])

  const sculptures = filteredSculptures.length > 0 ? filteredSculptures : allSculptures

  const versions = selectedSculpture?.versions ?? []

  useEffect(() => {
    if (sculptures.length > 0 && !sculptures.find((s) => s.id === selectedId)) {
      selectSculpture(sculptures[0].id)
    }
  }, [sculptures, selectedId, selectSculpture])

  return (
    <div
      className="flex items-center gap-4 px-4 py-2 border-b border-gray-700"
      style={{ backgroundColor: '#1a1a2e', fontFamily: 'Rajdhani, sans-serif' }}
    >
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 uppercase tracking-wider">雕塑</label>
        <div className="relative">
          <select
            value={selectedId ?? ''}
            onChange={(e) => selectSculpture(e.target.value)}
            className="appearance-none bg-gray-800 text-white text-sm rounded px-3 py-1.5 pr-8 border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            {sculptures.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        {selectedSculpture && (
          <span className="text-lg font-bold text-white">{selectedSculpture.name}</span>
        )}
      </div>

      <div className="w-px h-6 bg-gray-600" />

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 uppercase tracking-wider">安装位置</label>
        <div className="relative">
          <select
            value={filteredLocation}
            onChange={(e) => setFilteredLocation(e.target.value)}
            className="appearance-none bg-gray-800 text-white text-sm rounded px-3 py-1.5 pr-8 border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            <option value="">全部</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 uppercase tracking-wider">评审状态</label>
        <div className="relative">
          <select
            value={filteredStatus}
            onChange={(e) => setFilteredStatus(e.target.value)}
            className="appearance-none bg-gray-800 text-white text-sm rounded px-3 py-1.5 pr-8 border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            <option value="">全部</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {versions.length > 1 && (
        <>
          <div className="w-px h-6 bg-gray-600" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">版本</label>
            <input
              type="range"
              min={0}
              max={versions.length - 1}
              value={versionIndex}
              onChange={(e) => setVersionIndex(Number(e.target.value))}
              className="w-24 accent-blue-500"
            />
            <span className="text-xs text-gray-300 font-mono">
              {versions[versionIndex]?.label ?? `v${versionIndex}`}
            </span>
          </div>
        </>
      )}

      <div className="flex-1" />

      <button
        onClick={() => setCompareMode(!compareMode)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm border transition-colors ${
          compareMode
            ? 'bg-blue-600 border-blue-500 text-white'
            : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
        }`}
      >
        <GitCompareArrows className="w-4 h-4" />
        对比
      </button>

      <ExportButton canvasRef={exportCanvasRef} />
    </div>
  )
}
