import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import LineagePage from '@/pages/LineagePage'
import ScanPage from '@/pages/ScanPage'
import AliasPage from '@/pages/AliasPage'
import RiskPage from '@/pages/RiskPage'
import ReportPage from '@/pages/ReportPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/lineage" replace />} />
        <Route element={<AppLayout />}>
          <Route path="/lineage" element={<LineagePage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/alias" element={<AliasPage />} />
          <Route path="/risk" element={<RiskPage />} />
          <Route path="/report" element={<ReportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
