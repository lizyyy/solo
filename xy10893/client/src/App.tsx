import { Routes, Route, Link } from 'react-router-dom'
import DisputeList from './pages/DisputeList'
import DisputeDetail from './pages/DisputeDetail'

function App() {
  return (
    <div>
      <header className="header">
        <div className="container flex items-center justify-between">
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1>📦 证据包导出系统</h1>
          </Link>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<DisputeList />} />
          <Route path="/disputes/:id" element={<DisputeDetail />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
