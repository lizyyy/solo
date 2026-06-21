import React from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Scene3D from '@/components/scene3d/Scene3D'
import SidePanel from '@/components/sidepanel/SidePanel'
import StationDetail from '@/components/modals/StationDetail'
import ExportPanel from '@/components/modals/ExportPanel'
import { useStationStore } from '@/store/stationStore'

const App: React.FC = () => {
  const selectedId = useStationStore((s) => s.selectedId)
  const showExportPanel = useStationStore((s) => s.showExportPanel)

  return (
    <div className="font-sans">
      <AppLayout scene3d={<Scene3D />} sidePanel={<SidePanel />} />

      {selectedId && <StationDetail />}

      {showExportPanel && <ExportPanel />}
    </div>
  )
}

export default App
