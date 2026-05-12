import React, { useState } from 'react';
import { FileText, Users, Car, Upload, Download, AlertCircle, BarChart3 } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onTabChange: (tab: string) => void;
  activeTab: string;
}

const Layout: React.FC<LayoutProps> = ({ children, onTabChange, activeTab }) => {
  const menuItems = [
    { id: 'violations', label: '违章管理', icon: AlertCircle },
    { id: 'import', label: '导入导出', icon: Upload },
    { id: 'drivers', label: '司机管理', icon: Users },
    { id: 'vehicles', label: '车辆管理', icon: Car },
    { id: 'shifts', label: '班次管理', icon: BarChart3 },
    { id: 'batches', label: '导入记录', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">车队司机违章申诉台</h1>
                <p className="text-sm text-gray-500">违章记录处理与申诉管理系统</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">管理员：张三</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          <nav className="w-56 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-3 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === item.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
