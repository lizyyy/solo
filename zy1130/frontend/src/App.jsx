import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import DataImport from './pages/DataImport'
import PlanView from './pages/PlanView'
import CompareView from './pages/CompareView'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/import" element={<DataImport />} />
        <Route path="/plan/:id?" element={<PlanView />} />
        <Route path="/compare" element={<CompareView />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}

export default App
