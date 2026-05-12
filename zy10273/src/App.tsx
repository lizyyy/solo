import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import AppointmentList from './pages/AppointmentList'
import AppointmentDetail from './pages/AppointmentDetail'
import Approvals from './pages/Approvals'
import Settlement from './pages/Settlement'
import './index.css'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/appointments" element={<AppointmentList />} />
          <Route path="/appointments/:id" element={<AppointmentDetail />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/settlement" element={<Settlement />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
