import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Sampling from '@/pages/Sampling'
import SamplingDetail from '@/pages/SamplingDetail'
import Params from '@/pages/Params'
import ParamHistory from '@/pages/ParamHistory'
import Calculation from '@/pages/Calculation'
import Boundary from '@/pages/Boundary'
import History from '@/pages/History'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sampling" element={<Sampling />} />
          <Route path="/sampling/:id" element={<SamplingDetail />} />
          <Route path="/params" element={<Params />} />
          <Route path="/params/history" element={<ParamHistory />} />
          <Route path="/calculation" element={<Calculation />} />
          <Route path="/boundary" element={<Boundary />} />
          <Route path="/history" element={<History />} />
        </Route>
      </Routes>
    </Router>
  )
}
