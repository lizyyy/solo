import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import DataEntry from '@/pages/DataEntry'
import Compute from '@/pages/Compute'
import Report from '@/pages/Report'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DataEntry />} />
          <Route path="/compute" element={<Compute />} />
          <Route path="/report" element={<Report />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
