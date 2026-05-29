import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import OverviewPage from '@/pages/Overview'
import ClusterDetailPage from '@/pages/ClusterDetail'
import ReportsPage from '@/pages/Reports'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/cluster/:id" element={<ClusterDetailPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
