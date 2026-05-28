import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import GamePage from './pages/GamePage'
import ReplayPage from './pages/ReplayPage'
import ReportPage from './pages/ReportPage'

function App() {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/replay/:sessionId" element={<ReplayPage />} />
        <Route path="/report/:sessionId" element={<ReportPage />} />
      </Routes>
    </div>
  )
}

export default App
