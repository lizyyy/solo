import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import ImportPage from '@/pages/ImportPage'
import OptimizePage from '@/pages/OptimizePage'
import SummaryPage from '@/pages/SummaryPage'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/import" replace />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/optimize" element={<OptimizePage />} />
          <Route path="/summary" element={<SummaryPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
