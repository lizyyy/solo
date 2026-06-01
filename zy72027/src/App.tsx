import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Console from '@/pages/Console'
import Settlement from '@/pages/Settlement'
import Replay from '@/pages/Replay'
import ExportPage from '@/pages/Export'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Console />} />
          <Route path="/settlement" element={<Settlement />} />
          <Route path="/replay" element={<Replay />} />
          <Route path="/export" element={<ExportPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
