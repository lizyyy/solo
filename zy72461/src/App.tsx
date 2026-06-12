import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom'
import { Home, FileText, FileBarChart, List } from 'lucide-react'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import WizardPage from './pages/WizardPage'
import RecordList from './pages/RecordList'
import RecordDetail from './pages/RecordDetail'
import ConflictPage from './pages/ConflictPage'
import SummaryPage from './pages/SummaryPage'

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const showSidebar = location.pathname === '/' || location.pathname.startsWith('/record') || location.pathname.startsWith('/conflict')

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="flex">
        {showSidebar && <Sidebar />}
        {children}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<RecordList />} />
          <Route path="/wizard" element={<WizardPage />} />
          <Route path="/record/:id" element={<RecordDetail />} />
          <Route path="/conflict/:id" element={<ConflictPage />} />
          <Route path="/summary" element={<SummaryPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}
