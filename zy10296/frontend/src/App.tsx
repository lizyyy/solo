import { Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Families from './pages/Families';
import Materials from './pages/Materials';
import Batches from './pages/Batches';
import Distributions from './pages/Distributions';
import Inventory from './pages/Inventory';
import FamilyHistory from './pages/FamilyHistory';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">❤️</span>
              <Link to="/" className="text-xl font-bold">
                公益物资发放台
              </Link>
            </div>
            <div className="hidden md:flex space-x-1">
              <Link to="/" className="hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors">
                📊 看板
              </Link>
              <Link to="/families" className="hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors">
                👨‍👩‍👧‍👦 家庭管理
              </Link>
              <Link to="/materials" className="hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors">
                📦 物资管理
              </Link>
              <Link to="/batches" className="hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors">
                📋 批次管理
              </Link>
              <Link to="/distributions" className="hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors">
                ✅ 发放登记
              </Link>
              <Link to="/inventory" className="hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors">
                🏪 库存管理
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/families" element={<Families />} />
          <Route path="/families/:id/history" element={<FamilyHistory />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/batches" element={<Batches />} />
          <Route path="/distributions" element={<Distributions />} />
          <Route path="/inventory" element={<Inventory />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
