import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import StarMap from '@/pages/StarMap'
import Details from '@/pages/Details'
import Report from '@/pages/Report'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/starmap" replace />} />
          <Route path="starmap" element={<StarMap />} />
          <Route path="details" element={<Details />} />
          <Route path="report" element={<Report />} />
        </Route>
      </Routes>
    </Router>
  )
}
