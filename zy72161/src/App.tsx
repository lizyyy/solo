import { Header } from '@/components/layout/Header';
import { MapPage } from '@/pages/MapPage';
import { ConflictPage } from '@/pages/ConflictPage';
import { ReportPage } from '@/pages/ReportPage';
import { ReportModal } from '@/components/report/ReportModal';
import { useUIStore } from '@/store/uiStore';

export default function App() {
  const { activeTab, showReportModal } = useUIStore();

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Header />
      
      <main>
        {activeTab === 'map' && <MapPage />}
        {activeTab === 'conflicts' && <ConflictPage />}
        {activeTab === 'report' && <ReportPage />}
      </main>

      {showReportModal && <ReportModal />}
    </div>
  );
}
