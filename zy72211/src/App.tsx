import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Overview from '@/pages/Overview'
import DataImport from '@/pages/DataImport'
import Conflict from '@/pages/Conflict'
import Audit from '@/pages/Audit'
import Summary from '@/pages/Summary'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/import" element={<DataImport />} />
          <Route path="/conflict" element={<Conflict />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/summary" element={<Summary />} />
        </Route>
      </Routes>
    </Router>
  )
}
