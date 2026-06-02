import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/AppLayout'
import Dashboard from '@/pages/Dashboard'
import Locations from '@/pages/Locations'
import Feedback from '@/pages/Feedback'
import DataIO from '@/pages/DataIO'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="locations" element={<Locations />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="data" element={<DataIO />} />
        </Route>
      </Routes>
    </Router>
  )
}
