import { Routes, Route } from 'react-router-dom'
import MainMenu from './components/menu/MainMenu'
import GameScene from './components/game/GameScene'
import ResultScreen from './components/playback/ResultScreen'

function App() {
  return (
    <div className="w-full h-full bg-navy-700">
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/game/:levelId" element={<GameScene />} />
        <Route path="/result/:sessionId" element={<ResultScreen />} />
      </Routes>
    </div>
  )
}

export default App
