import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ImportPage from './pages/ImportPage'
import ParameterPage from './pages/ParameterPage'
import ScenePage from './pages/ScenePage'
import ReportPage from './pages/ReportPage'
import SolutionPage from './pages/SolutionPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ImportPage />} />
        <Route path="/parameter" element={<ParameterPage />} />
        <Route path="/scene" element={<ScenePage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/solutions" element={<SolutionPage />} />
      </Routes>
    </Layout>
  )
}

export default App
