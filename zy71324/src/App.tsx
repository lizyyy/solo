import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import MaterialsPage from '@/pages/MaterialsPage'
import ScreeningPage from '@/pages/ScreeningPage'
import ReportPage from '@/pages/ReportPage'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/materials" replace />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/screening" element={<ScreeningPage />} />
          <Route path="/report" element={<ReportPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
