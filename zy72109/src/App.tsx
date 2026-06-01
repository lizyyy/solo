import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useStore } from '@/store';
import Workbench from '@/pages/Workbench';
import DataImport from '@/pages/DataImport';
import Calculate from '@/pages/Calculate';
import Detection from '@/pages/Detection';
import Inspection from '@/pages/Inspection';
import Report from '@/pages/Report';
import History from '@/pages/History';
import {
  Snowflake,
  Upload,
  Calculator,
  AlertTriangle,
  ClipboardCheck,
  FileText,
  History as HistoryIcon,
  LayoutDashboard,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'workbench', label: '工作台', icon: LayoutDashboard, path: '/' },
  { id: 'import', label: '数据导入', icon: Upload, path: '/import' },
  { id: 'calculate', label: '负荷计算', icon: Calculator, path: '/calculate' },
  { id: 'detection', label: '异常检测', icon: AlertTriangle, path: '/detection' },
  { id: 'inspection', label: '巡检表', icon: ClipboardCheck, path: '/inspection' },
  { id: 'report', label: '诊断报告', icon: FileText, path: '/report' },
  { id: 'history', label: '历史对比', icon: HistoryIcon, path: '/history' },
];

function Sidebar({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  return (
    <aside className="w-56 min-h-screen bg-primary-800 border-r border-primary-700 flex flex-col">
      <div className="px-4 py-5 border-b border-primary-700">
        <div className="flex items-center gap-2">
          <Snowflake className="w-6 h-6 text-blue-300" />
          <div>
            <h1 className="text-sm font-mono font-bold text-white tracking-wide">冰场制冷负荷</h1>
            <p className="text-xs font-mono text-primary-300">诊断工具 v1.0</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-3">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-mono transition-colors
                ${isActive
                  ? 'bg-primary-700 text-white border-l-2 border-blue-300'
                  : 'text-primary-300 hover:bg-primary-750 hover:text-primary-100 border-l-2 border-transparent'
                }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-primary-700">
        <p className="text-xs font-mono text-primary-400">
          © 2024 冰场诊断工具
        </p>
      </div>
    </aside>
  );
}

function TopBar() {
  const { currentBatch, operatorName, setOperatorName } = useStore();
  return (
    <header className="h-12 bg-white border-b border-primary-200 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        {currentBatch && (
          <div className="flex items-center gap-2">
            <span className="status-badge status-badge-normal">
              {currentBatch.status === 'draft' ? '草稿' :
               currentBatch.status === 'processing' ? '处理中' :
               currentBatch.status === 'completed' ? '已完成' : '已归档'}
            </span>
            <span className="font-mono text-sm text-primary-700">{currentBatch.name}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-industrial-500">操作员:</span>
        <input
          value={operatorName}
          onChange={e => setOperatorName(e.target.value)}
          placeholder="输入姓名"
          className="industrial-input w-32 py-1 text-xs"
        />
      </div>
    </header>
  );
}

function AppContent() {
  const { activeTab, setActiveTab, currentBatch } = useStore();

  const renderPage = () => {
    if (!currentBatch && activeTab !== 'workbench') {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="industrial-card p-8 text-center max-w-md">
            <Snowflake className="w-12 h-12 text-primary-400 mx-auto mb-4" />
            <h2 className="text-lg font-mono font-semibold text-primary-700 mb-2">
              尚未选择批次
            </h2>
            <p className="text-sm text-industrial-500 mb-4">
              请先在工作台创建或选择一个诊断批次
            </p>
            <button onClick={() => setActiveTab('workbench')} className="industrial-btn-primary">
              返回工作台
            </button>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'workbench': return <Workbench />;
      case 'import': return <DataImport />;
      case 'calculate': return <Calculate />;
      case 'detection': return <Detection />;
      case 'inspection': return <Inspection />;
      case 'report': return <Report />;
      case 'history': return <History />;
      default: return <Workbench />;
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto p-4">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="*" element={<AppContent />} />
      </Routes>
    </Router>
  );
}
