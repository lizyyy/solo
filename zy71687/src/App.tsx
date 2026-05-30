import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import CollectionPage from '@/pages/CollectionPage'
import SchedulingPage from '@/pages/SchedulingPage'
import AlertsPage from '@/pages/AlertsPage'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/collection" replace />} />
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/scheduling" element={<SchedulingPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
