import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { api } from './api';
import Dashboard from './pages/Dashboard';
import Riders from './pages/Riders';
import Checkpoints from './pages/Checkpoints';
import EquipmentCheckPage from './pages/EquipmentCheckPage';
import Dropouts from './pages/Dropouts';
import Supplies from './pages/Supplies';
import RiderDetail from './pages/RiderDetail';
import { DashboardStats } from './types';

function Navbar({ stats }: { stats: DashboardStats | null }) {
  const navigate = useNavigate();
  
  const handleExport = async () => {
    try {
      const blob = await api.exportReport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cycling-event-report-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('导出失败: ' + e.message);
    }
  };

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="font-bold text-xl">🚴 城市骑行活动签到台</Link>
            <div className="flex space-x-4">
              <Link to="/" className="hover:bg-white/20 px-3 py-2 rounded">仪表盘</Link>
              <Link to="/riders" className="hover:bg-white/20 px-3 py-2 rounded">报名列表</Link>
              <Link to="/checkpoints" className="hover:bg-white/20 px-3 py-2 rounded">签到点看板</Link>
              <Link to="/equipment" className="hover:bg-white/20 px-3 py-2 rounded">装备检查</Link>
              <Link to="/dropouts" className="hover:bg-white/20 px-3 py-2 rounded">退赛登记</Link>
              <Link to="/supplies" className="hover:bg-white/20 px-3 py-2 rounded">补给状态</Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {stats && (
              <div className="text-sm space-x-4">
                <span>总骑手: {stats.totalRiders}</span>
                <span>完赛: {stats.finishCount}</span>
                <span>退赛: {stats.dropoutsCount}</span>
              </div>
            )}
            <button 
              onClick={handleExport}
              className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded font-medium"
            >
              📥 导出报告
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const loadStats = async () => {
    try {
      const data = await api.getDashboard();
      setStats(data);
    } catch (e: any) {
      console.error('加载统计失败:', e.message);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar stats={stats} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard stats={stats} onRefresh={loadStats} />} />
          <Route path="/riders" element={<Riders onRefresh={loadStats} />} />
          <Route path="/checkpoints" element={<Checkpoints onRefresh={loadStats} />} />
          <Route path="/equipment" element={<EquipmentCheckPage onRefresh={loadStats} />} />
          <Route path="/dropouts" element={<Dropouts onRefresh={loadStats} />} />
          <Route path="/supplies" element={<Supplies onRefresh={loadStats} />} />
          <Route path="/riders/:id" element={<RiderDetail onRefresh={loadStats} />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
