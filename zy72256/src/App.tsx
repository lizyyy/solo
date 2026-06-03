import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import ImportPage from '@/pages/ImportPage'
import ReviewPage from '@/pages/ReviewPage'
import BriefingPage from '@/pages/BriefingPage'
import AuditPage from '@/pages/AuditPage'
import RulesPage from '@/pages/RulesPage'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/briefing" element={<BriefingPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/rules" element={<RulesPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
