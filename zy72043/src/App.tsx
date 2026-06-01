import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Challenge from '@/pages/Challenge'
import Settlement from '@/pages/Settlement'
import Review from '@/pages/Review'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Challenge />} />
        <Route path="/settlement/:challengeId" element={<Settlement />} />
        <Route path="/review/:challengeId" element={<Review />} />
      </Routes>
    </Router>
  )
}
