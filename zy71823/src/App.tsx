import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Timeline from '@/pages/Timeline'
import Audit from '@/pages/Audit'
import Evidence from '@/pages/Evidence'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Timeline />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/evidence" element={<Evidence />} />
        </Route>
      </Routes>
    </Router>
  )
}
