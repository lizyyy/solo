import { useState, useEffect } from 'react'
import SceneCanvas from '@/components/three/SceneCanvas'
import FrequencyBandBar from '@/components/ui/FrequencyBandBar'
import FilterPanel from '@/components/ui/FilterPanel'
import HeatmapLegend from '@/components/ui/HeatmapLegend'
import SummaryBar from '@/components/ui/SummaryBar'
import DetailsCard from '@/components/ui/DetailsCard'
import Toolbar from '@/components/ui/Toolbar'
import DataTraceModal from '@/components/ui/DataTraceModal'
import SavePlanDialog from '@/components/ui/SavePlanDialog'
import useDataStore from '@/stores/dataStore'
import useSceneStore from '@/stores/sceneStore'
import { exportScreenshot, exportReport } from '@/utils/screenshot'

interface TraceData {
  title: string
  value: number
  dataSource: string
  measuredAt?: string
  seatId?: string
  frequencyBand?: string
}

export default function Home() {
  const loadData = useDataStore((state) => state.loadData)
  const loading = useDataStore((state) => state.loading)
  const currentBand = useSceneStore((state) => state.currentBand)
  const measurements = useDataStore((state) => state.measurements)
  const anomalies = useDataStore((state) => state.anomalies)

  const [showTraceModal, setShowTraceModal] = useState(false)
  const [traceData, setTraceData] = useState<TraceData | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleScreenshot = async () => {
    try {
      await exportScreenshot('scene-container', currentBand)
    } catch (err) {
      console.error('截图导出失败:', err)
    }
  }

  const handleExportReport = async () => {
    try {
      await exportReport('scene-container', currentBand, anomalies, measurements)
    } catch (err) {
      console.error('报告导出失败:', err)
    }
  }

  const handleShowTrace = (data: TraceData) => {
    setTraceData(data)
    setShowTraceModal(true)
  }

  if (loading) {
    return (
      <div className="w-full h-full bg-theater-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-theater-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 font-mono">加载声场数据中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-theater-dark relative overflow-hidden no-select">
      <div id="scene-container" className="w-full h-full">
        <SceneCanvas />
      </div>

      <FrequencyBandBar />
      <FilterPanel />
      <HeatmapLegend />
      <SummaryBar onShowTrace={handleShowTrace} />
      <DetailsCard />
      <Toolbar
        onSave={() => setShowSaveDialog(true)}
        onScreenshot={handleScreenshot}
        onExportReport={handleExportReport}
      />

      <div className="absolute top-4 left-4 z-20 pointer-events-none">
        <h1 className="font-display text-xl text-white/90 drop-shadow-lg">
          声场剧院座位沙盘
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">点击座位或扬声器查看详情</p>
      </div>

      {showTraceModal && traceData && (
        <DataTraceModal
          open={showTraceModal}
          onClose={() => setShowTraceModal(false)}
          title={traceData.title}
          value={traceData.value}
          dataSource={traceData.dataSource}
          measuredAt={traceData.measuredAt}
          seatId={traceData.seatId}
          frequencyBand={traceData.frequencyBand}
        />
      )}

      <SavePlanDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
      />
    </div>
  )
}
