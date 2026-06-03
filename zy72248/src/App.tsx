import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Conflict from '@/pages/Conflict'
import Supplement from '@/pages/Supplement'
import History from '@/pages/History'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/conflict" element={<Conflict />} />
          <Route path="/supplement" element={<Supplement />} />
          <Route path="/history" element={<History />} />
        </Route>
      </Routes>
    </Router>
  )
}
