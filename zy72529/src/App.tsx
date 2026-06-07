import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { ClaimList } from './pages/ClaimList';
import { ClaimDetail } from './pages/ClaimDetail';
import Home from './pages/Home';

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<Navigate to="/list" replace />} />
            <Route path="/list" element={<ClaimList />} />
            <Route path="/detail/:id" element={<ClaimDetail />} />
            <Route path="/home" element={<Home />} />
            <Route path="/settings" element={
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <p className="text-gray-500">设置页面</p>
              </div>
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
