import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import ArchiveListPage from '@/pages/ArchiveListPage'
import ArchiveFormPage from '@/pages/ArchiveFormPage'
import ArchiveDetailPage from '@/pages/ArchiveDetailPage'
import SearchPage from '@/pages/SearchPage'
import ComparePage from '@/pages/ComparePage'
import IssuesPage from '@/pages/IssuesPage'
import DashboardPage from '@/pages/DashboardPage'
import ExportPage from '@/pages/ExportPage'

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/archive" replace />} />
          <Route path="/archive" element={<ArchiveListPage />} />
          <Route path="/archive/new" element={<ArchiveFormPage />} />
          <Route path="/archive/:id" element={<ArchiveDetailPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/issues" element={<IssuesPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/export" element={<ExportPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}
