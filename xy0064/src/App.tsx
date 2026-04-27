import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CreateList from './pages/CreateList'
import Templates from './pages/Templates'
import ListDetail from './pages/ListDetail'
import CheckList from './pages/CheckList'
import { PackingListProvider } from './context/PackingListContext'

function App() {
  return (
    <PackingListProvider>
      <Router>
        <div className="app">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<CreateList />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/list/:id" element={<ListDetail />} />
            <Route path="/check/:id" element={<CheckList />} />
          </Routes>
        </div>
      </Router>
    </PackingListProvider>
  )
}

export default App
