import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import InspectionMap from '@/pages/InspectionMap'
import Records from '@/pages/Records'
import Export from '@/pages/Export'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<InspectionMap />} />
          <Route path="/records" element={<Records />} />
          <Route path="/export" element={<Export />} />
        </Route>
      </Routes>
    </Router>
  )
}
