import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import ImportPage from '@/pages/ImportPage'
import BoundaryPage from '@/pages/BoundaryPage'
import ConflictsPage from '@/pages/ConflictsPage'
import AuditPage from '@/pages/AuditPage'
import DemoPage from '@/pages/DemoPage'
import ReviewPage from '@/pages/ReviewPage'

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/boundary" element={<BoundaryPage />} />
          <Route path="/conflicts" element={<ConflictsPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/demo" element={<DemoPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}
