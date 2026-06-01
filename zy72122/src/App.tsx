import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'
import InputPage from '@/pages/InputPage'
import ValidationPage from '@/pages/ValidationPage'
import ChartsPage from '@/pages/ChartsPage'
import AuditPage from '@/pages/AuditPage'

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-slate-950">
        <Sidebar />
        <main className="ml-56 flex-1 p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/input" replace />} />
            <Route path="/input" element={<InputPage />} />
            <Route path="/validation" element={<ValidationPage />} />
            <Route path="/charts" element={<ChartsPage />} />
            <Route path="/audit" element={<AuditPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}
