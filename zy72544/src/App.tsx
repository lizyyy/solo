import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import RecordList from '@/pages/RecordList'
import SupplementDetail from '@/pages/SupplementDetail'
import ExportPage from '@/pages/ExportPage'
import HistoryPage from '@/pages/HistoryPage'
import VisualPage from '@/pages/VisualPage'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<RecordList />} />
          <Route path="/record/:id/supplement" element={<SupplementDetail />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/visual" element={<VisualPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
