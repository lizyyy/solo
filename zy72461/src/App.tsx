import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { Home, FileText, AlertTriangle, FileBarChart } from 'lucide-react'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import RecordList from './pages/RecordList'
import RecordDetail from './pages/RecordDetail'
import ConflictPage from './pages/ConflictPage'
import SummaryPage from './pages/SummaryPage'

function NavLinks() {
  const location = useLocation()

  const links = [
    { path: '/', label: '记录列表', icon: Home },
    { path: '/summary', label: '街道摘要', icon: FileBarChart },
  ]

  return (
    <div className="flex items-center space-x-1 ml-6">
      {links.map((link) => {
        const Icon = link.icon
        const isActive = location.pathname === link.path
        return (
          <a
            key={link.path}
            href={link.path}
            className={`flex items-center space-x-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
              isActive
                ? 'bg-white text-blue-900'
                : 'text-blue-100 hover:bg-blue-800 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{link.label}</span>
          </a>
        )
      })}
    </div>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const showSidebar = location.pathname !== '/summary'

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
          <Route path="/record/:id" element={<RecordDetail />} />
          <Route path="/conflict/:id" element={<ConflictPage />} />
          <Route path="/summary" element={<SummaryPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}
