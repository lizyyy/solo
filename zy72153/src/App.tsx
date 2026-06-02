import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import ImportPage from '@/pages/ImportPage'
import MergePage from '@/pages/MergePage'
import ReviewPage from '@/pages/ReviewPage'
import ExportPage from '@/pages/ExportPage'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/import" replace />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="merge" element={<MergePage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="export" element={<ExportPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
