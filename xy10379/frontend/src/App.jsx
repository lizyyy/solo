import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  BedDouble, 
  FileText, 
  CheckSquare, 
  AlertTriangle, 
  CreditCard, 
  Package, 
  Download,
  Home,
  Menu,
  X
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import RoomOrders from './pages/RoomOrders';
import CleanInspections from './pages/CleanInspections';
import DamageReports from './pages/DamageReports';
import Compensations from './pages/Compensations';
import Inventory from './pages/Inventory';
import ProcessGuide from './pages/ProcessGuide';
import { exportApi } from './api';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const navItems = [
    { path: '/', name: '总览', icon: Home },
    { path: '/rooms', name: '客房管理', icon: BedDouble },
    { path: '/orders', name: '客房房单', icon: FileText },
    { path: '/inspections', name: '清洁检查', icon: CheckSquare },
    { path: '/damages', name: '报损登记', icon: AlertTriangle },
    { path: '/compensations', name: '客人赔付', icon: CreditCard },
    { path: '/inventory', name: '库存管理', icon: Package },
    { path: '/guide', name: '操作流程', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen && (
            <h1 className="text-lg font-bold text-gray-800">布草报损赔付台</h1>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        
        <nav className="flex-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={20} />
                {sidebarOpen && <span className="font-medium">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={exportApi.downloadDaily}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download size={18} />
            {sidebarOpen && <span>导出日报</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/orders" element={<RoomOrders />} />
            <Route path="/inspections" element={<CleanInspections />} />
            <Route path="/damages" element={<DamageReports />} />
            <Route path="/compensations" element={<Compensations />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/guide" element={<ProcessGuide />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
