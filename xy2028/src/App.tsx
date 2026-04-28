import { Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Home from './pages/Home'
import ItemDetail from './pages/ItemDetail'
import Crafting from './pages/Crafting'
import Defects from './pages/Defects'
import Messages from './pages/Messages'
import MyCreations from './pages/MyCreations'
import Layout from './components/Layout'
import './App.css'

function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/item/:id" element={<ItemDetail />} />
          <Route path="/craft/:id" element={<Crafting />} />
          <Route path="/defects" element={<Defects />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/creations" element={<MyCreations />} />
        </Route>
      </Routes>
    </AppProvider>
  )
}

export default App