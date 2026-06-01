import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import DataImport from '@/pages/DataImport'
import Allocation from '@/pages/Allocation'
import Conflict from '@/pages/Conflict'
import Report from '@/pages/Report'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/import" replace />} />
          <Route path="/import" element={<DataImport />} />
          <Route path="/allocation" element={<Allocation />} />
          <Route path="/conflict" element={<Conflict />} />
          <Route path="/report" element={<Report />} />
        </Route>
      </Routes>
    </Router>
  )
}
