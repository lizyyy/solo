import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import Dashboard from '@/pages/Dashboard'
import Compare from '@/pages/Compare'

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-harbor-bg">
        <Navbar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/compare" element={<Compare />} />
        </Routes>
      </div>
    </Router>
  )
}
