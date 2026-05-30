import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ExhibitionPage } from '@/pages/ExhibitionPage'
import { ImportPage } from '@/pages/ImportPage'
import { ReportPage } from '@/pages/ReportPage'
import { NavigationBar } from '@/components/ui/NavigationBar'

export default function App() {
  return (
    <Router>
      <div className="h-screen w-screen overflow-hidden">
        <Routes>
          <Route path="/" element={<ExhibitionPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/report" element={<ReportPage />} />
        </Routes>
        <NavigationBar />
      </div>
    </Router>
  )
}
