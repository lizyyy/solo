import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Sensors from '@/pages/Sensors'
import Review from '@/pages/Review'
import History from '@/pages/History'
import Visualization from '@/pages/Visualization'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sensors" element={<Sensors />} />
          <Route path="/review" element={<Review />} />
          <Route path="/history" element={<History />} />
          <Route path="/visualization" element={<Visualization />} />
        </Route>
      </Routes>
    </Router>
  )
}
