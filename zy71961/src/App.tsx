import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Import from '@/pages/Import'
import ReportDetail from '@/pages/ReportDetail'
import History from '@/pages/History'
import Guide from '@/pages/Guide'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/import" element={<Import />} />
          <Route path="/report/:id" element={<ReportDetail />} />
          <Route path="/history" element={<History />} />
          <Route path="/guide" element={<Guide />} />
        </Route>
      </Routes>
    </Router>
  )
}
