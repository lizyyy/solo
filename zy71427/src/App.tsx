import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import GamePage from '@/pages/GamePage'
import RecordsPage from '@/pages/RecordsPage'
import ReplayPage from '@/pages/ReplayPage'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<GamePage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/replay" element={<ReplayPage />} />
      </Routes>
    </Router>
  )
}
