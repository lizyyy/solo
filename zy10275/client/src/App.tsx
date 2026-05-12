import React, { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import SessionList from './pages/SessionList'
import SessionDetail from './pages/SessionDetail'

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

function App() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  return (
    <div className="app">
      <header>
        <h1>🏸 羽毛球馆约球拼场台</h1>
        <p>轻松管理场地预订、人员拼场、费用分摊</p>
      </header>

      <Routes>
        <Route path="/" element={<SessionList showToast={showToast} />} />
        <Route path="/session/:id" element={<SessionDetail showToast={showToast} />} />
      </Routes>

      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  )
}

export default App
