import { useAppStore } from '../store';
import { Sidebar } from '../components/Sidebar';
import { NotificationContainer } from '../components/Notification';
import { Dashboard } from './Dashboard';
import { RiskList } from './RiskList';
import { GraphPage } from './GraphPage';
import { ImportPage } from './ImportPage';
import { VersionPage } from './VersionPage';
import { ReportPage } from './ReportPage';

export default function Home() {
  const currentPage = useAppStore((state) => state.currentPage);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'riskList':
        return <RiskList />;
      case 'graph':
        return <GraphPage />;
      case 'import':
        return <ImportPage />;
      case 'version':
        return <VersionPage />;
      case 'report':
        return <ReportPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-6 min-h-screen">
        {renderPage()}
      </main>
      <NotificationContainer />
    </div>
  );
}
