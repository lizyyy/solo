import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'
import SamplesPage from '@/pages/SamplesPage'
import ContractsPage from '@/pages/ContractsPage'
import PlatformsPage from '@/pages/PlatformsPage'
import RoyaltiesPage from '@/pages/RoyaltiesPage'
import ReleasesPage from '@/pages/ReleasesPage'
import ReportPage from '@/pages/ReportPage'

export default function App() {
  return (
    <Router>
      <Sidebar />
      <main className="min-h-screen bg-warm-100 pt-14 md:pt-0 md:pl-0">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl">
          <Routes>
            <Route path="/" element={<Navigate to="/samples" replace />} />
            <Route path="/samples" element={<SamplesPage />} />
            <Route path="/contracts" element={<ContractsPage />} />
            <Route path="/platforms" element={<PlatformsPage />} />
            <Route path="/royalties" element={<RoyaltiesPage />} />
            <Route path="/releases" element={<ReleasesPage />} />
            <Route path="/report" element={<ReportPage />} />
          </Routes>
        </div>
      </main>
    </Router>
  )
}
