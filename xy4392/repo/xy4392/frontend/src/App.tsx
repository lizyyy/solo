import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout } from 'antd'
import PlanList from './pages/PlanList'
import Editor from './pages/Editor'
import './App.css'

const { Content } = Layout

function App() {
  return (
    <Router>
      <Layout className="app-layout">
        <Content>
          <Routes>
            <Route path="/" element={<PlanList />} />
            <Route path="/editor/:planId" element={<Editor />} />
          </Routes>
        </Content>
      </Layout>
    </Router>
  )
}

export default App
