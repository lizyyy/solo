import { NavLink } from 'react-router-dom';
import {
  Grid3X3,
  TrendingUp,
  Tag,
  AlertTriangle,
  FileBarChart,
  BarChart3,
} from 'lucide-react';

const navItems = [
  { path: '/', icon: Grid3X3, label: '转移矩阵', description: '状态转移概率热力图' },
  { path: '/forecast', icon: TrendingUp, label: '状态预测', description: '多步预测与吸收分析' },
  { path: '/promo', icon: Tag, label: '促销切片', description: '促销干扰因子分析' },
  { path: '/anomaly', icon: AlertTriangle, label: '异常诊断', description: '缺样/干扰/误设检测' },
  { path: '/reports', icon: FileBarChart, label: '报告导出', description: '批次化报告管理' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-navy-100 flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-navy-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-navy-700 to-navy-900 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-navy-900">库存马尔可夫</h1>
            <p className="text-xs text-navy-500">周转状态分析系统</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : ''}`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <div>
              <div className="font-medium">{item.label}</div>
              <div className="text-xs opacity-70">{item.description}</div>
            </div>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-navy-100">
        <div className="bg-gradient-to-br from-navy-50 to-navy-100 rounded-xl p-4">
          <div className="text-xs text-navy-600 mb-2">当前数据周期</div>
          <div className="font-display text-lg font-bold text-navy-900">2026年 第1-24周</div>
          <div className="text-xs text-navy-500 mt-1">50个SKU · 1,200条记录</div>
        </div>
      </div>
    </aside>
  );
}
