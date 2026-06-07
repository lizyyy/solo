import { NavLink, Outlet } from 'react-router-dom';
import {
  Home,
  List,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Workflow
} from 'lucide-react';
import { ToastContainer } from './Toast';
import { useAppStore } from '../store';
import { getStatusLabel, getStatusColor } from '../utils';
import { currentUser } from '../data/mockData';
import { useEffect } from 'react';
import {
  mockPlaybackRecords,
  mockAnomalies,
  mockExperimentBuckets,
  mockLayerMetrics,
  mockVersionHistories
} from '../data/mockData';

const navItems = [
  { path: '/', label: '工作流', icon: Workflow },
  { path: '/playbacks', label: '回放列表', icon: List },
  { path: '/anomalies', label: '异常检测', icon: AlertTriangle },
  { path: '/visualization', label: '可视化', icon: BarChart3 },
  { path: '/rules', label: '边界规则', icon: BookOpen }
];

export const Layout = () => {
  const { playbackRecords, anomalies, initMockData } = useAppStore();

  useEffect(() => {
    if (playbackRecords.length === 0) {
      initMockData({
        playbackRecords: mockPlaybackRecords,
        anomalies: mockAnomalies,
        experimentBuckets: mockExperimentBuckets,
        layerMetrics: mockLayerMetrics,
        versionHistories: mockVersionHistories
      });
    }
  }, [playbackRecords.length, initMockData]);

  const pendingCount = anomalies.filter(a => !a.reviewResult).length;

  return (
    <div className="flex min-h-screen bg-primary-50">
      <aside className="w-64 bg-primary-900 text-white flex flex-col">
        <div className="p-6 border-b border-primary-700">
          <h1 className="text-xl font-bold font-display flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-accent-400" />
            样本回放
          </h1>
          <p className="text-xs text-primary-300 mt-1">在线学习阈值调参系统</p>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary-700 text-white shadow-lg'
                          : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                    {item.path === '/anomalies' && pendingCount > 0 && (
                      <span className="ml-auto bg-accent-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {pendingCount}
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-primary-700">
          <div className="bg-primary-800 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold">
                {currentUser.name[0]}
              </div>
              <div>
                <p className="text-sm font-medium">{currentUser.name}</p>
                <p className="text-xs text-primary-300">评测运营</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 font-display">
              在线学习样本回放
            </h2>
            <p className="text-sm text-gray-500">
              阈值调参全链路追溯 · 异常自动检测 · 版本可回滚
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${getStatusColor('normal')}`}></span>
              <span className="text-gray-600">正常 {playbackRecords.filter(r => r.status === 'normal').length}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${getStatusColor('pending_review')} animate-pulse`}></span>
              <span className="text-gray-600">待复核 {pendingCount > 0 ? pendingCount : 0}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-auto">
          <Outlet />
        </div>
      </main>

      <ToastContainer />
    </div>
  );
};
