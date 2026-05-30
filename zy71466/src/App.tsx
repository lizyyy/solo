import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import DataOverview from '@/pages/DataOverview'
import ClusterAnalysis from '@/pages/ClusterAnalysis'
import BatchCompare from '@/pages/BatchCompare'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DataOverview />} />
          <Route path="/cluster" element={<ClusterAnalysis />} />
          <Route path="/batch" element={<BatchCompare />} />
        </Route>
      </Routes>
    </Router>
  )
}
