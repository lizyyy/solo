import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from '@/pages/Home'
import AuditLog from '@/pages/AuditLog'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/audit" element={<AuditLog />} />
      </Routes>
    </Router>
  )
}
