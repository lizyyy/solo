import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import BookingList from './pages/BookingList'
import BookingDetail from './pages/BookingDetail'
import Statistics from './pages/Statistics'
import { exportApi } from './services/api'

function App() {
  const navigate = useNavigate()

  return (
    <div>
      <header className="header">
        <div className="container">
          <h1>早教试听课转化台</h1>
          <div className="subtitle">从试听预约到正式报名的全流程管理</div>
        </div>
      </header>
      
      <div className="container">
        <nav className="nav">
          <NavLink to="/" end>预约列表</NavLink>
          <NavLink to="/statistics">转化统计</NavLink>
          <button className="btn btn-primary" onClick={exportApi.download} style={{ marginLeft: 'auto' }}>
            导出数据
          </button>
        </nav>

        <Routes>
          <Route path="/" element={<BookingList />} />
          <Route path="/bookings/:id" element={<BookingDetail />} />
          <Route path="/statistics" element={<Statistics />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
