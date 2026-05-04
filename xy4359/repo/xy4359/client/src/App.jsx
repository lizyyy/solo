import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import LevelManager from './pages/LevelManager'
import GamePage from './pages/GamePage'
import HistoryPage from './pages/HistoryPage'
import ReviewPage from './pages/ReviewPage'
import './styles/App.css'

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="nav-brand">
            <h1>🎭 舞台监督换景排练</h1>
          </div>
          <div className="nav-links">
            <Link to="/" className="nav-link">首页</Link>
            <Link to="/levels" className="nav-link">关卡管理</Link>
            <Link to="/history" className="nav-link">历史记录</Link>
          </div>
        </nav>
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/levels" element={<LevelManager />} />
            <Route path="/game/:levelId" element={<GamePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/review/:rehearsalId" element={<ReviewPage />} />
          </Routes>
        </main>
        
        <footer className="footer">
          <p>舞台监督换景排练系统 v1.0 | 为社区剧场打造</p>
        </footer>
      </div>
    </Router>
  )
}

export default App
