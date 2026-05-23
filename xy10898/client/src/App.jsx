import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import RequestDetail from './pages/RequestDetail'
import CreateRequest from './pages/CreateRequest'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/request/:id" element={<RequestDetail />} />
          <Route path="/create" element={<CreateRequest />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
