import React from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  FlaskConical,
  Table2,
  TrendingUp,
  Gauge,
  AlertTriangle,
  FileText,
  Settings,
  Plus,
  Database,
} from 'lucide-react';
import { useExperimentStore } from '@/store/useExperimentStore';

interface SidebarProps {
  collapsed: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { experiments, currentExperimentId, createExperimentWithSampleData, setCurrentExperiment } = useExperimentStore();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: '工作台', exact: true },
    { path: '/experiments', icon: FlaskConical, label: '实验列表', exact: true },
    { path: '/settings', icon: Settings, label: '参数配置', exact: true },
  ];

  const experimentNavItems = id ? [
    { path: `/experiments/${id}/data`, icon: Table2, label: '数据录入' },
    { path: `/experiments/${id}/fitting`, icon: TrendingUp, label: '推力拟合' },
    { path: `/experiments/${id}/efficiency`, icon: Gauge, label: '效率曲线' },
    { path: `/experiments/${id}/anomalies`, icon: AlertTriangle, label: '异常检测' },
    { path: `/experiments/${id}/report`, icon: FileText, label: '报告导出' },
  ] : [];

  const handleCreateSample = async () => {
    const newId = await createExperimentWithSampleData();
    navigate(`/experiments/${newId}/data`);
  };

  return (
    <div className={`h-full bg-industrial-900 border-r border-industrial-800 flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="p-4 border-b border-industrial-800">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-tech-500/20 border border-tech-500/30 flex items-center justify-center">
            <Database size={18} className="text-tech-400" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-display text-sm font-bold text-gray-100">推力台</h1>
              <p className="text-xs text-gray-500">无人机桨叶分析</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            onClick={() => !item.exact && item.path === '/experiments' && setCurrentExperiment(null)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                isActive
                  ? 'bg-tech-500/10 text-tech-400 border border-tech-500/30'
                  : 'text-gray-400 hover:bg-industrial-800 hover:text-gray-200'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            <item.icon size={18} />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </NavLink>
        ))}

        {experimentNavItems.length > 0 && (
          <>
            {!collapsed && (
              <div className="pt-4 pb-2 px-3">
                <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">当前实验</p>
              </div>
            )}
            {experimentNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                    isActive
                      ? 'bg-tech-500/10 text-tech-400 border border-tech-500/30'
                      : 'text-gray-400 hover:bg-industrial-800 hover:text-gray-200'
                  } ${collapsed ? 'justify-center' : ''}`
                }
              >
                <item.icon size={18} />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {!collapsed && (
        <div className="p-3 border-t border-industrial-800">
          <button
            onClick={handleCreateSample}
            className="w-full flex items-center gap-2 px-3 py-2 bg-tech-500 hover:bg-tech-400 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            <span className="text-sm font-medium">加载示例数据</span>
          </button>
        </div>
      )}

      {!collapsed && experiments.length > 0 && (
        <div className="p-3 border-t border-industrial-800 max-h-48 overflow-y-auto">
          <p className="text-xs text-gray-500 mb-2 font-mono">最近实验</p>
          <div className="space-y-1">
            {experiments.slice(0, 5).map((exp) => (
              <button
                key={exp.id}
                onClick={() => navigate(`/experiments/${exp.id}/data`)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors truncate ${
                  exp.id === currentExperimentId
                    ? 'bg-tech-500/10 text-tech-400'
                    : 'text-gray-400 hover:bg-industrial-800'
                }`}
              >
                {exp.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
