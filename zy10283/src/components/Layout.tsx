import React from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useRepairStore } from '../store';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { getOverdueOrders, getUnquotedRepairingOrders } = useRepairStore();
  const overdueCount = getOverdueOrders().length;
  const unquotedCount = getUnquotedRepairingOrders().length;

  const navItems = [
    { path: '/', label: '仪表盘', icon: LayoutDashboard },
    { path: '/orders', label: '维修单列表', icon: ClipboardList },
    { path: '/orders/new', label: '新建维修单', icon: PlusCircle },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col no-print">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">珠宝维修寄存台</h1>
          <p className="text-sm text-gray-500 mt-1">Jewelry Repair Desk</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-2">
          {overdueCount > 0 && (
            <div className="flex items-center px-4 py-3 bg-red-50 text-red-600 rounded-lg">
              <AlertTriangle className="w-5 h-5 mr-3" />
              <span>逾期订单：{overdueCount} 单</span>
            </div>
          )}
          {unquotedCount > 0 && (
            <div className="flex items-center px-4 py-3 bg-yellow-50 text-yellow-600 rounded-lg">
              <Clock className="w-5 h-5 mr-3" />
              <span>未报价已维修：{unquotedCount} 单</span>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
};
