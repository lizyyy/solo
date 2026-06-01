import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import MapOverview from '@/pages/MapOverview'
import DataManagement from '@/pages/DataManagement'
import RecordDetail from '@/pages/RecordDetail'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MapOverview />} />
        <Route path="/data" element={<DataManagement />} />
        <Route path="/record/:id" element={<RecordDetail />} />
      </Routes>
    </Router>
  )
}
