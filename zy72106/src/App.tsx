import { useAppStore } from '@/store/useAppStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Dashboard } from '@/pages/Dashboard';
import { DataImport } from '@/pages/DataImport';
import { Workspace } from '@/pages/Workspace';
import { Results } from '@/pages/Results';
import { History } from '@/pages/History';
import { Report } from '@/pages/Report';

const pageTitles: Record<string, string> = {
  dashboard: '仪表盘',
  import: '数据导入',
  workspace: '计算工作台',
  results: '结果分析',
  history: '历史记录',
  report: '报告导出',
};

function App() {
  const { currentPage, setCurrentPage } = useAppStore();

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'import':
        return <DataImport />;
      case 'workspace':
        return <Workspace />;
      case 'results':
        return <Results />;
      case 'history':
        return <History />;
      case 'report':
        return <Report />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <div className="flex-1 flex flex-col">
        <Header title={pageTitles[currentPage] || '地震波定位工具'} />
        <main className="flex-1 overflow-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
