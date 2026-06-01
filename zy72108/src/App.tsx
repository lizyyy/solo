import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import ReviewWorkbench from '@/pages/ReviewWorkbench'
import HistoryComparison from '@/pages/HistoryComparison'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/review" element={<ReviewWorkbench />} />
          <Route path="/review/:batchId" element={<ReviewWorkbench />} />
          <Route path="/history" element={<HistoryComparison />} />
        </Route>
      </Routes>
    </Router>
  )
}
