import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProjectList from '@/pages/ProjectList'
import LightPositionDetail from '@/pages/LightPositionDetail'
import InspectionExport from '@/pages/InspectionExport'
import { useStore } from '@/store/useStore'
import { projects, lightPositions, changeRecords, anomalyNotes } from '@/data/mock'

function InitializeData({ children }: { children: React.ReactNode }) {
  const storeProjects = useStore((s) => s.projects)
  const loadMockData = useStore((s) => s.loadMockData)

  if (storeProjects.length === 0) {
    loadMockData({
      projects,
      positions: lightPositions,
      changeRecords,
      anomalyNotes,
    })
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <InitializeData>
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/project/:id" element={<LightPositionDetail />} />
          <Route path="/project/:id/export" element={<InspectionExport />} />
        </Routes>
      </InitializeData>
    </BrowserRouter>
  )
}
