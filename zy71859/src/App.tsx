import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Records from './pages/Records'
import RecordDetail from './pages/RecordDetail'
import Parts from './pages/Parts'
import Scripts from './pages/Scripts'
import Batch from './pages/Batch'
import Audit from './pages/Audit'

function App() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/records" element={<Records />} />
        <Route path="/records/:id" element={<RecordDetail />} />
        <Route path="/parts" element={<Parts />} />
        <Route path="/scripts" element={<Scripts />} />
        <Route path="/batch" element={<Batch />} />
        <Route path="/audit" element={<Audit />} />
      </Routes>
    </MainLayout>
  )
}

export default App
