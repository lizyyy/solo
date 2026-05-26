import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import MenuPage from '@/pages/MenuPage'
import GamePage from '@/pages/GamePage'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MenuPage />} />
        <Route path="/game/:levelId" element={<GamePage />} />
      </Routes>
    </Router>
  )
}
