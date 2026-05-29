import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import BatchDetail from '@/pages/BatchDetail'
import Works from '@/pages/Works'
import Students from '@/pages/Students'
import Glazes from '@/pages/Glazes'
import Reschedule from '@/pages/Reschedule'
import Reports from '@/pages/Reports'

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/batch/:id" element={<BatchDetail />} />
          <Route path="/works" element={<Works />} />
          <Route path="/students" element={<Students />} />
          <Route path="/glazes" element={<Glazes />} />
          <Route path="/reschedule" element={<Reschedule />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Layout>
    </Router>
  )
}
